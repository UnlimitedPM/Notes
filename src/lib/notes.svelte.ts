import type {
  ChecklistItem,
  Folder,
  LayoutKey,
  Note,
  NoteColorKey,
  NoteKind,
  SortKey,
  TaskEntry,
  TextSizeKey,
  ThemeKey
} from './types';
import { deleteAllNotes, deleteNote, loadAllNotes, saveNote, saveNotes } from './db';
import { plainText } from './format';

export function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function cloneItems(items: ChecklistItem[]): ChecklistItem[] {
  return items.map((i) => ({ id: i.id, text: i.text, done: i.done }));
}

function readString<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const value = localStorage.getItem(key) as T | null;
    return value && allowed.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function readBool(key: string, fallback: boolean): boolean {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === '1';
  } catch {
    return fallback;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* stockage indisponible */
  }
}

function readFolders(): Folder[] {
  try {
    const raw = localStorage.getItem('notes:folders');
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((f): f is Folder => !!f && typeof f === 'object' && typeof (f as Folder).id === 'string')
      .map((f) => ({ id: f.id, name: String(f.name ?? 'Dossier') }));
  } catch {
    return [];
  }
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function compact(value: string): string {
  return normalize(value).replace(/[^a-z0-9]+/g, '');
}

function seedNotes(): Note[] {
  const now = Date.now();
  const min = 60_000;
  const base = { color: 'default' as NoteColorKey, pinned: false, folderId: null, tags: [] };

  const welcome: Note = {
    ...base,
    id: uid(),
    kind: 'text',
    title: 'Bienvenue dans Notes',
    createdAt: now - 3 * min,
    updatedAt: now - 3 * min,
    deletedAt: null,
    items: [],
    html:
      '<div>Un carnet rapide, noir et léger, qui fonctionne hors ligne sur Android et iPhone.</div>' +
      '<div><br></div>' +
      '<div>• Appuyez sur + pour créer une note</div>' +
      '<div>• Touchez une note pour la lire, touchez le texte pour l’éditer</div>' +
      '<div>• Maintenez une carte pour la colorer, la déplacer ou la supprimer</div>' +
      '<div>• Le bouton en forme de case transforme la note en liste</div>' +
      '<div>• Les cases cochées se retrouvent dans l’onglet Tâches</div>'
  };

  const tasks: Note = {
    ...base,
    id: uid(),
    kind: 'checklist',
    title: 'À faire',
    createdAt: now - 40 * min,
    updatedAt: now - 40 * min,
    deletedAt: null,
    html: '',
    items: [
      { id: uid(), text: 'Bienvenue dans Tâches !', done: false },
      { id: uid(), text: 'Appuyez sur une tâche pour modifier son texte.', done: false },
      { id: uid(), text: 'Cochez la case pour marquer une tâche terminée.', done: false },
      { id: uid(), text: 'Le bouton + crée une nouvelle liste.', done: true }
    ]
  };

  const ideas: Note = {
    ...base,
    id: uid(),
    kind: 'text',
    title: 'Idées',
    createdAt: now - 26 * 60 * min,
    updatedAt: now - 26 * 60 * min,
    deletedAt: null,
    items: [],
    html:
      '<div>— Thème AMOLED fidèle à MIUI</div>' +
      '<div>— Synchro auto-hébergée plus tard</div>' +
      '<div>— Import / export JSON</div>' +
      '<div>— Notes vocales et dessin</div>'
  };

  const shopping: Note = {
    ...base,
    id: uid(),
    kind: 'checklist',
    title: 'Liste de courses',
    createdAt: now - 9 * 24 * 60 * min,
    updatedAt: now - 9 * 24 * 60 * min,
    deletedAt: null,
    html: '',
    items: [
      { id: uid(), text: 'Lait', done: false },
      { id: uid(), text: 'Pain complet', done: false },
      { id: uid(), text: 'Café', done: true },
      { id: uid(), text: 'Tomates', done: false }
    ]
  };

  const wifi: Note = {
    ...base,
    id: uid(),
    kind: 'text',
    title: 'Wi-Fi maison',
    createdAt: now - 31 * 24 * 60 * min,
    updatedAt: now - 31 * 24 * 60 * min,
    deletedAt: null,
    items: [],
    html: '<div>Réseau : Maison</div><div>Mot de passe : à garder ici</div>'
  };

  return [welcome, tasks, ideas, shopping, wifi];
}

class NotesStore {
  notes = $state<Note[]>([]);
  ready = $state(false);
  folders = $state<Folder[]>(readFolders());
  activeFolderId = $state<string | null>(null);

  sort = $state<SortKey>(readString('notes:sort', ['updated', 'created', 'title'], 'updated'));
  theme = $state<ThemeKey>(readString('notes:theme', ['system', 'light', 'dark'], 'system'));
  textSize = $state<TextSizeKey>(
    readString('notes:textSize', ['small', 'medium', 'large'], 'medium')
  );
  layout = $state<LayoutKey>(readString('notes:layout', ['grid', 'list'], 'grid'));
  quickNotes = $state(readBool('notes:quickNotes', true));
  highPriorityReminders = $state(readBool('notes:reminders', false));

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

  get visibleNotes(): Note[] {
    const list = this.sorted;
    return this.activeFolderId ? list.filter((n) => n.folderId === this.activeFolderId) : list;
  }

  get activeFolder(): Folder | null {
    return this.folders.find((f) => f.id === this.activeFolderId) ?? null;
  }

  /** Toutes les tâches (cases à cocher) de toutes les listes, non terminées d'abord. */
  get tasks(): TaskEntry[] {
    const out: TaskEntry[] = [];
    for (const note of this.sorted) {
      if (note.kind !== 'checklist') continue;
      for (const item of note.items) {
        if (!item.text.trim()) continue;
        out.push({
          noteId: note.id,
          itemId: item.id,
          text: item.text,
          done: item.done,
          noteTitle: note.title,
          noteUpdatedAt: note.updatedAt
        });
      }
    }
    return [...out.filter((t) => !t.done), ...out.filter((t) => t.done)];
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
    const base = this.visibleNotes;
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
        write('notes:seed', '1');
        await saveNotes(notes);
      }
      // Compatibilité avec d'anciennes données
      this.notes = notes.map((n) => ({ ...n, folderId: n.folderId ?? null }));
    } catch (error) {
      console.error('Chargement des notes impossible', error);
    } finally {
      this.ready = true;
      this.applyTheme();
      this.applyPrefs();
      this.watchSystemTheme();
    }
  }

  create(kind: NoteKind, patch: Partial<Note> = {}): Note {
    const now = Date.now();
    const note: Note = {
      id: uid(),
      kind,
      title: '',
      html: '',
      items: kind === 'checklist' ? [{ id: uid(), text: '', done: false }] : [],
      color: 'default',
      pinned: false,
      folderId: this.activeFolderId,
      tags: [],
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      ...patch
    };
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

  toggleTask(noteId: string, itemId: string): void {
    const note = this.notes.find((n) => n.id === noteId);
    if (!note) return;
    const items = note.items.map((i) => (i.id === itemId ? { ...i, done: !i.done } : { ...i }));
    void this.update(noteId, { items });
  }

  setTaskText(noteId: string, itemId: string, text: string): void {
    const note = this.notes.find((n) => n.id === noteId);
    if (!note) return;
    const items = note.items.map((i) => (i.id === itemId ? { ...i, text } : { ...i }));
    void this.update(noteId, { items });
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
    write('notes:sort', sort);
  }

  setTheme(theme: ThemeKey): void {
    this.theme = theme;
    write('notes:theme', theme);
    this.applyTheme();
  }

  setTextSize(size: TextSizeKey): void {
    this.textSize = size;
    write('notes:textSize', size);
    this.applyPrefs();
  }

  setLayout(layout: LayoutKey): void {
    this.layout = layout;
    write('notes:layout', layout);
  }

  setQuickNotes(value: boolean): void {
    this.quickNotes = value;
    write('notes:quickNotes', value ? '1' : '0');
  }

  setHighPriorityReminders(value: boolean): void {
    this.highPriorityReminders = value;
    write('notes:reminders', value ? '1' : '0');
  }

  createFolder(name: string): Folder | null {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const folder: Folder = { id: uid(), name: trimmed };
    this.folders = [...this.folders, folder];
    write('notes:folders', JSON.stringify(this.folders));
    return folder;
  }

  renameFolder(id: string, name: string): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    this.folders = this.folders.map((f) => (f.id === id ? { ...f, name: trimmed } : f));
    write('notes:folders', JSON.stringify(this.folders));
  }

  deleteFolder(id: string): void {
    this.folders = this.folders.filter((f) => f.id !== id);
    write('notes:folders', JSON.stringify(this.folders));
    if (this.activeFolderId === id) this.activeFolderId = null;
    for (const note of this.notes.filter((n) => n.folderId === id)) {
      void this.update(note.id, { folderId: null });
    }
  }

  setNoteFolder(noteId: string, folderId: string | null): void {
    void this.update(noteId, { folderId });
  }

  countFolder(folderId: string | null): number {
    const list = this.active;
    return folderId ? list.filter((n) => n.folderId === folderId).length : list.length;
  }

  applyTheme(): void {
    if (typeof document === 'undefined') return;
    const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    const resolved = this.theme === 'system' ? (dark ? 'dark' : 'light') : this.theme;
    document.documentElement.dataset.theme = resolved;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#000000' : '#ffffff');
  }

  applyPrefs(): void {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.textSize = this.textSize;
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
