import type {
  Folder,
  LayoutKey,
  Note,
  NoteColorKey,
  SortKey,
  TaskEntry,
  TextSizeKey,
  ThemeKey
} from './types';
import { deleteAllNotes, deleteNote, loadAllNotes, saveNote, saveNotes } from './db';
import { plainText } from './format';
import { parseTasks, setTaskTextAt, taskLineHtml, toggleTaskAt } from './tasks';

export function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
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
  const base = {
    kind: 'text' as const,
    color: 'default' as NoteColorKey,
    pinned: false,
    folderId: null,
    hidden: false,
    tags: []
  };

  const welcome: Note = {
    ...base,
    id: uid(),
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
      '<div>• Maintenez une carte pour sélectionner, épingler ou supprimer</div>' +
      '<div>• Le bouton case transforme la ligne courante en case à cocher : on peut mélanger texte et tâches</div>' +
      '<div>• Les cases cochées se retrouvent dans l’onglet Tâches</div>'
  };

  const tasks: Note = {
    ...base,
    id: uid(),
    title: 'À faire',
    createdAt: now - 40 * min,
    updatedAt: now - 40 * min,
    deletedAt: null,
    items: [],
    html: [
      taskLineHtml('Bienvenue dans Tâches !'),
      taskLineHtml('Appuyez sur une tâche pour modifier son texte.'),
      taskLineHtml('Cochez la case pour marquer une tâche terminée.'),
      taskLineHtml('Le bouton + crée une nouvelle note.')
    ].join('')
  };

  const ideas: Note = {
    ...base,
    id: uid(),
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
    title: 'Liste de courses',
    createdAt: now - 9 * 24 * 60 * min,
    updatedAt: now - 9 * 24 * 60 * min,
    deletedAt: null,
    items: [],
    html: [
      taskLineHtml('Lait'),
      taskLineHtml('Pain complet'),
      taskLineHtml('Café', true),
      taskLineHtml('Tomates')
    ].join('')
  };

  const wifi: Note = {
    ...base,
    id: uid(),
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
  /** 'all' | 'none' (sans catégorie) | id de dossier */
  activeCategory = $state<string>('all');

  sort = $state<SortKey>(readString('notes:sort', ['updated', 'created', 'title'], 'updated'));
  theme = $state<ThemeKey>(readString('notes:theme', ['system', 'light', 'dark'], 'system'));
  textSize = $state<TextSizeKey>(
    readString('notes:textSize', ['small', 'medium', 'large'], 'medium')
  );
  layout = $state<LayoutKey>(readString('notes:layout', ['grid', 'list'], 'grid'));
  quickNotes = $state(readBool('notes:quickNotes', true));
  highPriorityReminders = $state(readBool('notes:reminders', false));
  showHidden = $state(readBool('notes:showHidden', false));

  private started = false;

  get active(): Note[] {
    return this.notes.filter((n) => !n.deletedAt && (this.showHidden || !n.hidden));
  }

  get trash(): Note[] {
    return this.notes
      .filter((n) => n.deletedAt)
      .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
  }

  get hiddenCount(): number {
    return this.notes.filter((n) => !n.deletedAt && n.hidden).length;
  }

  get sorted(): Note[] {
    const cmp = this.comparator(this.sort);
    const list = this.active;
    return [...list.filter((n) => n.pinned).sort(cmp), ...list.filter((n) => !n.pinned).sort(cmp)];
  }

  get visibleNotes(): Note[] {
    const list = this.sorted;
    if (this.activeCategory === 'all') return list;
    if (this.activeCategory === 'none') return list.filter((n) => !n.folderId);
    return list.filter((n) => n.folderId === this.activeCategory);
  }

  /** Chips de catégories : Tous, dossiers, Sans catégorie. */
  get categories(): { key: string; label: string; count: number }[] {
    const list = this.active;
    return [
      { key: 'all', label: 'Tous', count: list.length },
      ...this.folders.map((f) => ({
        key: f.id,
        label: f.name,
        count: list.filter((n) => n.folderId === f.id).length
      })),
      { key: 'none', label: 'Sans catégorie', count: list.filter((n) => !n.folderId).length }
    ];
  }

  /** Toutes les cases à cocher de toutes les notes, non terminées d'abord. */
  get tasks(): TaskEntry[] {
    const out: TaskEntry[] = [];
    for (const note of this.sorted) {
      for (const task of parseTasks(note.html)) {
        if (!task.text) continue;
        out.push({
          noteId: note.id,
          index: task.index,
          text: task.text,
          done: task.done,
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

      // Migration : anciennes listes (kind + items) → lignes de cases dans le texte.
      let migrated = false;
      const normalized = notes.map((n) => {
        let html = n.html ?? '';
        if (n.kind === 'checklist' && (n.items?.length ?? 0) > 0) {
          html = n.items.map((item) => taskLineHtml(item.text, item.done)).join('');
          migrated = true;
        }
        const next: Note = {
          ...n,
          kind: 'text',
          items: [],
          html,
          folderId: n.folderId ?? null,
          hidden: n.hidden ?? false
        };
        if (n.kind !== 'text' || n.hidden === undefined || n.folderId === undefined) {
          migrated = true;
        }
        return next;
      });

      this.notes = normalized;
      if (migrated) await saveNotes(normalized);
    } catch (error) {
      console.error('Chargement des notes impossible', error);
    } finally {
      this.ready = true;
      this.applyTheme();
      this.applyPrefs();
      this.watchSystemTheme();
    }
  }

  create(initialHtml = '', patch: Partial<Note> = {}): Note {
    const now = Date.now();
    const note: Note = {
      id: uid(),
      kind: 'text',
      title: '',
      html: initialHtml,
      items: [],
      color: 'default',
      pinned: false,
      folderId:
        this.activeCategory !== 'all' && this.activeCategory !== 'none'
          ? this.activeCategory
          : null,
      hidden: false,
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
      tags: [...note.tags],
      pinned: false,
      hidden: false,
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

  toggleTask(noteId: string, index: number): void {
    const note = this.notes.find((n) => n.id === noteId);
    if (!note) return;
    void this.update(noteId, { html: toggleTaskAt(note.html, index) });
  }

  setTaskText(noteId: string, index: number, text: string): void {
    const note = this.notes.find((n) => n.id === noteId);
    if (!note) return;
    void this.update(noteId, { html: setTaskTextAt(note.html, index, text) });
  }

  pinMany(ids: string[]): void {
    const allPinned = ids.every((id) => this.notes.find((n) => n.id === id)?.pinned);
    for (const id of ids) void this.update(id, { pinned: !allPinned });
  }

  moveMany(ids: string[], folderId: string | null): void {
    for (const id of ids) void this.update(id, { folderId });
  }

  hideMany(ids: string[]): void {
    for (const id of ids) void this.update(id, { hidden: true });
  }

  trashMany(ids: string[]): void {
    const now = Date.now();
    for (const id of ids) void this.update(id, { deletedAt: now });
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

  setShowHidden(value: boolean): void {
    this.showHidden = value;
    write('notes:showHidden', value ? '1' : '0');
  }

  createFolder(name: string): Folder | null {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const folder: Folder = { id: uid(), name: trimmed };
    this.folders = [...this.folders, folder];
    write('notes:folders', JSON.stringify(this.folders));
    return folder;
  }

  deleteFolder(id: string): void {
    this.folders = this.folders.filter((f) => f.id !== id);
    write('notes:folders', JSON.stringify(this.folders));
    if (this.activeCategory === id) this.activeCategory = 'all';
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
