import type { Note } from './types';

const DB_NAME = 'notes-app';
const DB_VERSION = 2;
const STORE = 'notes';
const OUTBOX = 'outbox';
const META = 'meta';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(OUTBOX)) {
        db.createObjectStore(OUTBOX, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(META)) {
        db.createObjectStore(META, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

/** Les objets réactifs Svelte ne sont pas clonables par IndexedDB : on repasse par du JSON. */
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function loadAllNotes(): Promise<Note[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve((request.result as Note[]).map(plain));
    request.onerror = () => reject(request.error);
  });
}

export async function saveNote(note: Note): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(plain(note));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveNotes(notes: Note[]): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const note of notes) store.put(plain(note));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteNote(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteAllNotes(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---- File d'attente de synchronisation -------------------------------------

export type OutboxEntry = {
  /** identifiant de la note */
  id: string;
  /** true = suppression à propager */
  deleted: boolean;
  at: number;
};

export async function queueNote(id: string, deleted: boolean): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OUTBOX, 'readwrite');
    tx.objectStore(OUTBOX).put({ id, deleted, at: Date.now() } satisfies OutboxEntry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadOutbox(): Promise<OutboxEntry[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OUTBOX, 'readonly');
    const request = tx.objectStore(OUTBOX).getAll();
    request.onsuccess = () => resolve((request.result as OutboxEntry[]).map(plain));
    request.onerror = () => reject(request.error);
  });
}

export async function dequeueNote(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OUTBOX, 'readwrite');
    tx.objectStore(OUTBOX).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearOutbox(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OUTBOX, 'readwrite');
    tx.objectStore(OUTBOX).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---- Petites valeurs persistées (curseurs de synchro) ----------------------

export async function readMeta<T>(key: string): Promise<T | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META, 'readonly');
    const request = tx.objectStore(META).get(key);
    request.onsuccess = () => {
      const row = request.result as { key: string; value: unknown } | undefined;
      resolve(row ? (row.value as T) : null);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function writeMeta(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META, 'readwrite');
    tx.objectStore(META).put({ key, value });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

