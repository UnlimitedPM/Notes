import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import './types.js';
import type { AuthVerify } from './auth.js';
import type { Db } from './db.js';
import { registerAttachmentRoutes } from './routes/attachments.js';
import { registerFolderRoutes } from './routes/folders.js';
import { registerNoteRoutes } from './routes/notes.js';

export type AppOptions = {
  db: Db;
  verify: AuthVerify;
  dataDir: string;
  maxUpload?: number;
  corsOrigin?: string;
  logger?: boolean;
};

export function buildApp(options: AppOptions): FastifyInstance {
  const maxUpload = options.maxUpload ?? 25 * 1024 * 1024;
  const app = Fastify({ logger: options.logger ?? false, bodyLimit: maxUpload });

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
    try {
      request.user = await options.verify(request.headers.authorization);
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

  return app;
}
