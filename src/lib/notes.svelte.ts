import type {
  Folder,
  LayoutKey,
  Note,
  NoteColorKey,
  SortKey,
  TaskItem,
  TextSizeKey,
  ThemeKey
} from './types';
import { deleteAllNotes, deleteNote, loadAllNotes, saveNote, saveNotes } from './db';
import { plainText } from './format';
import { htmlToMarkdown } from './markdown';
import { mdToHtml } from './md';
import { parseTasks, taskLineHtml } from './tasks';

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

function readTasks(): TaskItem[] {
  try {
    const raw = localStorage.getItem('notes:tasks');
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (t): t is TaskItem =>
          !!t && typeof t === 'object' && typeof (t as TaskItem).id === 'string'
      )
      .map((t) => ({
        id: t.id,
        text: String(t.text ?? ''),
        done: !!t.done,
        createdAt: Number(t.createdAt ?? Date.now()),
        updatedAt: Number(t.updatedAt ?? Date.now())
      }));
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

function seedTasks(now = Date.now()): TaskItem[] {
  const min = 60_000;
  const make = (text: string, done: boolean, ageMin: number): TaskItem => ({
    id: uid(),
    text,
    done,
    createdAt: now - ageMin * min,
    updatedAt: now - ageMin * min
  });
  return [
    make('Bienvenue dans Tâches !', false, 40),
    make('Appuyez sur une tâche pour modifier son texte.', false, 39),
    make('Cochez la case pour marquer une tâche terminée.', false, 38),
    make('Le bouton + ajoute une tâche depuis cet onglet.', false, 37),
    make('Liste de courses : lait', false, 30),
    make('Pain complet', false, 29),
    make('Tomates', false, 28),
    make('Café', true, 27)
  ];
}

function baseNote(now: number): Omit<Note, 'id' | 'title' | 'html' | 'createdAt' | 'updatedAt'> {
  return {
    kind: 'text',
    items: [],
    color: 'default' as NoteColorKey,
    pinned: false,
    folderId: null,
    hidden: false,
    remindAt: null,
    tags: [],
    deletedAt: null
  };
}

function seedNotes(): Note[] {
  const now = Date.now();
  const min = 60_000;

  const welcome: Note = {
    ...baseNote(now),
    id: uid(),
    title: 'Bienvenue dans Notes',
    createdAt: now - 3 * min,
    updatedAt: now - 3 * min,
    html:
      '<div>Un carnet rapide, noir et léger, qui fonctionne hors ligne sur Android et iPhone.</div>' +
      '<div><br></div>' +
      '<div>• Appuyez sur + pour créer une note</div>' +
      '<div>• Touchez une note pour la lire, touchez le texte pour l’éditer</div>' +
      '<div>• Maintenez une carte pour sélectionner, épingler ou supprimer</div>' +
      '<div>• Le bouton case transforme une ligne en case à cocher, dans la note</div>' +
      '<div>• L’onglet Tâches est une liste séparée : notes et tâches ne se mélangent pas</div>'
  };

  const ideas: Note = {
    ...baseNote(now),
    id: uid(),
    title: 'Idées',
    createdAt: now - 26 * 60 * min,
    updatedAt: now - 26 * 60 * min,
    html:
      '<div>— Thème AMOLED fidèle à MIUI</div>' +
      '<div>— Synchro auto-hébergée plus tard</div>' +
      '<div>— Import / export JSON</div>' +
      '<div>— Notes vocales et dessin</div>'
  };

  const wifi: Note = {
    ...baseNote(now),
    id: uid(),
    title: 'Wi-Fi maison',
    createdAt: now - 31 * 24 * 60 * min,
    updatedAt: now - 31 * 24 * 60 * min,
    html: '<div>Réseau : Maison</div><div>Mot de passe : à garder ici</div>'
  };

  return [welcome, ideas, wifi];
}

/** Une note qui ne contient que des lignes de cases n'est pas une note : ce sont des tâches. */
function isTaskOnlyNote(html: string): boolean {
  if (!html || !html.includes('task-line')) return false;
  if (/<img/i.test(html)) return false;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const lines = Array.from(doc.querySelectorAll('.task-line'));
  if (lines.length === 0) return false;
  for (const line of lines) line.remove();
  const rest = (doc.body.textContent ?? '').replace(/\u00a0/g, ' ').trim();
  return rest.length === 0;
}

const COLOR_KEYS: NoteColorKey[] = [
  'default',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
  'orange',
  'gray'
];

/** Validation souple d'une note venant d'un fichier JSON. */
function sanitizeNote(value: unknown): Note | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== 'string' || !raw.id) return null;
  const now = Date.now();
  const color = COLOR_KEYS.includes(raw.color as NoteColorKey)
    ? (raw.color as NoteColorKey)
    : 'default';
  return {
    id: raw.id,
    kind: 'text',
    title: typeof raw.title === 'string' ? raw.title : '',
    html: typeof raw.html === 'string' ? raw.html : '',
    items: [],
    color,
    pinned: !!raw.pinned,
    folderId: typeof raw.folderId === 'string' ? raw.folderId : null,
    hidden: !!raw.hidden,
    remindAt: typeof raw.remindAt === 'number' ? raw.remindAt : null,
    tags: Array.isArray(raw.tags) ? raw.tags.map((t) => String(t)) : [],
    createdAt: Number(raw.createdAt) || now,
    updatedAt: Number(raw.updatedAt) || now,
    deletedAt: typeof raw.deletedAt === 'number' ? raw.deletedAt : null
  };
}

function sanitizeTask(value: unknown): TaskItem | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== 'string' || !raw.id) return null;
  const now = Date.now();
  return {
    id: raw.id,
    text: typeof raw.text === 'string' ? raw.text : '',
    done: !!raw.done,
    createdAt: Number(raw.createdAt) || now,
    updatedAt: Number(raw.updatedAt) || now
  };
}

class NotesStore {  notes = $state<Note[]>([]);
  taskList = $state<TaskItem[]>(readTasks());
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
  private applyingRemote = false;
  private changeListeners = new Set<(id: string, deleted: boolean) => void>();

  /** Abonnement aux modifications locales (utilisé par le moteur de synchro). */
  onChange(fn: (id: string, deleted: boolean) => void): () => void {
    this.changeListeners.add(fn);
    return () => this.changeListeners.delete(fn);
  }

  private emit(id: string, deleted: boolean): void {
    if (this.applyingRemote) return;
    for (const fn of this.changeListeners) fn(id, deleted);
  }

  byId(id: string): Note | undefined {
    return this.notes.find((n) => n.id === id);
  }

  /** Recalcule le Markdown (forme canonique, envoyée au serveur et exportée). */
  private withMarkdown(note: Note): Note {
    try {
      return { ...note, md: htmlToMarkdown(note.html ?? '') };
    } catch {
      return note;
    }
  }

  /** Applique une note venue du serveur (Markdown → HTML de l'éditeur). */
  async applyRemoteNote(remote: {
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
  }): Promise<void> {
    this.applyingRemote = true;
    try {
      const index = this.notes.findIndex((n) => n.id === remote.id);
      const existing = index === -1 ? null : this.notes[index];
      if (existing && existing.updatedAt > remote.updatedAt) return;

      const note: Note = {
        id: remote.id,
        kind: 'text',
        title: remote.title,
        html: mdToHtml(remote.md ?? ''),
        md: remote.md ?? '',
        items: [],
        color: COLOR_KEYS.includes(remote.color as NoteColorKey)
          ? (remote.color as NoteColorKey)
          : 'default',
        pinned: !!remote.pinned,
        folderId: remote.folderId ?? null,
        hidden: !!remote.hidden,
        remindAt: remote.remindAt ?? null,
        tags: existing?.tags ?? [],
        createdAt: remote.createdAt,
        updatedAt: remote.updatedAt,
        deletedAt: null
      };

      if (index === -1) this.notes.unshift(note);
      else this.notes[index] = note;
      await saveNote(note);
    } finally {
      this.applyingRemote = false;
    }
  }

  /** Une note supprimée sur un autre appareil disparaît ici. */
  async removeRemote(id: string): Promise<void> {
    this.applyingRemote = true;
    try {
      this.notes = this.notes.filter((n) => n.id !== id);
      await deleteNote(id);
    } finally {
      this.applyingRemote = false;
    }
  }

  /** Conflit : notre version est gardée à part sous « (conflit) ». */
  async keepLocalConflictCopy(note: Note): Promise<void> {
    const now = Date.now();
    const copy: Note = {
      ...note,
      id: uid(),
      title: note.title ? `${note.title} (conflit)` : '(conflit)',
      tags: [...note.tags],
      pinned: false,
      hidden: false,
      remindAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };
    this.notes.unshift(copy);
    await saveNote(copy);
    this.emit(copy.id, false);
  }

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

  /** Onglet Tâches : uniquement les tâches, jamais les notes. */
  get allTasks(): TaskItem[] {
    const byDate = (a: TaskItem, b: TaskItem) => b.updatedAt - a.updatedAt;
    return [
      ...this.taskList.filter((t) => !t.done).sort(byDate),
      ...this.taskList.filter((t) => t.done).sort(byDate)
    ];
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

    // Demande au navigateur de ne pas évincer nos données (sinon IndexedDB peut être
    // vidé quand le stockage de l'appareil est plein).
    try {
      void navigator.storage?.persist?.();
    } catch {
      /* pas supporté */
    }

    try {
      let notes = await loadAllNotes();
      let seeded = false;
      try {
        seeded = localStorage.getItem('notes:seed') === '1';
      } catch {
        /* ignore */
      }
      if (notes.length === 0 && this.taskList.length === 0 && !seeded) {
        notes = seedNotes();
        this.taskList = seedTasks();
        this.persistTasks();
        seeded = true;
        write('notes:seed', '1');
        await saveNotes(notes);
      }

      // Migration : anciennes listes (kind + items) et notes composées uniquement de cases
      // deviennent des tâches autonomes ; les notes restantes sont nettoyées.
      const extracted: TaskItem[] = [];
      const kept: Note[] = [];

      for (const note of notes) {
        let html = note.html ?? '';
        if (note.kind === 'checklist' && (note.items?.length ?? 0) > 0) {
          html = note.items.map((item) => taskLineHtml(item.text, item.done)).join('');
        }

        if (isTaskOnlyNote(html)) {
          for (const task of parseTasks(html)) {
            if (!task.text) continue;
            extracted.push({
              id: uid(),
              text: task.text,
              done: task.done,
              createdAt: note.createdAt,
              updatedAt: note.updatedAt
            });
          }
          await deleteNote(note.id);
          continue;
        }

        kept.push({
          ...note,
          kind: 'text',
          items: [],
          html,
          folderId: note.folderId ?? null,
          hidden: note.hidden ?? false,
          remindAt: note.remindAt ?? null
        });
      }

      this.notes = kept;
      if (extracted.length) {
        this.taskList = [...this.taskList, ...extracted];
        this.persistTasks();
      }
      // Le Markdown est la forme canonique (export, synchro) : on le remplit pour
      // les notes créées avant son introduction.
      const missingMd = kept.filter((note) => typeof note.md !== 'string');
      if (missingMd.length) {
        const filled = kept.map((note) => this.withMarkdown(note));
        this.notes = filled;
        await saveNotes(filled);
      }
      if (extracted.length || kept.some((n, i) => n !== notes[i])) {
        await saveNotes(this.notes);
      }
    } catch (error) {
      console.error('Chargement des notes impossible', error);
    } finally {
      this.ready = true;
      this.applyTheme();
      this.applyPrefs();
      this.watchSystemTheme();
    }
  }

  private persistTasks(): void {
    write('notes:tasks', JSON.stringify(this.taskList));
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
      remindAt: null,
      tags: [],
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      ...patch
    };
    this.notes.unshift(note);
    const stored = this.withMarkdown(note);
    this.notes[0] = stored;
    void saveNote(stored);
    this.emit(stored.id, false);
    return stored;
  }

  async update(id: string, patch: Partial<Note>): Promise<void> {
    const index = this.notes.findIndex((n) => n.id === id);
    if (index === -1) return;
    const next: Note = { ...this.notes[index], ...patch };
    if (!('updatedAt' in patch)) next.updatedAt = Date.now();
    const stored = this.withMarkdown(next);
    this.notes[index] = stored;
    await saveNote(stored);
    this.emit(id, stored.deletedAt !== null && stored.deletedAt !== undefined);
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
      remindAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };
    this.notes.unshift(copy);
    const stored = this.withMarkdown(copy);
    this.notes[0] = stored;
    void saveNote(stored);
    this.emit(stored.id, false);
    return stored;
  }

  addTask(text: string): TaskItem | null {
    const trimmed = text.trim();
    if (!trimmed) return null;
    const now = Date.now();
    const task: TaskItem = { id: uid(), text: trimmed, done: false, createdAt: now, updatedAt: now };
    this.taskList = [task, ...this.taskList];
    this.persistTasks();
    return task;
  }

  toggleTask(id: string): void {
    this.taskList = this.taskList.map((t) =>
      t.id === id ? { ...t, done: !t.done, updatedAt: Date.now() } : t
    );
    this.persistTasks();
  }

  setTaskText(id: string, text: string): void {
    this.taskList = this.taskList.map((t) =>
      t.id === id ? { ...t, text, updatedAt: Date.now() } : t
    );
    this.persistTasks();
  }

  deleteTask(id: string): void {
    this.taskList = this.taskList.filter((t) => t.id !== id);
    this.persistTasks();
  }

  setColor(id: string, color: NoteColorKey): void {
    void this.update(id, { color });
  }

  /** Rappel d'une note (fonctionne app ouverte ; les rappels système viendront avec le serveur). */
  setReminder(id: string, at: number | null): void {
    void this.update(id, { remindAt: at });
  }

  /** Notes dont le rappel est arrivé à échéance. */
  dueReminders(now = Date.now()): Note[] {
    return this.notes.filter((n) => !n.deletedAt && n.remindAt !== null && n.remindAt <= now);
  }

  /** Notes avec un rappel à venir, triées par échéance. */
  get upcomingReminders(): Note[] {
    return this.notes
      .filter((n) => !n.deletedAt && n.remindAt !== null)
      .sort((a, b) => (a.remindAt ?? 0) - (b.remindAt ?? 0));
  }

  /**
   * Restaure un export JSON (notes + dossiers + tâches).
   * Fusion par identifiant : la version la plus récente gagne, rien n'est supprimé.
   */
  async importPayload(raw: unknown): Promise<{ notes: number; folders: number; tasks: number }> {
    const payload = raw as {
      notes?: unknown;
      folders?: unknown;
      tasks?: unknown;
    } | null;
    if (!payload || typeof payload !== 'object') throw new Error('Fichier illisible');

    const importedNotes = Array.isArray(payload.notes) ? payload.notes : [];
    const importedFolders = Array.isArray(payload.folders) ? payload.folders : [];
    const importedTasks = Array.isArray(payload.tasks) ? payload.tasks : [];

    let notes = 0;
    const toSave: Note[] = [];
    for (const item of importedNotes) {
      const note = sanitizeNote(item);
      if (!note) continue;
      const index = this.notes.findIndex((n) => n.id === note.id);
      if (index === -1) {
        this.notes.unshift(note);
        toSave.push(note);
        notes += 1;
      } else if (note.updatedAt >= this.notes[index].updatedAt) {
        this.notes[index] = note;
        toSave.push(note);
        notes += 1;
      }
    }
    // IndexedDB d'abord, sinon un rechargement perdrait les notes importées
    if (toSave.length) {
      const stored = toSave.map((note) => this.withMarkdown(note));
      toSave.length = 0;
      toSave.push(...stored);
      await saveNotes(stored);
      for (const note of stored) this.emit(note.id, note.deletedAt !== null);
    }

    let folders = 0;
    for (const item of importedFolders) {
      const folder = item as Folder | null;
      if (!folder || typeof folder.id !== 'string') continue;
      if (this.folders.some((f) => f.id === folder.id)) continue;
      this.folders = [...this.folders, { id: folder.id, name: String(folder.name ?? 'Dossier') }];
      folders += 1;
    }
    if (folders) write('notes:folders', JSON.stringify(this.folders));

    let tasks = 0;
    const nextTasks = [...this.taskList];
    for (const item of importedTasks) {
      const task = sanitizeTask(item);
      if (!task) continue;
      const index = nextTasks.findIndex((t) => t.id === task.id);
      if (index === -1) {
        nextTasks.push(task);
        tasks += 1;
      } else if (task.updatedAt >= nextTasks[index].updatedAt) {
        nextTasks[index] = task;
        tasks += 1;
      }
    }
    if (tasks) {
      this.taskList = nextTasks;
      this.persistTasks();
    }

    return { notes, folders, tasks };
  }

  togglePin(id: string): void {
    const note = this.notes.find((n) => n.id === id);
    if (note) void this.update(id, { pinned: !note.pinned });
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
    this.emit(id, true);
  }

  emptyTrash(): void {
    const removed = this.trash.map((n) => n.id);
    for (const id of removed) void deleteNote(id);
    this.notes = this.notes.filter((n) => !n.deletedAt);
    for (const id of removed) this.emit(id, true);
  }

  async purgeEverything(): Promise<void> {
    this.notes = [];
    this.taskList = [];
    this.persistTasks();
    this.started = false;
    await deleteAllNotes();
  }

  /** Permet de relancer `init()` (rechargement, tests). */
  resetStarted(): void {
    this.started = false;
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
