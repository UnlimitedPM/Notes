import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Db } from '../db.js';

export type NoteDto = {
  id: string;
  title: string;
  md: string;
  color: string;
  folderId: string | null;
  pinned: boolean;
  hidden: boolean;
  remindAt: number | null;
  createdAt: number;
  updatedAt: number;
  rev: number;
  deleted: boolean;
  serverUpdatedAt: number;
};

type NoteRow = {
  id: string;
  title: string;
  md: string;
  color: string;
  folder_id: string | null;
  pinned: number;
  hidden: number;
  remind_at: number | null;
  created_at: number;
  updated_at: number;
  rev: number;
  deleted: number;
  server_updated_at: number;
};

function toDto(row: NoteRow): NoteDto {
  return {
    id: row.id,
    title: row.title,
    md: row.md,
    color: row.color,
    folderId: row.folder_id,
    pinned: row.pinned === 1,
    hidden: row.hidden === 1,
    remindAt: row.remind_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    rev: row.rev,
    deleted: row.deleted === 1,
    serverUpdatedAt: row.server_updated_at
  };
}

const NoteBody = z.object({
  title: z.string().max(2000).default(''),
  md: z.string().default(''),
  color: z.string().max(40).default('default'),
  folderId: z.string().max(200).nullable().default(null),
  pinned: z.boolean().default(false),
  hidden: z.boolean().default(false),
  remindAt: z.number().int().nullable().default(null),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  rev: z.number().int().nonnegative().default(0)
});

const idParams = z.object({ id: z.string().min(1).max(200) });
const listQuery = z.object({
  since: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().min(1).max(500).default(200)
});

export function registerNoteRoutes(app: FastifyInstance, db: Db): void {
  const selectSince = db.prepare<[string, number, number], NoteRow>(
    `SELECT * FROM notes
     WHERE user_id = ? AND server_updated_at > ?
     ORDER BY server_updated_at ASC, id ASC
     LIMIT ?`
  );
  const selectOne = db.prepare<[string, string], NoteRow>(
    'SELECT * FROM notes WHERE user_id = ? AND id = ?'
  );
  const upsert = db.prepare(
    `INSERT INTO notes (user_id, id, title, md, color, folder_id, pinned, hidden, remind_at,
                        created_at, updated_at, rev, deleted, server_updated_at)
     VALUES (@userId, @id, @title, @md, @color, @folderId, @pinned, @hidden, @remindAt,
             @createdAt, @updatedAt, @rev, 0, @serverUpdatedAt)
     ON CONFLICT (user_id, id) DO UPDATE SET
       title = excluded.title,
       md = excluded.md,
       color = excluded.color,
       folder_id = excluded.folder_id,
       pinned = excluded.pinned,
       hidden = excluded.hidden,
       remind_at = excluded.remind_at,
       updated_at = excluded.updated_at,
       rev = excluded.rev,
       deleted = 0,
       server_updated_at = excluded.server_updated_at`
  );
  const tombstone = db.prepare(
    `INSERT INTO notes (user_id, id, title, md, color, folder_id, pinned, hidden, remind_at,
                        created_at, updated_at, rev, deleted, server_updated_at)
     VALUES (@userId, @id, '', '', 'default', NULL, 0, 0, NULL, @now, @now, 1, 1, @now)
     ON CONFLICT (user_id, id) DO UPDATE SET
       md = '',
       deleted = 1,
       updated_at = excluded.updated_at,
       rev = notes.rev + 1,
       server_updated_at = excluded.server_updated_at`
  );

  /** Liste incrémentale : tout ce qui a changé côté serveur depuis `since`. */
  app.get('/v1/notes', async (request) => {
    const { since, limit } = listQuery.parse(request.query);
    const rows = selectSince.all(request.user!.sub, since, limit);
    const last = rows[rows.length - 1];
    return {
      notes: rows.map(toDto),
      nextSince: last ? last.server_updated_at : since,
      hasMore: rows.length === limit
    };
  });

  /** Écriture idempotente. `updatedAt` (horloge client) arbitre les conflits. */
  app.put('/v1/notes/:id', async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const body = NoteBody.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: 'corps invalide', issues: body.error.issues });
    }

    const userId = request.user!.sub;
    const existing = selectOne.get(userId, id);

    if (existing && existing.updated_at > body.data.updatedAt) {
      // le serveur a une version plus récente : le client doit arbitrer
      return reply.code(409).send({ conflict: true, note: toDto(existing) });
    }

    const serverUpdatedAt = Date.now();
    upsert.run({
      userId,
      id,
      title: body.data.title,
      md: body.data.md,
      color: body.data.color,
      folderId: body.data.folderId,
      pinned: body.data.pinned ? 1 : 0,
      hidden: body.data.hidden ? 1 : 0,
      remindAt: body.data.remindAt,
      createdAt: body.data.createdAt,
      updatedAt: body.data.updatedAt,
      rev: Math.max(body.data.rev + 1, (existing?.rev ?? 0) + 1),
      serverUpdatedAt
    });

    const stored = selectOne.get(userId, id);
    return reply.send({ note: stored ? toDto(stored) : null });
  });

  /** Suppression = pierre tombale, pour que les autres appareils la voient passer. */
  app.delete('/v1/notes/:id', async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const userId = request.user!.sub;
    tombstone.run({ userId, id, now: Date.now() });
    const stored = selectOne.get(userId, id);
    return reply.send({ note: stored ? toDto(stored) : null });
  });
}
