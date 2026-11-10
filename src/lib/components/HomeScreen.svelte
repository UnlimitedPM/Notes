<script lang="ts">
  import Icon from './Icon.svelte';
  import NoteCard from './NoteCard.svelte';
  import TaskCard from './TaskCard.svelte';
  import Sheet from './Sheet.svelte';
  import TabBar from './TabBar.svelte';
  import { notesStore } from '../notes.svelte';
  import { confirmStore } from '../confirm.svelte';
  import { toast } from '../toast.svelte';
  import { taskLineHtml } from '../tasks';
  import { tick } from 'svelte';
  import type { Note } from '../types';

  interface Props {
    tab: 'notes' | 'tasks';
    ontab: (tab: 'notes' | 'tasks') => void;
    onopen: (id: string) => void;
    onnew: () => void;
    onsettings: () => void;
    onfolders: () => void;
  }

  let { tab, ontab, onopen, onnew, onsettings, onfolders }: Props = $props();

  let query = $state('');
  let moveOpen = $state(false);
  let showCompleted = $state(false);

  let selecting = $state(false);
  let selectedIds = $state<string[]>([]);

  let composerOpen = $state(false);
  let composerText = $state('');
  let composerNoteId = $state<string | null>(null);
  let composerInput = $state<HTMLTextAreaElement | null>(null);

  const notes = $derived(notesStore.search(query));
  const columns = $derived(splitColumns(notes));
  const tasks = $derived(notesStore.tasks);
  const completedCount = $derived(tasks.filter((t) => t.done).length);
  const selectedCount = $derived(selectedIds.length);

  const selectionTitle = $derived(
    `${selectedCount} élément${selectedCount > 1 ? 's' : ''} sélectionné${selectedCount > 1 ? 's' : ''}`
  );

  function splitColumns(list: Note[]): Note[][] {
    const cols: Note[][] = [[], []];
    const heights = [0, 0];
    for (const note of list) {
      const image = /<img[^>]+src=/.test(note.html);
      const body = note.html.replace(/<[^>]*>/g, ' ');
      const estimate = (image ? 190 : 92) + Math.min(150, body.length * 0.62);
      const target = heights[0] <= heights[1] ? 0 : 1;
      cols[target].push(note);
      heights[target] += estimate;
    }
    return cols;
  }

  function enterSelection(note: Note) {
    selecting = true;
    selectedIds = [note.id];
  }

  function exitSelection() {
    selecting = false;
    selectedIds = [];
  }

  function toggleSelection(id: string) {
    selectedIds = selectedIds.includes(id)
      ? selectedIds.filter((value) => value !== id)
      : [...selectedIds, id];
    if (selectedIds.length === 0) selecting = false;
  }

  function selectAll() {
    selectedIds = notes.map((n) => n.id);
  }

  function pinSelected() {
    notesStore.pinMany(selectedIds);
    exitSelection();
  }

  function hideSelected() {
    notesStore.hideMany(selectedIds);
    toast.show(`${selectedCount} note${selectedCount > 1 ? 's' : ''} masquée${selectedCount > 1 ? 's' : ''}`);
    exitSelection();
  }

  async function deleteSelected() {
    const ok = await confirmStore.ask(
      'Supprimer des notes',
      `Supprimer ${selectedCount} élément${selectedCount > 1 ? 's' : ''} ?`,
      'Supprimer'
    );
    if (!ok) return;
    notesStore.trashMany(selectedIds);
    exitSelection();
  }

  function moveTo(folderId: string | null) {
    notesStore.moveMany(selectedIds, folderId);
    moveOpen = false;
    exitSelection();
  }

  async function openComposer() {
    composerOpen = true;
    composerNoteId = null;
    composerText = '';
    await tick();
    composerInput?.focus();
  }

  function commitComposer(): boolean {
    const text = composerText.trim();
    if (!text) return false;
    if (!composerNoteId) {
      const note = notesStore.create(taskLineHtml(text));
      composerNoteId = note.id;
    } else {
      const note = notesStore.notes.find((n) => n.id === composerNoteId);
      if (note) void notesStore.update(note.id, { html: note.html + taskLineHtml(text) });
    }
    composerText = '';
    composerInput?.focus();
    return true;
  }

  function closeComposer() {
    commitComposer();
    composerOpen = false;
    composerText = '';
    composerNoteId = null;
  }

  function autosize(node: HTMLTextAreaElement) {
    const resize = () => {
      node.style.height = 'auto';
      node.style.height = `${node.scrollHeight}px`;
    };
    resize();
    node.addEventListener('input', resize);
    return {
      destroy() {
        node.removeEventListener('input', resize);
      }
    };
  }
</script>

<div class="home">
  <div class="scroll">
    {#if selecting}
      <div class="top-icons">
        <button class="icon-btn" onclick={exitSelection} aria-label="Quitter la sélection">
          <Icon name="close" size={24} stroke={1.9} />
        </button>
        <div class="spacer"></div>
        <button class="icon-btn" onclick={selectAll} aria-label="Tout sélectionner">
          <Icon name="select-all" size={25} />
        </button>
      </div>
      <h1 class="screen-title select-title">{selectionTitle}</h1>
    {:else}
      <div class="top-icons">
        {#if tab === 'notes'}
          <button class="icon-btn" onclick={onfolders} aria-label="Dossiers">
            <Icon name="folder" size={24} stroke={1.6} />
          </button>
        {/if}
        <button class="icon-btn" onclick={onsettings} aria-label="Paramètres">
          <Icon name="gear" size={24} stroke={1.6} />
        </button>
      </div>
      <h1 class="screen-title">{tab === 'tasks' ? 'Tâches' : 'Notes'}</h1>
    {/if}

    {#if tab === 'notes'}
      <div class="searchbar">
        <Icon name="search" size={20} class="search-icon" />
        <input
          bind:value={query}
          class="search-input"
          type="search"
          placeholder="Rechercher des notes"
          autocomplete="off"
          enterkeyhint="search"
        />
        {#if query}
          <button class="search-clear" onclick={() => (query = '')} aria-label="Effacer">
            <Icon name="close" size={16} />
          </button>
        {/if}
      </div>

      <div class="chips">
        {#each notesStore.categories as category (category.key)}
          <button
            class="chip"
            class:active={notesStore.activeCategory === category.key}
            onclick={() => (notesStore.activeCategory = category.key)}
          >
            {category.label}
          </button>
        {/each}
      </div>

      {#if notes.length}
        {#if notesStore.layout === 'grid'}
          <div class="grid">
            {#each columns as column, index (index)}
              <div class="col">
                {#each column as note (note.id)}
                  <NoteCard
                    {note}
                    selectable={selecting}
                    selected={selectedIds.includes(note.id)}
                    onopen={onopen}
                    onlong={enterSelection}
                    ontoggle={toggleSelection}
                  />
                {/each}
              </div>
            {/each}
          </div>
        {:else}
          <div class="list">
            {#each notes as note (note.id)}
              <NoteCard
                {note}
                selectable={selecting}
                selected={selectedIds.includes(note.id)}
                onopen={onopen}
                onlong={enterSelection}
                ontoggle={toggleSelection}
              />
            {/each}
          </div>
        {/if}
      {:else if notesStore.ready}
        <div class="empty">
          <div class="empty-art"><Icon name="note" size={42} stroke={1.5} /></div>
          <p class="empty-title">{query ? 'Aucun résultat' : 'Aucune note'}</p>
          <p class="empty-sub">
            {query ? 'Essayez un autre mot-clé' : 'Appuyez sur + pour écrire votre première note'}
          </p>
        </div>
      {/if}
    {:else}
      {#if tasks.length}
        <div class="tasks">
          {#each tasks.filter((t) => !t.done) as task (`${task.noteId}:${task.index}`)}
            <TaskCard {task} />
          {/each}

          {#if completedCount}
            {#if showCompleted}
              {#each tasks.filter((t) => t.done) as task (`${task.noteId}:${task.index}`)}
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

  {#if selecting}
    <nav class="actions" aria-label="Actions sur la sélection">
      <button class="action" onclick={hideSelected}>
        <Icon name="lock" size={24} />
        <span>Masquer</span>
      </button>
      <button class="action" onclick={pinSelected}>
        <Icon name="pin" size={24} />
        <span>Épingler</span>
      </button>
      <button class="action" onclick={() => (moveOpen = true)}>
        <Icon name="folder-move" size={24} />
        <span>Déplacer vers</span>
      </button>
      <button class="action" onclick={deleteSelected}>
        <Icon name="trash" size={24} />
        <span>Supprimer</span>
      </button>
    </nav>
  {:else}
    <button
      class="fab"
      onclick={tab === 'tasks' ? openComposer : onnew}
      aria-label={tab === 'tasks' ? 'Nouvelle tâche' : 'Nouvelle note'}
    >
      <Icon name="plus" size={28} stroke={1.9} />
    </button>
    <TabBar {tab} {ontab} />
  {/if}

  <Sheet open={moveOpen} onclose={() => (moveOpen = false)} title="Déplacer vers">
    <button class="sheet-row" onclick={() => moveTo(null)}>
      <Icon name="note" size={22} />
      <span class="grow">Sans catégorie</span>
    </button>
    {#each notesStore.folders as folder (folder.id)}
      <button class="sheet-row" onclick={() => moveTo(folder.id)}>
        <Icon name="folder" size={22} />
        <span class="grow">{folder.name}</span>
        <span class="muted">{notesStore.countFolder(folder.id)}</span>
      </button>
    {/each}
  </Sheet>

  {#if composerOpen}
    <button class="composer-scrim" aria-label="Fermer" onclick={closeComposer}></button>
    <div class="composer">
      <div class="composer-line">
        <span class="composer-box"></span>
        <textarea
          bind:this={composerInput}
          bind:value={composerText}
          rows="1"
          placeholder='Appuyez sur "Entrée" pour créer des sous-tâches'
          use:autosize
          onkeydown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              commitComposer();
            }
          }}
        ></textarea>
      </div>
      <div class="composer-actions">
        <button class="reminder" onclick={() => toast.show('Rappels bientôt disponibles')}>
          <Icon name="bell" size={19} />
          Définir un rappel
        </button>
        <button class="done" disabled={!composerText.trim()} onclick={closeComposer}>
          Terminé
        </button>
      </div>
    </div>
  {/if}
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
    padding: calc(var(--safe-top) + 6px) 18px 0;
    color: var(--text);
  }

  .top-icons .spacer {
    flex: 1;
  }

  .top-icons :global(.icon-btn) {
    width: 40px;
    height: 40px;
  }

  .screen-title {
    padding-top: 14px;
  }

  .select-title {
    padding-top: 18px;
    font-size: 32px;
  }

  .searchbar {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 44px;
    margin: 14px 24px 0;
    padding: 0 16px;
    border-radius: 22px;
    background: var(--surface);
  }

  :global(.search-icon) {
    color: var(--text-3);
    flex: 0 0 auto;
  }

  .search-input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: transparent;
    outline: none;
    font-size: 17px;
    color: var(--text);
    -webkit-appearance: none;
    appearance: none;
  }

  .search-input::placeholder {
    color: var(--text-3);
  }

  .search-input::-webkit-search-cancel-button {
    display: none;
  }

  .search-clear {
    flex: 0 0 auto;
    width: 26px;
    height: 26px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--surface-3);
    color: var(--text-2);
  }

  .chips {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 16px;
    padding: 0 26px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .chips::-webkit-scrollbar {
    display: none;
  }

  .chip {
    flex: 0 0 auto;
    height: 36px;
    padding: 0 16px;
    border-radius: 18px;
    font-size: 15.5px;
    color: var(--text-2);
    white-space: nowrap;
  }

  .chip.active {
    background: var(--surface-2);
    color: var(--text);
    font-weight: 600;
  }

  .grid {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 18px 0;
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
    padding: 14px 18px 0;
  }

  .tasks {
    padding: 22px 20px 0;
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
    right: 35px;
    bottom: calc(70px + var(--safe-bottom) + 2px);
    z-index: 20;
    width: 58px;
    height: 58px;
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

  .actions {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 15;
    display: flex;
    height: calc(70px + var(--safe-bottom));
    padding-bottom: var(--safe-bottom);
    background: var(--bg);
  }

  .action {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    font-size: 12.5px;
    color: var(--text);
  }

  .action:active {
    background: var(--surface-2);
  }

  .composer-scrim {
    position: fixed;
    inset: 0;
    z-index: 40;
    width: 100%;
    background: rgba(0, 0, 0, 0.35);
  }

  .composer {
    position: fixed;
    left: 12px;
    right: 12px;
    bottom: calc(10px + var(--safe-bottom));
    z-index: 41;
    max-width: 496px;
    margin: 0 auto;
    padding: 16px 18px 14px;
    border-radius: 26px;
    background: #2c2c2e;
    color: #fff;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  }

  .composer-line {
    display: flex;
    align-items: flex-start;
    gap: 14px;
  }

  .composer-box {
    flex: 0 0 auto;
    width: 24px;
    height: 24px;
    margin-top: 3px;
    border-radius: 7px;
    border: 2px solid #8a8a90;
  }

  .composer-line textarea {
    flex: 1;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    outline: none;
    resize: none;
    overflow: hidden;
    font-size: 19px;
    line-height: 1.4;
    color: #fff;
  }

  .composer-line textarea::placeholder {
    color: #8a8a90;
  }

  .composer-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 16px;
  }

  .reminder {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 38px;
    padding: 0 14px;
    border-radius: 19px;
    background: #3a3a3c;
    color: #fff;
    font-size: 14.5px;
    font-weight: 500;
  }

  .done {
    height: 38px;
    padding: 0 14px;
    font-size: 16px;
    font-weight: 500;
    color: #8a8a90;
  }

  .done:not(:disabled) {
    color: #fff;
  }

  :global(.check) {
    color: var(--accent);
  }
</style>
