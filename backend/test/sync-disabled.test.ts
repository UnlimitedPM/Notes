import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { openDb } from '../src/db.js';

describe('sans OIDC', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'notes-no-oidc-'));
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it('sert la sonde et ferme /v1 en 503', async () => {
    const db = openDb(dataDir);
    const app = buildApp({ db, dataDir });

    expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);

    const res = await app.inject({ method: 'GET', url: '/v1/notes' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ error: 'sync_disabled' });

    await app.close();
    db.close();
  });
});