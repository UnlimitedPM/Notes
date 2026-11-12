import { beforeEach, describe, expect, it } from 'vitest';
import { notesStore } from '../src/lib/notes.svelte';
import { syncStore } from '../src/lib/sync.svelte';
import { clearOutbox, writeMeta } from '../src/lib/db';
import type { CloudConfig } from '../src/lib/cloud/oidc';

/**
 * Faux serveur : reproduit les règles de l'API (LWW sur updatedAt, pierres tombales,
 * curseur `since`). Le moteur de synchro est branché dessus via `syncStore.fetcher`.
 */
type Stored = {
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
  deleted: boolean;
  serverUpdatedAt: number;
};

function fakeServer() {
  const notes = new Map<string, Stored>();
  const attachments = new Map<string, { bytes: Uint8Array; mime: string }>();
  let clock = 1000;

  const handler = async (
    _config: CloudConfig,
    path: string,
    init: RequestInit = {}
  ): Promise<Response> => {
    const method = init.method ?? 'GET';
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' }
      });

    if (path === '/v1/attachments' && method === 'POST') {
      const body = init.body as Blob;
      const bytes = new Uint8Array(await body.arrayBuffer());
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const hash = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      attachments.set(hash, { bytes, mime: body.type });
      return json({ hash, mime: body.type, size: bytes.length, url: `/v1/attachments/${hash}` }, 201);
    }

    if (path.startsWith('/v1/attachments/')) {
      const hash = path.replace('/v1/attachments/', '');
      const file = attachments.get(hash);
      if (!file) return json({ error: 'introuvable' }, 404);
      return new Response(file.bytes, { status: 200, headers: { 'content-type': file.mime } });
    }

    if (path.startsWith('/v1/notes?since=')) {
      const since = Number(new URLSearchParams(path.split('?')[1]).get('since') ?? 0);
      const rows = [...notes.values()]
        .filter((note) => note.serverUpdatedAt > since)
        .sort((a, b) => a.serverUpdatedAt - b.serverUpdatedAt);
      return json({
        notes: rows,
        nextSince: rows.length ? rows[rows.length - 1]!.serverUpdatedAt : since,
        hasMore: false
      });
    }

    const id = decodeURIComponent(path.replace('/v1/notes/', ''));

    if (method === 'DELETE') {
      clock += 1;
      const existing = notes.get(id);
      notes.set(id, {
        ...(existing ?? {
          id,
          title: '',
          md: '',
          color: 'default',
          folderId: null,
          pinned: false,
          hidden: false,
          remindAt: null,
          createdAt: clock,
          updatedAt: clock
        }),
        md: '',
        deleted: true,
        serverUpdatedAt: clock
      });
      return json({ note: notes.get(id) });
    }

    if (method === 'PUT') {
      const body = JSON.parse(String(init.body)) as Omit<Stored, 'deleted' | 'serverUpdatedAt'>;
      const existing = notes.get(id);
      if (existing && existing.updatedAt > body.updatedAt) {
        return json({ conflict: true, note: existing }, 409);
      }
      clock += 1;
      const stored: Stored = { ...body, id, deleted: false, serverUpdatedAt: clock };
      notes.set(id, stored);
      return json({ note: stored });
    }

    return json({ error: 'route inconnue' }, 404);
  };

  return { notes, attachments, handler };
}

const config: CloudConfig = {
  serverUrl: 'https://notes.test',
  issuer: 'https://sso.test/realms/x',
  clientId: 'notes-pwa'
};

function signIn(): void {
  localStorage.setItem('notes:cloud:config', JSON.stringify(config));
  localStorage.setItem(
    'notes:cloud:session',
    JSON.stringify({
      accessToken: 'jeton',
      refreshToken: null,
      expiresAt: Date.now() + 3_600_000,
      name: 'Paul',
      email: 'paul@test',
      sub: 'paul'
    })
  );
}

beforeEach(async () => {
  localStorage.clear();
  await clearOutbox();
  await writeMeta('sync:notes', 0);
  await notesStore.purgeEverything();
  notesStore.folders = [];
  notesStore.taskList = [];
  localStorage.setItem('notes:seed', '1');
  await notesStore.init();
  signIn();
});

describe('synchronisation', () => {
  it('pousse une note locale en Markdown', async () => {
    const server = fakeServer();
    syncStore.fetcher = server.handler;

    const note = notesStore.create('<div>Bonjour <span style="font-weight: bold;">toi</span></div>');
    note.title = 'Ma note';
    await notesStore.update(note.id, { title: 'Ma note' });
    await syncStore.notifyLocalChange(note.id, false);

    await syncStore.syncNow();

    const stored = server.notes.get(note.id);
    expect(stored).toBeTruthy();
    expect(stored?.title).toBe('Ma note');
    expect(stored?.md).toBe('Bonjour **toi**');
    expect(syncStore.pending).toBe(0);
    expect(syncStore.status).toBe('idle');
  });

  it('tire une note distante et la rend en HTML', async () => {
    const server = fakeServer();
    syncStore.fetcher = server.handler;
    server.notes.set('distante', {
      id: 'distante',
      title: 'Depuis le serveur',
      md: '# Titre\n\n- [x] fait',
      color: 'blue',
      folderId: null,
      pinned: false,
      hidden: false,
      remindAt: null,
      createdAt: 10,
      updatedAt: 20,
      deleted: false,
      serverUpdatedAt: 1
    });

    await syncStore.syncNow();

    const local = notesStore.byId('distante');
    expect(local?.title).toBe('Depuis le serveur');
    expect(local?.html).toContain('<h1>Titre</h1>');
    expect(local?.html).toContain('class="task-line" data-checked="true"');
    expect(local?.color).toBe('blue');
  });

  it('supprime localement une note supprimée ailleurs', async () => {
    const server = fakeServer();
    syncStore.fetcher = server.handler;

    const note = notesStore.create('<div>à jeter</div>');
    await syncStore.notifyLocalChange(note.id, false);
    await syncStore.syncNow();
    expect(notesStore.byId(note.id)).toBeTruthy();

    // supprimée depuis un autre appareil
    server.notes.get(note.id)!.deleted = true;
    server.notes.get(note.id)!.serverUpdatedAt = 9999;

    await syncStore.syncNow();
    expect(notesStore.byId(note.id)).toBeFalsy();
  });

  it('garde la version locale sous « (conflit) » quand le serveur est plus récent', async () => {
    const server = fakeServer();
    syncStore.fetcher = server.handler;

    const note = notesStore.create('<div>version locale</div>');
    note.title = 'Locale';
    await notesStore.update(note.id, { title: 'Locale' });
    await syncStore.notifyLocalChange(note.id, false);

    // le serveur a déjà une version plus récente
    server.notes.set(note.id, {
      id: note.id,
      title: 'Version serveur',
      md: 'version serveur',
      color: 'default',
      folderId: null,
      pinned: false,
      hidden: false,
      remindAt: null,
      createdAt: 1,
      updatedAt: Date.now() + 60_000,
      deleted: false,
      serverUpdatedAt: 5
    });

    await syncStore.syncNow();

    expect(notesStore.byId(note.id)?.title).toBe('Version serveur');
    const copy = notesStore.notes.find((n) => n.title.endsWith('(conflit)'));
    expect(copy).toBeTruthy();
    expect(notesStore.notes.length).toBe(2);
  });

  it('ne fait rien sans session', async () => {
    localStorage.removeItem('notes:cloud:session');
    const server = fakeServer();
    syncStore.fetcher = server.handler;

    const note = notesStore.create('<div>x</div>');
    await syncStore.notifyLocalChange(note.id, false);
    await syncStore.syncNow();

    expect(server.notes.size).toBe(0);
    expect(syncStore.status).toBe('idle');
  });

  it('compte les notes en attente', async () => {
    const server = fakeServer();
    syncStore.fetcher = server.handler;

    const a = notesStore.create('<div>a</div>');
    const b = notesStore.create('<div>b</div>');
    await syncStore.notifyLocalChange(a.id, false);
    await syncStore.notifyLocalChange(b.id, false);
    expect(syncStore.pending).toBe(2);

    await syncStore.syncNow();
    expect(syncStore.pending).toBe(0);
  });

  it('téléverse les médias et les remplace par une pièce jointe', async () => {
    const server = fakeServer();
    syncStore.fetcher = server.handler;

    const png =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const note = notesStore.create(`<div><img src="${png}" alt="" /></div>`);
    await syncStore.notifyLocalChange(note.id, false);

    await syncStore.syncNow();

    const stored = server.notes.get(note.id);
    expect(stored?.md).toMatch(/\/v1\/attachments\/[a-f0-9]{64}/);
    expect(stored?.md).not.toContain('data:image');
    expect(server.attachments.size).toBe(1);
  });

  it('re-localise une pièce jointe distante en data: à la réception', async () => {
    const server = fakeServer();
    syncStore.fetcher = server.handler;

    const png =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    // le serveur a déjà la pièce jointe
    const up = await server.handler(
      config,
      '/v1/attachments',
      { method: 'POST', body: await (await fetch(png)).blob(), headers: { 'content-type': 'image/png' } }
    );
    const { url } = (await up.json()) as { url: string };

    server.notes.set('avec-image', {
      id: 'avec-image',
      title: 'Image',
      md: `![photo](${url})`,
      color: 'default',
      folderId: null,
      pinned: false,
      hidden: false,
      remindAt: null,
      createdAt: 1,
      updatedAt: 2,
      deleted: false,
      serverUpdatedAt: 3
    });

    await syncStore.syncNow();

    const local = notesStore.byId('avec-image');
    expect(local?.html).toContain('src="data:image/png');
    expect(local?.html).not.toContain('/v1/attachments/');
  });
});
