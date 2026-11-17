import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import type { AuthVerify } from '../src/auth.js';
import { openDb } from '../src/db.js';

/**
 * Faux vérificateur : le jeton est `test:<sub>`, ce qui évite de monter un Keycloak
 * pour les tests tout en exerçant le même chemin (401, isolation par utilisateur).
 */
export const fakeVerify: AuthVerify = async (authorization) => {
  if (!authorization?.startsWith('Bearer test:')) throw new Error('jeton invalide');
  const sub = authorization.slice('Bearer test:'.length).trim();
  if (!sub) throw new Error('sujet vide');
  return { sub, name: sub, email: `${sub}@example.test` };
};

export function authHeader(sub = 'alice'): Record<string, string> {
  return { authorization: `Bearer test:${sub}` };
}

export type Harness = {
  app: FastifyInstance;
  dataDir: string;
  close: () => Promise<void>;
};

export function makeHarness(): Harness {
  const dataDir = mkdtempSync(join(tmpdir(), 'notes-server-'));
  const db = openDb(dataDir);
  const app = buildApp({
    db,
    verify: fakeVerify,
    dataDir,
    maxUpload: 1024 * 1024,
    corsOrigin: 'http://localhost:5173'
  });

  return {
    app,
    dataDir,
    close: async () => {
      await app.close();
      db.close();
      rmSync(dataDir, { recursive: true, force: true });
    }
  };
}

export function noteBody(overrides: Partial<Record<string, unknown>> = {}) {
  const now = 1_700_000_000_000;
  return {
    title: 'Note de test',
    md: '# Titre\n\nDu texte **gras**.',
    color: 'default',
    folderId: null,
    pinned: false,
    hidden: false,
    remindAt: null,
    createdAt: now,
    updatedAt: now,
    rev: 0,
    ...overrides
  };
}
