import { beforeEach, describe, expect, it } from 'vitest';
import { notesStore } from '../src/lib/notes.svelte';
import { TEST_FOLDERS, TEST_NOTES, TEST_PAYLOAD, TEST_TASKS, NOW, makeNote } from './fixtures';

/** Repart d'une base vide sans le jeu de démonstration. */
async function emptyStore(): Promise<void> {
  localStorage.clear();
  await notesStore.purgeEverything();
  notesStore.folders = [];
  notesStore.taskList = [];
  notesStore.activeCategory = 'all';
  notesStore.setShowHidden(false);
  localStorage.setItem('notes:seed', '1');
  await notesStore.init();
}

beforeEach(async () => {
  await emptyStore();
});

describe('initialisation', () => {
  it('crée le jeu de démonstration quand tout est vide', async () => {
    localStorage.clear();
    await notesStore.purgeEverything();
    notesStore.folders = [];
    notesStore.taskList = [];
    await notesStore.init();
    expect(notesStore.notes.length).toBeGreaterThan(0);
    expect(notesStore.taskList.length).toBeGreaterThan(0);
    expect(notesStore.ready).toBe(true);
  });

  it('ne re-sème pas au second démarrage', async () => {
    const count = notesStore.notes.length;
    notesStore.resetStarted();
    await notesStore.init();
    expect(notesStore.notes.length).toBe(count);
  });
});

describe('création et mise à jour', () => {
  it('crée une note et la place en tête', () => {
    const note = notesStore.create('<div>hello</div>');
    expect(notesStore.notes[0].id).toBe(note.id);
    expect(notesStore.notes[0].html).toContain('hello');
  });

  it('met à jour et horodate', async () => {
    const note = notesStore.create('<div>a</div>');
    const before = note.updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    await notesStore.update(note.id, { title: 'Titre' });
    const updated = notesStore.notes.find((n) => n.id === note.id)!;
    expect(updated.title).toBe('Titre');
    expect(updated.updatedAt).toBeGreaterThanOrEqual(before);
  });

  it('duplique sans rappel ni épingle', () => {
    const note = notesStore.create('<div>a</div>');
    void notesStore.update(note.id, { pinned: true, remindAt: NOW });
    const copy = notesStore.duplicate(notesStore.notes.find((n) => n.id === note.id)!);
    expect(copy.id).not.toBe(note.id);
    expect(copy.pinned).toBe(false);
    expect(copy.remindAt).toBeNull();
  });
});

describe('corbeille, restauration, purge', () => {
  it('envoie à la corbeille puis restaure', () => {
    const note = notesStore.create('<div>a</div>');
    notesStore.trashNote(note.id);
    expect(notesStore.trash.map((n) => n.id)).toContain(note.id);
    expect(notesStore.active.map((n) => n.id)).not.toContain(note.id);

    notesStore.restore(note.id);
    expect(notesStore.trash.map((n) => n.id)).not.toContain(note.id);
    expect(notesStore.active.map((n) => n.id)).toContain(note.id);
  });

  it('vide la corbeille définitivement', () => {
    const a = notesStore.create('<div>a</div>');
    const b = notesStore.create('<div>b</div>');
    notesStore.trashMany([a.id, b.id]);
    notesStore.emptyTrash();
    expect(notesStore.trash).toHaveLength(0);
    expect(notesStore.notes.find((n) => n.id === a.id)).toBeUndefined();
  });

  it('masque puis réaffiche les notes', () => {
    const note = notesStore.create('<div>a</div>');
    notesStore.hideMany([note.id]);
    expect(notesStore.active.map((n) => n.id)).not.toContain(note.id);
    expect(notesStore.hiddenCount).toBe(1);

    notesStore.setShowHidden(true);
    expect(notesStore.active.map((n) => n.id)).toContain(note.id);
    notesStore.setShowHidden(false);
  });
});

describe('tri et catégories', () => {
  it('garde les épinglées en tête', () => {
    const a = notesStore.create('<div>a</div>', { title: 'A' });
    const b = notesStore.create('<div>b</div>', { title: 'B' });
    void notesStore.update(b.id, { pinned: true });
    const order = notesStore.sorted.map((n) => n.id);
    expect(order.indexOf(b.id)).toBe(0);
    expect(order.indexOf(a.id)).toBeGreaterThan(0);
  });

  it('trie par titre', () => {
    notesStore.create('', { title: 'Zèbre' });
    notesStore.create('', { title: 'Abeille' });
    notesStore.setSort('title');
    const titles = notesStore.sorted.map((n) => n.title);
    expect(titles.indexOf('Abeille')).toBeLessThan(titles.indexOf('Zèbre'));
    notesStore.setSort('updated');
  });

  it('filtre par dossier', () => {
    const folder = notesStore.createFolder('Test dossier')!;
    const note = notesStore.create('', { title: 'Dedans' });
    void notesStore.update(note.id, { folderId: folder.id });
    notesStore.activeCategory = folder.id;
    expect(notesStore.visibleNotes.map((n) => n.id)).toEqual([note.id]);
    notesStore.activeCategory = 'all';
  });

  it('supprime un dossier sans supprimer ses notes', () => {
    const folder = notesStore.createFolder('Éphémère')!;
    const note = notesStore.create('', { title: 'Rescapée' });
    void notesStore.update(note.id, { folderId: folder.id });
    notesStore.deleteFolder(folder.id);
    expect(notesStore.folders.some((f) => f.id === folder.id)).toBe(false);
    expect(notesStore.notes.find((n) => n.id === note.id)?.folderId).toBeNull();
  });
});

describe('rappels', () => {
  it('programme, liste et déclenche un rappel', () => {
    const note = notesStore.create('', { title: 'Rappel' });
    notesStore.setReminder(note.id, Date.now() + 60_000);
    expect(notesStore.upcomingReminders.map((n) => n.id)).toContain(note.id);
    expect(notesStore.dueReminders()).toHaveLength(0);

    notesStore.setReminder(note.id, Date.now() - 60_000);
    expect(notesStore.dueReminders().map((n) => n.id)).toContain(note.id);

    notesStore.setReminder(note.id, null);
    expect(notesStore.upcomingReminders.map((n) => n.id)).not.toContain(note.id);
  });

  it('ignore les rappels des notes à la corbeille', () => {
    const note = notesStore.create('', { title: 'Corbeille' });
    notesStore.setReminder(note.id, Date.now() - 1000);
    notesStore.trashNote(note.id);
    expect(notesStore.dueReminders().map((n) => n.id)).not.toContain(note.id);
  });
});

describe('import JSON (base de test)', () => {
  it('importe notes, dossiers et tâches', async () => {
    const result = await notesStore.importPayload(TEST_PAYLOAD);
    expect(result).toEqual({ notes: TEST_NOTES.length, folders: TEST_FOLDERS.length, tasks: TEST_TASKS.length });
    expect(notesStore.notes).toHaveLength(TEST_NOTES.length);
    expect(notesStore.folders).toHaveLength(TEST_FOLDERS.length);
    expect(notesStore.taskList).toHaveLength(TEST_TASKS.length);
  });

  it('conserve tous les champs de la note riche', async () => {
    await notesStore.importPayload(TEST_PAYLOAD);
    const rich = notesStore.notes.find((n) => n.id === 'note-rich')!;
    expect(rich.color).toBe('yellow');
    expect(rich.folderId).toBe('folder-work');
    expect(rich.remindAt).toBeGreaterThan(0);
    expect(rich.html).toContain('background-color');
    expect(rich.html).toContain('<img');
    expect(rich.html).toContain('<audio');
  });

  it('importe les notes masquées et celles de la corbeille', async () => {
    await notesStore.importPayload(TEST_PAYLOAD);
    expect(notesStore.hiddenCount).toBe(1);
    expect(notesStore.trash.map((n) => n.id)).toContain('note-trashed');
  });

  it('est idempotent : un second import n’ajoute rien', async () => {
    await notesStore.importPayload(TEST_PAYLOAD);
    const again = await notesStore.importPayload(TEST_PAYLOAD);
    expect(again).toEqual({ notes: TEST_NOTES.length, folders: 0, tasks: TEST_TASKS.length });
    expect(notesStore.notes).toHaveLength(TEST_NOTES.length);
  });

  it('garde la version la plus récente quand l’import est plus ancien', async () => {
    await notesStore.importPayload(TEST_PAYLOAD);
    const older = {
      ...TEST_PAYLOAD,
      notes: [makeNote({ id: 'note-rich', title: 'Vieille version', updatedAt: NOW - 10 * 86_400_000 })]
    };
    const result = await notesStore.importPayload(older);
    const rich = notesStore.notes.find((n) => n.id === 'note-rich')!;
    expect(rich.title).toBe('Note riche');
    expect(result.notes).toBe(0);
  });

  it('remplace quand l’import est plus récent', async () => {
    await notesStore.importPayload(TEST_PAYLOAD);
    const newer = {
      ...TEST_PAYLOAD,
      notes: [makeNote({ id: 'note-rich', title: 'Nouvelle version', updatedAt: NOW + 86_400_000 })]
    };
    const result = await notesStore.importPayload(newer);
    const rich = notesStore.notes.find((n) => n.id === 'note-rich')!;
    expect(rich.title).toBe('Nouvelle version');
    expect(result.notes).toBe(1);
  });

  it('refuse un fichier invalide', async () => {
    await expect(notesStore.importPayload(null)).rejects.toThrow();
    await expect(notesStore.importPayload([1, 2, 3])).resolves.toEqual({ notes: 0, folders: 0, tasks: 0 });
  });

  it('ignore les entrées sans identifiant', async () => {
    const result = await notesStore.importPayload({
      notes: [{ title: 'sans id' }, { id: 'ok', title: 'avec id' }],
      folders: [{ name: 'sans id' }],
      tasks: [{ text: 'sans id' }]
    });
    expect(result).toEqual({ notes: 1, folders: 0, tasks: 0 });
  });

  it('survit à un rechargement (IndexedDB)', async () => {
    await notesStore.importPayload(TEST_PAYLOAD);
    notesStore.resetStarted();
    await notesStore.init();
    expect(notesStore.notes).toHaveLength(TEST_NOTES.length);
  });
});
