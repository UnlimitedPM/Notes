import type { ChecklistItem, Note, NoteColorKey, NoteKind } from './types';
import { deleteAllNotes, deleteNote, loadAllNotes, saveNote, saveNotes } from './db';
import { plainText } from './format';

export type SortKey = 'updated' | 'created' | 'title';
export type ThemeKey = 'system' | 'light' | 'dark';

export function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function cloneItems(items: ChecklistItem[]): ChecklistItem[] {
  return items.map((i) => ({ id: i.id, text: i.text, done: i.done }));
}

function readSetting<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const value = localStorage.getItem(key) as T | null;
    return value && allowed.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function writeSetting(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* stockage indisponible */
  }
}

/** Minuscules sans accents, pour une recherche tolérante. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Version sans ponctuation : permet à « wifi » de trouver « Wi-Fi ». */
function compact(value: string): string {
  return normalize(value).replace(/[^a-z0-9]+/g, '');
}

function newNote(kind: NoteKind, now = Date.now()): Note {
  return {
    id: uid(),
    kind,
    title: '',
    html: '',
    items: kind === 'checklist' ? [{ id: uid(), text: '', done: false }] : [],
    color: 'default',
    pinned: false,
    tags: [],
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  };
}

function seedNotes(): Note[] {
  const now = Date.now();
  const min = 60_000;

  const welcome: Note = {
    ...newNote('text', now - 2 * min),
    title: 'Bienvenue dans Notes',
    color: 'yellow',
    pinned: true,
    html:
      '<div>Un carnet rapide, façon MIUI, qui fonctionne hors ligne sur Android et iPhone.</div>' +
      '<div><br></div>' +
      '<div>• <b>+</b> pour créer une note</div>' +
      '<div>• Maintenir une note pour l’épingler, la colorer ou la supprimer</div>' +
      '<div>• <b>Aa</b> en bas pour mettre en forme le texte</div>' +
      '<div>• Le bouton liste transforme la note en cases à cocher</div>' +
      '<div>• Le bouton appareil photo insère une image</div>' +
      '<div><br></div>' +
      '<div>Tout est stocké sur l’appareil. La synchronisation auto-hébergée viendra ensuite.</div>'
  };

  const shopping: Note = {
    ...newNote('checklist', now - 26 * min),
    title: 'Liste de courses',
    color: 'green',
    items: [
      { id: uid(), text: 'Lait', done: false },
      { id: uid(), text: 'Pain complet', done: false },
      { id: uid(), text: 'Café', done: true },
      { id: uid(), text: 'Tomates', done: false },
      { id: uid(), text: 'Huile d’olive', done: false }
    ]
  };

  const ideas: Note = {
    ...newNote('text', now - 3 * 60 * min),
    title: 'Idées',
    color: 'blue',
    html:
      '<div>— Vue grille avec épinglage</div>' +
      '<div>— Recherche instantanée</div>' +
      '<div>— Mode sombre automatique</div>' +
      '<div>— Sauvegarde locale IndexedDB</div>' +
      '<div>— Synchro à ajouter plus tard</div>'
  };

  const wifi: Note = {
    ...newNote('text', now - 2 * 24 * 60 * min),
    title: 'Wi-Fi maison',
    color: 'gray',
    html: '<div>Réseau : Maison-5G</div><div>Mot de passe : à garder ici</div>'
  };

  return [welcome, shopping, ideas, wifi];
}

class NotesStore {
  notes = $state<Note[]>([]);
  ready = $state(false);
  sort = $state<SortKey>(readSetting('notes:sort', ['updated', 'created', 'title'], 'updated'));
  theme = $state<ThemeKey>(readSetting('notes:theme', ['system', 'light', 'dark'], 'system'));

  private started = false;

  get active(): Note[] {
    return this.notes.filter((n) => !n.deletedAt);
  }

  get trash(): Note[] {
    return this.notes
      .filter((n) => n.deletedAt)
      .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
  }

  get sorted(): Note[] {
    const cmp = this.comparator(this.sort);
    const list = this.active;
    return [...list.filter((n) => n.pinned).sort(cmp), ...list.filter((n) => !n.pinned).sort(cmp)];
  }

  private comparator(sort: SortKey) {
    if (sort === 'title') {
      return (a: Note, b: Note) =>
        (a.title || 'Sans titre').localeCompare(b.title || 'Sans titre', 'fr');
    }
    if (sort === 'created') {
      return (a: Note, b: Note) => b.createdAt - a.createdAt;
    }
    return (a: Note, b: Note) => b.updatedAt - a.updatedAt;
  }

  search(query: string): Note[] {
    const base = this.sorted;
    const term = query.trim();
    if (!term) return base;

    const loose = normalize(term);
    const compactTerm = compact(term);
    return base.filter((n) => {
      const haystack = `${n.title}\n${n.tags.join(' ')}\n${plainText(n)}`;
      return normalize(haystack).includes(loose) || compact(haystack).includes(compactTerm);
    });
  }

  async init(): Promise<void> {
    if (this.started) return;
    this.started = true;

    try {
      let notes = await loadAllNotes();
      let seeded = false;
      try {
        seeded = localStorage.getItem('notes:seed') === '1';
      } catch {
        /* ignore */
      }
      if (notes.length === 0 && !seeded) {
        notes = seedNotes();
        seeded = true;
        writeSetting('notes:seed', '1');
        await saveNotes(notes);
      }
      this.notes = notes;
    } catch (error) {
      console.error('Chargement des notes impossible', error);
    } finally {
      this.ready = true;
      this.applyTheme();
      this.watchSystemTheme();
    }
  }

  create(kind: NoteKind, patch: Partial<Note> = {}): Note {
    const now = Date.now();
    const note: Note = { ...newNote(kind, now), ...patch };
    this.notes.unshift(note);
    void saveNote(note);
    return note;
  }

  async update(id: string, patch: Partial<Note>): Promise<void> {
    const index = this.notes.findIndex((n) => n.id === id);
    if (index === -1) return;
    const next: Note = { ...this.notes[index], ...patch };
    if (!('updatedAt' in patch)) next.updatedAt = Date.now();
    this.notes[index] = next;
    await saveNote(next);
  }

  duplicate(note: Note): Note {
    const now = Date.now();
    const copy: Note = {
      ...note,
      id: uid(),
      title: note.title ? `${note.title} (copie)` : '',
      items: cloneItems(note.items),
      tags: [...note.tags],
      pinned: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };
    this.notes.unshift(copy);
    void saveNote(copy);
    return copy;
  }

  setColor(id: string, color: NoteColorKey): void {
    void this.update(id, { color });
  }

  togglePin(id: string): void {
    const note = this.notes.find((n) => n.id === id);
    if (note) void this.update(id, { pinned: !note.pinned });
  }

  trashNote(id: string): void {
    void this.update(id, { deletedAt: Date.now() });
  }

  restore(id: string): void {
    void this.update(id, { deletedAt: null });
  }

  purge(id: string): void {
    this.notes = this.notes.filter((n) => n.id !== id);
    void deleteNote(id);
  }

  emptyTrash(): void {
    for (const note of this.trash) void deleteNote(note.id);
    this.notes = this.notes.filter((n) => !n.deletedAt);
  }

  async purgeEverything(): Promise<void> {
    this.notes = [];
    this.started = false;
    await deleteAllNotes();
  }

  setSort(sort: SortKey): void {
    this.sort = sort;
    writeSetting('notes:sort', sort);
  }

  setTheme(theme: ThemeKey): void {
    this.theme = theme;
    writeSetting('notes:theme', theme);
    this.applyTheme();
  }

  applyTheme(): void {
    if (typeof document === 'undefined') return;
    const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    const resolved = this.theme === 'system' ? (dark ? 'dark' : 'light') : this.theme;
    document.documentElement.dataset.theme = resolved;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0d0d0f' : '#f4f4f6');
  }

  private watchSystemTheme(): void {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', () => {
      if (this.theme === 'system') this.applyTheme();
    });
  }
}

export const notesStore = new NotesStore();
