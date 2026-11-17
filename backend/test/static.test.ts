import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { openDb } from '../src/db.js';

/** Intégration : Fastify sert la PWA compilée en plus de l'API (image unique). */
describe('front statique', () => {
  let root: string;
  let dataDir: string;
  let app: ReturnType<typeof buildApp>;
  let db: ReturnType<typeof openDb>;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'notes-static-'));
    dataDir = join(root, 'data');
    mkdirSync(join(root, 'public', 'assets'), { recursive: true });
    writeFileSync(join(root, 'public', 'index.html'), '<!doctype html><h1>Notes</h1>');
    writeFileSync(join(root, 'public', 'sw.js'), 'self.addEventListener("install", () => {})');
    writeFileSync(join(root, 'public', 'assets', 'app-123.js'), 'console.log("notes")');

    db = openDb(dataDir);
    app = buildApp({ db, dataDir, staticDir: join(root, 'public') });
  });

  afterEach(async () => {
    await app.close();
    db.close();
    rmSync(root, { recursive: true, force: true });
  });

  it('sert la page d’entrée', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('<h1>Notes</h1>');
    expect(res.headers['cache-control']).toBe('no-cache');
  });

  it('renvoie index.html sur une route profonde (SPA)', async () => {
    const res = await app.inject({ method: 'GET', url: '/une/route/profonde' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('<h1>Notes</h1>');
  });

  it('met les assets versionnés en cache long', async () => {
    const res = await app.inject({ method: 'GET', url: '/assets/app-123.js' });

    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('revalide le service worker', async () => {
    const res = await app.inject({ method: 'GET', url: '/sw.js' });

    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('no-cache');
  });

  it('ne renvoie pas index.html pour une route API inconnue', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/inconnue' });

    expect(res.statusCode).toBe(404);
    expect(res.body).not.toContain('<h1>Notes</h1>');
  });

  it('garde la sonde de vie', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});
