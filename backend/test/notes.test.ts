import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { authHeader, makeHarness, noteBody, type Harness } from './helpers.js';

let h: Harness;

beforeEach(() => {
  h = makeHarness();
});

afterEach(async () => {
  await h.close();
});

describe('authentification', () => {
  it('refuse sans jeton', async () => {
    const res = await h.app.inject({ method: 'GET', url: '/v1/notes' });
    expect(res.statusCode).toBe(401);
  });

  it('refuse un jeton invalide', async () => {
    const res = await h.app.inject({
      method: 'GET',
      url: '/v1/notes',
      headers: { authorization: 'Bearer nimporte-quoi' }
    });
    expect(res.statusCode).toBe(401);
  });

  it('expose /health sans jeton', async () => {
    const res = await h.app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('renvoie l’identité sur /v1/me', async () => {
    const res = await h.app.inject({ method: 'GET', url: '/v1/me', headers: authHeader('bob') });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ sub: 'bob', email: 'bob@example.test' });
  });
});

describe('notes', () => {
  it('crée puis relit une note', async () => {
    const put = await h.app.inject({
      method: 'PUT',
      url: '/v1/notes/n1',
      headers: authHeader(),
      payload: noteBody()
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().note).toMatchObject({ id: 'n1', title: 'Note de test', deleted: false, rev: 1 });

    const list = await h.app.inject({ method: 'GET', url: '/v1/notes', headers: authHeader() });
    expect(list.statusCode).toBe(200);
    const body = list.json();
    expect(body.notes).toHaveLength(1);
    expect(body.notes[0]).toMatchObject({ id: 'n1', md: noteBody().md });
    expect(body.nextSince).toBe(body.notes[0].serverUpdatedAt);
    expect(body.hasMore).toBe(false);
  });

  it('écrase la même note (upsert) et incrémente rev', async () => {
    await h.app.inject({ method: 'PUT', url: '/v1/notes/n1', headers: authHeader(), payload: noteBody() });
    const second = await h.app.inject({
      method: 'PUT',
      url: '/v1/notes/n1',
      headers: authHeader(),
      payload: noteBody({ title: 'Modifiée', md: 'contenu v2', updatedAt: 1_700_000_100_000, rev: 1 })
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().note).toMatchObject({ id: 'n1', title: 'Modifiée', rev: 2 });

    const list = await h.app.inject({ method: 'GET', url: '/v1/notes', headers: authHeader() });
    expect(list.json().notes).toHaveLength(1);
  });

  it('ne renvoie que ce qui a changé depuis le curseur', async () => {
    await h.app.inject({ method: 'PUT', url: '/v1/notes/a', headers: authHeader(), payload: noteBody() });
    const first = await h.app.inject({ method: 'GET', url: '/v1/notes', headers: authHeader() });
    const since = first.json().nextSince as number;

    await h.app.inject({ method: 'PUT', url: '/v1/notes/b', headers: authHeader(), payload: noteBody({ title: 'B' }) });

    const delta = await h.app.inject({
      method: 'GET',
      url: `/v1/notes?since=${since}`,
      headers: authHeader()
    });
    const ids = delta.json().notes.map((n: { id: string }) => n.id);
    expect(ids).toEqual(['b']);
  });

  it('signale un conflit quand le serveur est plus récent', async () => {
    await h.app.inject({
      method: 'PUT',
      url: '/v1/notes/n1',
      headers: authHeader(),
      payload: noteBody({ title: 'Serveur', updatedAt: 1_700_000_500_000 })
    });
    const res = await h.app.inject({
      method: 'PUT',
      url: '/v1/notes/n1',
      headers: authHeader(),
      payload: noteBody({ title: 'Vieux client', updatedAt: 1_700_000_100_000 })
    });
    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.conflict).toBe(true);
    expect(body.note.title).toBe('Serveur');
  });

  it('supprime en pierre tombale visible des autres appareils', async () => {
    await h.app.inject({ method: 'PUT', url: '/v1/notes/n1', headers: authHeader(), payload: noteBody() });
    const del = await h.app.inject({ method: 'DELETE', url: '/v1/notes/n1', headers: authHeader() });
    expect(del.statusCode).toBe(200);
    expect(del.json().note.deleted).toBe(true);

    const list = await h.app.inject({ method: 'GET', url: '/v1/notes', headers: authHeader() });
    const note = list.json().notes[0];
    expect(note.deleted).toBe(true);
    expect(note.md).toBe('');
  });

  it('ressuscite une note supprimée si un client la réécrit', async () => {
    await h.app.inject({ method: 'PUT', url: '/v1/notes/n1', headers: authHeader(), payload: noteBody() });
    await h.app.inject({ method: 'DELETE', url: '/v1/notes/n1', headers: authHeader() });
    const back = await h.app.inject({
      method: 'PUT',
      url: '/v1/notes/n1',
      headers: authHeader(),
      payload: noteBody({ title: 'De retour', updatedAt: Date.now() + 10_000 })
    });
    expect(back.statusCode).toBe(200);
    expect(back.json().note.deleted).toBe(false);
  });

  it('isole les notes de deux utilisateurs', async () => {
    await h.app.inject({ method: 'PUT', url: '/v1/notes/n1', headers: authHeader('alice'), payload: noteBody() });

    const bob = await h.app.inject({ method: 'GET', url: '/v1/notes', headers: authHeader('bob') });
    expect(bob.json().notes).toHaveLength(0);
  });

  it('refuse un corps invalide', async () => {
    const res = await h.app.inject({
      method: 'PUT',
      url: '/v1/notes/n1',
      headers: authHeader(),
      payload: { title: 'sans dates' }
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('dossiers', () => {
  it('crée, liste et supprime', async () => {
    await h.app.inject({
      method: 'PUT',
      url: '/v1/folders/f1',
      headers: authHeader(),
      payload: { name: 'Travail', createdAt: 1, updatedAt: 1 }
    });
    const list = await h.app.inject({ method: 'GET', url: '/v1/folders', headers: authHeader() });
    expect(list.json().folders).toHaveLength(1);
    expect(list.json().folders[0]).toMatchObject({ id: 'f1', name: 'Travail', deleted: false });

    await h.app.inject({ method: 'DELETE', url: '/v1/folders/f1', headers: authHeader() });
    const after = await h.app.inject({ method: 'GET', url: '/v1/folders', headers: authHeader() });
    expect(after.json().folders[0].deleted).toBe(true);
  });
});
