import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import fastifyStatic from '@fastify/static';
import './types.js';
import type { AuthVerify } from './auth.js';
import type { Db } from './db.js';
import { registerAttachmentRoutes } from './routes/attachments.js';
import { registerFolderRoutes } from './routes/folders.js';
import { registerNoteRoutes } from './routes/notes.js';

export type AppOptions = {
  db: Db;
  /** Absent = synchronisation désactivée (503 sur /v1). */
  verify?: AuthVerify;
  dataDir: string;
  maxUpload?: number;
  corsOrigin?: string;
  /** Dossier de la PWA compilée : sert le front sur la même origine que l'API. */
  staticDir?: string;
  logger?: boolean;
};

export function buildApp(options: AppOptions): FastifyInstance {
  const maxUpload = options.maxUpload ?? 25 * 1024 * 1024;
  const app = Fastify({ logger: options.logger ?? false, bodyLimit: maxUpload });
  const verify = options.verify;

  // Pièces jointes : le corps est binaire, on le récupère tel quel.
  app.addContentTypeParser('*', { parseAs: 'buffer' }, (_request, body, done) => {
    done(null, body as Buffer);
  });

  // CORS explicite (la PWA peut être servie depuis une autre origine).
  if (options.corsOrigin) {
    const allowed = options.corsOrigin;
    app.addHook('onRequest', async (request, reply) => {
      reply.header('access-control-allow-origin', allowed);
      reply.header('vary', 'origin');
      reply.header('access-control-allow-headers', 'authorization,content-type');
      reply.header('access-control-allow-methods', 'GET,POST,PUT,DELETE,OPTIONS');
      if (request.method === 'OPTIONS') {
        return reply.code(204).send();
      }
    });
  }

  app.get('/health', async () => ({ ok: true }));

  const requireUser = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!verify) {
      return reply.code(503).send({ error: 'sync_disabled' });
    }
    try {
      request.user = await verify(request.headers.authorization);
    } catch {
      return reply.code(401).send({ error: 'unauthorized' });
    }
  };

  // Toutes les routes /v1 exigent un jeton valide.
  void app.register(async (scope) => {
    scope.addHook('preHandler', requireUser);

    scope.get('/v1/me', async (request) => ({
      sub: request.user!.sub,
      name: request.user!.name ?? null,
      email: request.user!.email ?? null
    }));

    registerNoteRoutes(scope, options.db);
    registerFolderRoutes(scope, options.db);
    registerAttachmentRoutes(scope, options.db, { dataDir: options.dataDir, maxUpload });
  });

  // Front statique : même origine que /v1, donc aucune config CORS côté PWA.
  if (options.staticDir) {
    void app.register(fastifyStatic, {
      root: options.staticDir,
      wildcard: false,
      setHeaders: (reply: FastifyReply, path: string) => {
        if (path.includes('/assets/')) {
          reply.header('cache-control', 'public, max-age=31536000, immutable');
        } else if (
          path.endsWith('index.html') ||
          path.endsWith('sw.js') ||
          path.endsWith('registerSW.js') ||
          path.endsWith('manifest.webmanifest')
        ) {
          reply.header('cache-control', 'no-cache');
        }
      }
    });

    // Routes inconnues : SPA (rechargement profond), sauf API et sonde.
    app.setNotFoundHandler((request, reply) => {
      const url = request.url.split('?')[0] ?? '';
      if (request.method !== 'GET' || url.startsWith('/v1') || url === '/health') {
        return reply.code(404).send({ error: 'not_found' });
      }
      return reply.sendFile('index.html');
    });
  }

  return app;
}
