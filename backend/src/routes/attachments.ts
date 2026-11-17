import type { FastifyInstance } from 'fastify';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Db } from '../db.js';

const HASH = /^[a-f0-9]{64}$/;

export function registerAttachmentRoutes(
  app: FastifyInstance,
  db: Db,
  opts: { dataDir: string; maxUpload: number }
): void {
  const insert = db.prepare(
    `INSERT INTO attachments (user_id, hash, mime, size, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (user_id, hash) DO NOTHING`
  );
  const selectMime = db.prepare<[string, string], { mime: string }>(
    'SELECT mime FROM attachments WHERE user_id = ? AND hash = ?'
  );

  const pathFor = (hash: string) => join(opts.dataDir, 'attachments', hash.slice(0, 2), hash);

  /** Envoi brut (le corps = les octets du fichier), dédupliqué par SHA-256. */
  app.post('/v1/attachments', { bodyLimit: opts.maxUpload }, async (request, reply) => {
    const body = request.body;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      return reply.code(400).send({ error: 'corps vide' });
    }
    if (body.length > opts.maxUpload) {
      return reply.code(413).send({ error: 'fichier trop volumineux' });
    }

    const hash = createHash('sha256').update(body).digest('hex');
    const mime = (request.headers['content-type'] ?? 'application/octet-stream').split(';')[0]!.trim();

    const file = pathFor(hash);
    if (!existsSync(file)) {
      mkdirSync(dirname(file), { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      writeFileSync(tmp, body);
      renameSync(tmp, file); // écriture atomique : jamais de fichier à moitié écrit
    }

    insert.run(request.user!.sub, hash, mime, body.length, Date.now());
    return reply.code(201).send({ hash, mime, size: body.length, url: `/v1/attachments/${hash}` });
  });

  app.get('/v1/attachments/:hash', async (request, reply) => {
    const { hash } = request.params as { hash: string };
    if (!HASH.test(hash)) return reply.code(400).send({ error: 'hash invalide' });

    const row = selectMime.get(request.user!.sub, hash);
    if (!row) return reply.code(404).send({ error: 'introuvable' });

    const file = pathFor(hash);
    if (!existsSync(file)) return reply.code(404).send({ error: 'fichier absent' });

    return reply
      .header('content-type', row.mime)
      .header('cache-control', 'private, max-age=31536000, immutable')
      .send(readFileSync(file));
  });
}
