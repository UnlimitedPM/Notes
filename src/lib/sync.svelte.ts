import { authedFetch, readConfig, readSession, signOut } from './cloud/oidc';
import { dequeueNote, loadOutbox, queueNote, readMeta, writeMeta } from './db';
import { notesStore } from './notes.svelte';

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'pending' | 'error';

type RemoteNote = {
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
};

const SINCES = 'sync:notes';
const INTERVAL_MS = 60_000;

/**
 * Moteur de synchronisation : file d'attente locale (IndexedDB) + curseur serveur.
 * - push : tout ce qui est en attente (PUT / DELETE)
 * - pull : `?since=` puis fusion ; les pierres tombales suppriment localement
 * - conflit (409) : la version locale est conservée sous « (conflit) »
 */
class SyncStore {
  status = $state<SyncStatus>('off');
  pending = $state(0);
  lastSyncAt = $state<number | null>(null);
  error = $state<string | null>(null);
  online = $state(true);

  private running = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;
  private unsubscribe: (() => void) | null = null;
  private started = false;

  /** Remplaçable dans les tests (faux serveur en mémoire). */
  fetcher: typeof authedFetch = authedFetch;

  get configured(): boolean {
    return readConfig() !== null;
  }

  get signedIn(): boolean {
    return readSession() !== null;
  }

  get label(): string {
    if (!this.configured) return 'Non configuré';
    if (!this.signedIn) return 'Non connecté';
    if (this.status === 'syncing') return 'Synchronisation…';
    if (this.status === 'error') return 'Erreur';
    if (this.pending > 0) return `${this.pending} en attente`;
    if (this.lastSyncAt) return 'Synchronisé';
    return 'Prêt';
  }

  /** Démarre le moteur (au lancement de l'app). */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.online = typeof navigator === 'undefined' ? true : navigator.onLine;

    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    document.addEventListener('visibilitychange', this.handleVisibility);

    this.unsubscribe = notesStore.onChange((id, deleted) => void this.notifyLocalChange(id, deleted));

    this.interval = setInterval(() => {
      if (!document.hidden) void this.syncNow();
    }, INTERVAL_MS);

    void this.refreshPending();
    if (this.configured && this.signedIn) {
      this.status = 'idle';
      this.schedule(800);
    }
  }

  stop(): void {
    if (this.interval) clearInterval(this.interval);
    if (this.timer) clearTimeout(this.timer);
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    this.unsubscribe?.();
    this.interval = null;
    this.timer = null;
    this.unsubscribe = null;
    this.started = false;
    this.status = 'off';
  }

  private handleOnline = () => {
    this.online = true;
    this.schedule(500);
  };

  private handleOffline = () => {
    this.online = false;
  };

  private handleVisibility = () => {
    if (!document.hidden) this.schedule(500);
  };

  private schedule(delay = 1200): void {
    if (!this.configured || !this.signedIn) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.syncNow(), delay);
  }

  async refreshPending(): Promise<void> {
    try {
      const entries = await loadOutbox();
      this.pending = entries.length;
    } catch {
      this.pending = 0;
    }
  }

  /** À appeler après une modification locale (les mutations du store le font). */
  async notifyLocalChange(id: string, deleted: boolean): Promise<void> {
    await queueNote(id, deleted);
    await this.refreshPending();
    this.schedule();
  }

  async syncNow(): Promise<void> {
    const config = readConfig();
    if (!config || !readSession()) {
      this.status = this.configured ? 'idle' : 'off';
      return;
    }
    if (this.running) return;
    if (!this.online) {
      this.status = 'pending';
      await this.refreshPending();
      return;
    }

    this.running = true;
    this.status = 'syncing';
    this.error = null;

    try {
      await this.push(config);
      await this.pull(config);
      this.lastSyncAt = Date.now();
      await this.refreshPending();
      this.status = this.pending > 0 ? 'pending' : 'idle';
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      this.status = 'error';
    } finally {
      this.running = false;
    }
  }

  private async push(config: ReturnType<typeof readConfig>): Promise<void> {
    if (!config) return;
    const entries = await loadOutbox();
    for (const entry of entries) {
      const note = notesStore.byId(entry.id);

      if (entry.deleted || !note) {
        const res = await this.fetcher(config, `/v1/notes/${encodeURIComponent(entry.id)}`, {
          method: 'DELETE'
        });
        if (res && (res.ok || res.status === 404)) await dequeueNote(entry.id);
        else if (res?.status === 401) throw new Error('Session expirée');
        continue;
      }

      const body = {
        title: note.title,
        md: note.md ?? '',
        color: note.color,
        folderId: note.folderId,
        pinned: note.pinned,
        hidden: note.hidden,
        remindAt: note.remindAt,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        rev: 0
      };

      const res = await this.fetcher(config, `/v1/notes/${encodeURIComponent(note.id)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res) throw new Error('Session expirée');
      if (res.status === 401) throw new Error('Session expirée');
      if (res.status === 409) {
        const data = (await res.json()) as { note: RemoteNote };
        // la version du serveur est plus récente : on garde la nôtre à part
        await notesStore.keepLocalConflictCopy(note);
        await notesStore.applyRemoteNote(data.note);
        await dequeueNote(entry.id);
        continue;
      }
      if (!res.ok) throw new Error(`Écriture refusée (${res.status})`);
      await dequeueNote(entry.id);
    }
  }

  private async pull(config: ReturnType<typeof readConfig>): Promise<void> {
    if (!config) return;
    let since = (await readMeta<number>(SINCES)) ?? 0;

    for (let round = 0; round < 20; round += 1) {
      const res = await this.fetcher(config, `/v1/notes?since=${since}&limit=200`);
      if (!res) throw new Error('Session expirée');
      if (res.status === 401) throw new Error('Session expirée');
      if (!res.ok) throw new Error(`Lecture refusée (${res.status})`);

      const data = (await res.json()) as {
        notes: RemoteNote[];
        nextSince: number;
        hasMore: boolean;
      };

      for (const remote of data.notes) {
        if (remote.deleted) await notesStore.removeRemote(remote.id);
        else await notesStore.applyRemoteNote(remote);
      }

      since = data.nextSince;
      await writeMeta(SINCES, since);
      if (!data.hasMore) break;
    }
  }

  async signOut(): Promise<void> {
    signOut();
    this.status = 'idle';
    this.lastSyncAt = null;
  }

  /** Oublie le curseur (utile après avoir vidé le serveur). */
  async resetCursor(): Promise<void> {
    await writeMeta(SINCES, 0);
  }
}

export const syncStore = new SyncStore();
