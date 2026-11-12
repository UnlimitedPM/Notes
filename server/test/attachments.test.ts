import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { authHeader, makeHarness, type Harness } from './helpers.js';

let h: Harness;

beforeEach(() => {
  h = makeHarness();
});

afterEach(async () => {
  await h.close();
});

const bytes = Buffer.from('des octets de test, pas une vraie image');

describe('pièces jointes', () => {
  it('envoie, renvoie un hash et sert le fichier', async () => {
    const up = await h.app.inject({
      method: 'POST',
      url: '/v1/attachments',
      headers: { ...authHeader(), 'content-type': 'image/png' },
      payload: bytes
    });
    expect(up.statusCode).toBe(201);
    const { hash, size, mime } = up.json();
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(size).toBe(bytes.length);
    expect(mime).toBe('image/png');

    const get = await h.app.inject({
      method: 'GET',
      url: `/v1/attachments/${hash}`,
      headers: authHeader()
    });
    expect(get.statusCode).toBe(200);
    expect(get.headers['content-type']).toBe('image/png');
    expect(get.headers['cache-control']).toContain('immutable');
    expect(Buffer.compare(get.rawPayload, bytes)).toBe(0);
  });

  it('déduplique : mêmes octets = même hash', async () => {
    const one = await h.app.inject({
      method: 'POST',
      url: '/v1/attachments',
      headers: { ...authHeader(), 'content-type': 'audio/webm' },
      payload: bytes
    });
    const two = await h.app.inject({
      method: 'POST',
      url: '/v1/attachments',
      headers: { ...authHeader(), 'content-type': 'audio/webm' },
      payload: bytes
    });
    expect(one.json().hash).toBe(two.json().hash);
  });

  it('refuse un corps vide', async () => {
    const res = await h.app.inject({
      method: 'POST',
      url: '/v1/attachments',
      headers: { ...authHeader(), 'content-type': 'image/png' },
      payload: Buffer.alloc(0)
    });
    expect(res.statusCode).toBe(400);
  });

  it('ne sert pas la pièce jointe d’un autre utilisateur', async () => {
    const up = await h.app.inject({
      method: 'POST',
      url: '/v1/attachments',
      headers: { ...authHeader('alice'), 'content-type': 'image/png' },
      payload: bytes
    });
    const hash = up.json().hash as string;

    const bob = await h.app.inject({
      method: 'GET',
      url: `/v1/attachments/${hash}`,
      headers: authHeader('bob')
    });
    expect(bob.statusCode).toBe(404);
  });

  it('rejette un hash malformé', async () => {
    const res = await h.app.inject({
      method: 'GET',
      url: '/v1/attachments/../../etc/passwd',
      headers: authHeader()
    });
    expect([400, 404]).toContain(res.statusCode);
  });
});
