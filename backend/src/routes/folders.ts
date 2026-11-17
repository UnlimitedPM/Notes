import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Db } from '../db.js';

type FolderRow = {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  deleted: number;
  server_updated_at: number;
};

function toDto(row: FolderRow) {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deleted: row.deleted === 1,
    serverUpdatedAt: row.server_updated_at
  };
}

const FolderBody = z.object({
  name: z.string().min(1).max(120),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative()
});

const idParams = z.object({ id: z.string().min(1).max(200) });
const listQuery = z.object({
  since: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().min(1).max(500).default(200)
});

export function registerFolderRoutes(app: FastifyInstance, db: Db): void {
  const selectSince = db.prepare<[string, number, number], FolderRow>(
    `SELECT * FROM folders
     WHERE user_id = ? AND server_updated_at > ?
     ORDER BY server_updated_at ASC, id ASC
     LIMIT ?`
  );
  const upsert = db.prepare(
    `INSERT INTO folders (user_id, id, name, created_at, updated_at, deleted, server_updated_at)
     VALUES (@userId, @id, @name, @createdAt, @updatedAt, 0, @serverUpdatedAt)
     ON CONFLICT (user_id, id) DO UPDATE SET
       name = excluded.name,
       updated_at = excluded.updated_at,
       deleted = 0,
       server_updated_at = excluded.server_updated_at`
  );
  const tombstone = db.prepare(
    `INSERT INTO folders (user_id, id, name, created_at, updated_at, deleted, server_updated_at)
     VALUES (@userId, @id, '', @now, @now, 1, @now)
     ON CONFLICT (user_id, id) DO UPDATE SET
       deleted = 1,
       updated_at = excluded.updated_at,
       server_updated_at = excluded.server_updated_at`
  );

  app.get('/v1/folders', async (request) => {
    const { since, limit } = listQuery.parse(request.query);
    const rows = selectSince.all(request.user!.sub, since, limit);
    const last = rows[rows.length - 1];
    return {
      folders: rows.map(toDto),
      nextSince: last ? last.server_updated_at : since,
      hasMore: rows.length === limit
    };
  });

  app.put('/v1/folders/:id', async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const body = FolderBody.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: 'corps invalide', issues: body.error.issues });
    }
    upsert.run({
      userId: request.user!.sub,
      id,
      name: body.data.name,
      createdAt: body.data.createdAt,
      updatedAt: body.data.updatedAt,
      serverUpdatedAt: Date.now()
    });
    return reply.send({ ok: true });
  });

  app.delete('/v1/folders/:id', async (request) => {
    const { id } = idParams.parse(request.params);
    tombstone.run({ userId: request.user!.sub, id, now: Date.now() });
    return { ok: true };
  });
}
