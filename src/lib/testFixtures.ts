import type { Folder, Note, NoteColorKey, TaskItem } from './types';

/**
 * Base de données de test : une note qui contient un exemplaire de chaque chose que
 * l'éditeur sait produire (titres, styles, listes, cases, image, audio, rappel),
 * plus une note épinglée, une masquée, une à la corbeille et une vide.
 *
 * Utilisée par les tests (`npm test`) et, en développement seulement, par le bouton
 * « Charger la base de test » des Réglages.
 */

export const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
export const WAV_VIDE =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

export const NOW = 1_760_000_000_000; // date fixe : les tests ne dépendent pas de l'horloge
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const TEST_FOLDERS: Folder[] = [
  { id: 'folder-work', name: 'Travail' },
  { id: 'folder-home', name: 'Maison' }
];

function base(overrides: Partial<Note> & { id: string; title: string }): Note {
  return {
    kind: 'text',
    html: '',
    items: [],
    color: 'default' as NoteColorKey,
    pinned: false,
    folderId: null,
    hidden: false,
    remindAt: null,
    tags: [],
    createdAt: NOW - DAY,
    updatedAt: NOW - DAY,
    deletedAt: null,
    ...overrides
  };
}

export const NOTE_RICHE = base({
  id: 'note-rich',
  title: 'Note riche',
  html:
    '<h1>Un titre</h1>' +
    '<h2>Sous-titre</h2>' +
    '<h3>Petit titre</h3>' +
    '<div>Un <span style="font-weight: bold;">gras</span> et un <span style="font-style: italic;">italique</span></div>' +
    '<div><span style="text-decoration-line: line-through;">barré</span> puis <span style="background-color: rgb(129, 121, 98);">surligné</span></div>' +
    '<ul><li>Puce une</li><li>Puce deux</li></ul>' +
    '<ol><li>Première</li><li>Deuxième</li></ol>' +
    '<div class="task-line" data-checked="true">Tâche faite</div>' +
    '<div class="task-line" data-checked="false">Tâche à faire</div>' +
    `<div><img src="${PNG_1PX}" alt="" /></div>` +
    `<div><audio controls src="${WAV_VIDE}"></audio></div>`,
  color: 'yellow',
  folderId: 'folder-work',
  remindAt: NOW + HOUR,
  createdAt: NOW - 3 * DAY,
  updatedAt: NOW - HOUR
});

export const NOTE_EPINGLEE = base({
  id: 'note-pinned',
  title: 'Note épinglée',
  html: '<div>Contenu épinglé</div>',
  pinned: true,
  folderId: 'folder-home',
  createdAt: NOW - 5 * DAY,
  updatedAt: NOW - 2 * DAY
});

export const NOTE_MASQUEE = base({
  id: 'note-hidden',
  title: 'Note masquée',
  html: '<div>Secret</div>',
  hidden: true
});

export const NOTE_CORBEILLE = base({
  id: 'note-trashed',
  title: 'Note à la corbeille',
  html: '<div>À restaurer</div>',
  deletedAt: NOW - HOUR
});

export const NOTE_VIDE = base({ id: 'note-empty', title: '', html: '' });

export const TEST_NOTES: Note[] = [
  NOTE_RICHE,
  NOTE_EPINGLEE,
  NOTE_MASQUEE,
  NOTE_CORBEILLE,
  NOTE_VIDE
];

export const TEST_TASKS: TaskItem[] = [
  { id: 'task-1', text: 'Tâche ouverte', done: false, createdAt: NOW - HOUR, updatedAt: NOW - HOUR },
  { id: 'task-2', text: 'Tâche terminée', done: true, createdAt: NOW - 2 * HOUR, updatedAt: NOW - 2 * HOUR }
];

/** Payload complet, identique à ce que produit « Exporter les notes ». */
export const TEST_PAYLOAD = {
  app: 'notes',
  version: 1,
  exportedAt: new Date(NOW).toISOString(),
  folders: TEST_FOLDERS,
  notes: TEST_NOTES,
  tasks: TEST_TASKS
};

export function makeNote(overrides: Partial<Note> & { id: string }): Note {
  return {
    ...base({ id: overrides.id, title: overrides.title ?? '' }),
    ...overrides
  };
}
