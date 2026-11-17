import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

export type Db = Database.Database;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS notes (
  user_id           TEXT    NOT NULL,
  id                TEXT    NOT NULL,
  title             TEXT    NOT NULL DEFAULT '',
  md                TEXT    NOT NULL DEFAULT '',
  color             TEXT    NOT NULL DEFAULT 'default',
  folder_id         TEXT,
  pinned            INTEGER NOT NULL DEFAULT 0,
  hidden            INTEGER NOT NULL DEFAULT 0,
  remind_at         INTEGER,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  rev               INTEGER NOT NULL DEFAULT 1,
  deleted           INTEGER NOT NULL DEFAULT 0,
  server_updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS notes_sync ON notes (user_id, server_updated_at);

CREATE TABLE IF NOT EXISTS folders (
  user_id           TEXT    NOT NULL,
  id                TEXT    NOT NULL,
  name              TEXT    NOT NULL,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  deleted           INTEGER NOT NULL DEFAULT 0,
  server_updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS folders_sync ON folders (user_id, server_updated_at);

CREATE TABLE IF NOT EXISTS attachments (
  user_id    TEXT    NOT NULL,
  hash       TEXT    NOT NULL,
  mime       TEXT    NOT NULL,
  size       INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, hash)
);
`;

/** Ouvre (et crée au besoin) la base SQLite dans `dataDir`. */
export function openDb(dataDir: string): Db {
  mkdirSync(dataDir, { recursive: true });
  const db = new Database(join(dataDir, 'notes.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.exec(SCHEMA);
  return db;
}
