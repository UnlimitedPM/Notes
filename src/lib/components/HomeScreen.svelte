<script lang="ts">
  import Icon from './Icon.svelte';
  import NoteCard from './NoteCard.svelte';
  import TaskCard from './TaskCard.svelte';
  import Sheet from './Sheet.svelte';
  import TabBar from './TabBar.svelte';
  import { tick } from 'svelte';
  import { notesStore } from '../notes.svelte';
  import { confirmStore } from '../confirm.svelte';
  import { NOTE_COLORS } from '../colors';
  import type { Folder, Note, NoteColorKey } from '../types';

  type SheetName = 'actions' | 'color' | 'folders' | 'move' | null;

  interface Props {
    tab: 'notes' | 'tasks';
    ontab: (tab: 'notes' | 'tasks') => void;
    onopen: (id: string) => void;
    onnew: () => void;
    onsettings: () => void;
  }

  let { tab, ontab, onopen, onnew, onsettings }: Props = $props();

  let sheet = $state<SheetName>(null);
  let selectedId = $state<string | null>(null);
  let showCompleted = $state(false);
  let addingFolder = $state(false);
  let folderName = $state('');
  let folderInput = $state<HTMLInputElement | null>(null);

  const selected = $derived(
    selectedId ? (notesStore.notes.find((n) => n.id === selectedId) ?? null) : null
  );
  const notes = $derived(notesStore.visibleNotes);
  const columns = $derived(splitColumns(notes));
  const tasks = $derived(notesStore.tasks);
  const completedCount = $derived(tasks.filter((t) => t.done).length);

  const sheetTitle = $derived(
    sheet === 'color'
      ? 'Couleur de la note'
      : sheet === 'actions'
        ? selected?.title || 'Note'
        : sheet === 'folders'
          ? 'Dossiers'
          : sheet === 'move'
            ? 'Déplacer vers'
            : ''
  );

  function splitColumns(list: Note[]): Note[][] {
    const cols: Note[][] = [[], []];
    const heights = [0, 0];
    for (const note of list) {
      const body =
        note.kind === 'checklist'
          ? note.items.map((i) => i.text).join(' ')
          : note.html.replace(/<[^>]*>/g, ' ');
      const estimate = 92 + Math.min(150, body.length * 0.62);
      const target = heights[0] <= heights[1] ? 0 : 1;
      cols[target].push(note);
      heights[target] += estimate;
    }
    return cols;
  }

  function openActions(note: Note) {
    selectedId = note.id;
    sheet = 'actions';
  }

  function togglePin() {
    if (!selected) return;
    notesStore.togglePin(selected.id);
    sheet = null;
  }

  function duplicateNote() {
    if (!selected) return;
    const copy = notesStore.duplicate(selected);
    sheet = null;
    onopen(copy.id);
  }

  function deleteNote() {
    if (!selected) return;
    notesStore.trashNote(selected.id);
    sheet = null;
  }

  function chooseColor(color: NoteColorKey) {
    if (!selected) return;
    notesStore.setColor(selected.id, color);
    sheet = null;
  }

  function moveTo(folderId: string | null) {
    if (!selected) return;
    notesStore.setNoteFolder(selected.id, folderId);
    sheet = null;
  }

  function selectFolder(folderId: string | null) {
    notesStore.activeFolderId = folderId;
    sheet = null;
  }

  async function startFolder() {
    addingFolder = true;
    await tick();
    folderInput?.focus();
  }

  function confirmFolder() {
    const folder = notesStore.createFolder(folderName);
    folderName = '';
    addingFolder = false;
    if (folder) notesStore.activeFolderId = folder.id;
    sheet = null;
  }

  async function removeFolder(folder: Folder) {
    const ok = await confirmStore.ask(
      `Supprimer le dossier « ${folder.name} » ? Les notes ne sont pas supprimées.`
    );
    if (ok) notesStore.deleteFolder(folder.id);
  }

  function later(fn: () => void) {
    setTimeout(fn, 210);
  }
</script>

<div class="home">
  <div class="scroll">
    <div class="top-icons">
      {#if tab === 'notes'}
        <button
          class="icon-btn"
          onclick={() => (sheet = 'folders')}
          aria-label="Dossiers"
        >
          <Icon name="folder" size={26} stroke={1.6} />
        </button>
      {/if}
      <button class="icon-btn" onclick={onsettings} aria-label="Paramètres">
        <Icon name="gear" size={25} stroke={1.6} />
      </button>
    </div>

    <h1 class="screen-title">
      {tab === 'tasks' ? 'Tâches' : notesStore.activeFolder?.name || 'Notes'}
    </h1>

    {#if tab === 'notes'}
      {#if notesStore.activeFolder}
        <button class="clear-folder" onclick={() => (notesStore.activeFolderId = null)}>
          Toutes les notes
        </button>
      {/if}

      {#if notes.length}
        {#if notesStore.layout === 'grid'}
          <div class="grid">
            {#each columns as column, index (index)}
              <div class="col">
                {#each column as note (note.id)}
                  <NoteCard {note} onopen={onopen} onlong={openActions} />
                {/each}
              </div>
            {/each}
          </div>
        {:else}
          <div class="list">
            {#each notes as note (note.id)}
              <NoteCard {note} onopen={onopen} onlong={openActions} />
            {/each}
          </div>
        {/if}
      {:else if notesStore.ready}
        <div class="empty">
          <div class="empty-art"><Icon name="note" size={42} stroke={1.5} /></div>
          <p class="empty-title">Aucune note</p>
          <p class="empty-sub">Appuyez sur + pour écrire votre première note</p>
        </div>
      {/if}
    {:else}
      {#if tasks.length}
        <div class="tasks">
          {#each tasks.filter((t) => !t.done) as task (`${task.noteId}:${task.itemId}`)}
            <TaskCard {task} />
          {/each}

          {#if completedCount}
            {#if showCompleted}
              {#each tasks.filter((t) => t.done) as task (`${task.noteId}:${task.itemId}`)}
                <TaskCard {task} />
              {/each}
            {/if}
            <button class="show-completed" onclick={() => (showCompleted = !showCompleted)}>
              {showCompleted
                ? 'Masquer les tâches terminées'
                : `Afficher les tâches terminées (${completedCount})`}
            </button>
          {/if}
        </div>
      {:else if notesStore.ready}
        <div class="empty">
          <div class="empty-art">
            <Icon name="check-square" size={40} stroke={1.5} />
          </div>
          <p class="empty-title">Aucune tâche</p>
          <p class="empty-sub">Ajoutez des cases à cocher dans une note pour les retrouver ici</p>
        </div>
      {/if}
    {/if}
  </div>

  <button
    class="fab"
    onclick={onnew}
    aria-label={tab === 'tasks' ? 'Nouvelle tâche' : 'Nouvelle note'}
  >
    <Icon name="plus" size={28} stroke={1.9} />
  </button>

  <TabBar {tab} {ontab} />

  <Sheet open={sheet !== null} onclose={() => (sheet = null)} title={sheetTitle}>
    {#if sheet === 'actions'}
      <button class="sheet-row" onclick={togglePin}>
        <Icon name={selected?.pinned ? 'pin-filled' : 'pin'} size={22} />
        <span class="grow">{selected?.pinned ? 'Désépingler' : 'Épingler'}</span>
      </button>
      <button class="sheet-row" onclick={() => later(() => (sheet = 'color'))}>
        <Icon name="palette" size={22} />
        <span class="grow">Couleur</span>
      </button>
      <button class="sheet-row" onclick={() => later(() => (sheet = 'move'))}>
        <Icon name="folder" size={22} />
        <span class="grow">Déplacer vers</span>
      </button>
      <button class="sheet-row" onclick={duplicateNote}>
        <Icon name="copy" size={22} />
        <span class="grow">Dupliquer</span>
      </button>
      <button class="sheet-row danger" onclick={deleteNote}>
        <Icon name="trash" size={22} />
        <span class="grow">Supprimer</span>
      </button>
    {:else if sheet === 'color'}
      <div class="colors">
        {#each NOTE_COLORS as color (color.key)}
          <button
            class="swatch-wrap"
            onclick={() => chooseColor(color.key)}
            aria-label={color.label}
          >
            <span class="swatch" data-note-color={color.key}>
              {#if selected?.color === color.key}
                <Icon name="check" size={16} stroke={2.6} />
              {/if}
            </span>
            <span class="swatch-label">{color.label}</span>
          </button>
        {/each}
      </div>
    {:else if sheet === 'folders'}
      <button class="sheet-row" onclick={() => selectFolder(null)}>
        <Icon name="note" size={22} />
        <span class="grow">Toutes les notes</span>
        <span class="muted">{notesStore.countFolder(null)}</span>
        {#if !notesStore.activeFolderId}<Icon name="check" size={18} class="check" />{/if}
      </button>
      {#each notesStore.folders as folder (folder.id)}
        <div class="folder-line">
          <button class="sheet-row folder-pick" onclick={() => selectFolder(folder.id)}>
            <Icon name="folder" size={22} />
            <span class="grow">{folder.name}</span>
            <span class="muted">{notesStore.countFolder(folder.id)}</span>
            {#if notesStore.activeFolderId === folder.id}
              <Icon name="check" size={18} class="check" />
            {/if}
          </button>
          <button
            class="icon-btn folder-del"
            onclick={() => removeFolder(folder)}
            aria-label={`Supprimer ${folder.name}`}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      {/each}
      {#if addingFolder}
        <div class="new-folder">
          <input
            class="new-folder-input"
            bind:this={folderInput}
            bind:value={folderName}
            placeholder="Nom du dossier"
            autocomplete="off"
            onkeydown={(event) => {
              if (event.key === 'Enter') confirmFolder();
            }}
          />
          <button class="text-btn" onclick={confirmFolder}>Créer</button>
        </div>
      {:else}
        <button class="sheet-row" onclick={startFolder}>
          <Icon name="plus" size={22} />
          <span class="grow">Nouveau dossier</span>
        </button>
      {/if}
    {:else if sheet === 'move'}
      <button class="sheet-row" onclick={() => moveTo(null)}>
        <Icon name="note" size={22} />
        <span class="grow">Aucun dossier</span>
        {#if selected && !selected.folderId}<Icon name="check" size={18} class="check" />{/if}
      </button>
      {#each notesStore.folders as folder (folder.id)}
        <button class="sheet-row" onclick={() => moveTo(folder.id)}>
          <Icon name="folder" size={22} />
          <span class="grow">{folder.name}</span>
          {#if selected?.folderId === folder.id}
            <Icon name="check" size={18} class="check" />
          {/if}
        </button>
      {/each}
    {/if}
  </Sheet>
</div>

<style>
  .home {
    position: relative;
    height: 100dvh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg);
  }

  .scroll {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding-bottom: calc(150px + var(--safe-bottom));
  }

  .top-icons {
    display: flex;
    justify-content: flex-end;
    gap: 2px;
    padding: calc(var(--safe-top) + 6px) 14px 0;
    color: var(--text);
  }

  .screen-title {
    padding-top: 24px;
  }

  .clear-folder {
    display: block;
    margin: 14px 18px -2px;
    font-size: 13.5px;
    color: var(--text-3);
  }

  .grid {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 22px 18px 0;
  }

  .col {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 22px 16px 0;
  }

  .tasks {
    padding: 22px 18px 0;
  }

  .show-completed {
    display: block;
    margin: 14px auto 0;
    padding: 8px 14px;
    font-size: 13.5px;
    color: var(--text-3);
    border-radius: 12px;
  }
  .show-completed:active {
    background: var(--surface-2);
  }

  .fab {
    position: absolute;
    right: 20px;
    bottom: calc(64px + var(--safe-bottom) + 20px);
    z-index: 20;
    width: 61px;
    height: 61px;
    border-radius: 50%;
    background: var(--accent);
    color: #fff;
    display: grid;
    place-items: center;
    box-shadow: var(--shadow-fab);
    transition: transform 0.14s var(--ease);
  }

  .fab:active {
    transform: scale(0.93);
  }

  :global(.check) {
    color: var(--accent);
  }

  .folder-line {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .folder-pick {
    flex: 1;
    min-width: 0;
  }

  .folder-del {
    width: 34px;
    height: 34px;
    margin-right: 6px;
    color: var(--text-3);
  }

  .new-folder {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px 4px;
  }

  .new-folder-input {
    flex: 1;
    min-width: 0;
    height: 44px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface-2);
    padding: 0 14px;
    font-size: 16px;
    outline: none;
  }

  .colors {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    padding: 4px 8px 10px;
  }

  .swatch-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 6px 0;
    border-radius: 14px;
  }

  .swatch {
    width: 54px;
    height: 54px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    color: var(--text);
    background: var(--card-bg, var(--surface-2));
    border: 1px solid var(--line);
  }

  .swatch-wrap:active .swatch {
    transform: scale(0.94);
  }

  .swatch-label {
    font-size: 11.5px;
    color: var(--text-3);
  }
</style>
