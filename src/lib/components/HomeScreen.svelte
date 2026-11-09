<script lang="ts">
  import { tick } from 'svelte';
  import Icon from './Icon.svelte';
  import NoteCard from './NoteCard.svelte';
  import Sheet from './Sheet.svelte';
  import { notesStore, type SortKey, type ThemeKey } from '../notes.svelte';
  import { NOTE_COLORS } from '../colors';
  import { plainText } from '../format';
  import type { Note, NoteColorKey, NoteKind } from '../types';

  interface Props {
    onopen: (id: string) => void;
    onnew: (kind: NoteKind) => void;
    ontrash: () => void;
  }

  let { onopen, onnew, ontrash }: Props = $props();

  let searching = $state(false);
  let query = $state('');
  let searchEl = $state<HTMLInputElement | null>(null);

  let menuOpen = $state(false);
  let sortOpen = $state(false);
  let themeOpen = $state(false);
  let actionsOpen = $state(false);
  let colorOpen = $state(false);
  let selectedId = $state<string | null>(null);

  const selected = $derived(
    selectedId ? (notesStore.notes.find((n) => n.id === selectedId) ?? null) : null
  );
  const results = $derived(notesStore.search(query));
  const columns = $derived(splitColumns(results));

  const sortLabels: Record<SortKey, string> = {
    updated: 'Modification',
    created: 'Création',
    title: 'Titre'
  };
  const themeLabels: Record<ThemeKey, string> = {
    system: 'Système',
    light: 'Clair',
    dark: 'Sombre'
  };
  const sortOptions: SortKey[] = ['updated', 'created', 'title'];
  const themeOptions: ThemeKey[] = ['system', 'light', 'dark'];
  const themeIcons: Record<ThemeKey, string> = {
    system: 'monitor',
    light: 'sun',
    dark: 'moon'
  };

  function splitColumns(list: Note[]): Note[][] {
    const cols: Note[][] = [[], []];
    const heights = [0, 0];
    for (const note of list) {
      const textLength = plainText(note).length;
      const checkRows = note.kind === 'checklist' ? Math.min(note.items.length, 3) * 26 : 0;
      const estimate = 62 + checkRows + Math.min(150, textLength * 0.72);
      const target = heights[0] <= heights[1] ? 0 : 1;
      cols[target].push(note);
      heights[target] += estimate;
    }
    return cols;
  }

  async function startSearch() {
    searching = true;
    await tick();
    searchEl?.focus();
  }

  function stopSearch() {
    searching = false;
    query = '';
  }

  function openActions(note: Note) {
    selectedId = note.id;
    actionsOpen = true;
  }

  function closeActions() {
    actionsOpen = false;
  }

  function togglePin() {
    if (!selected) return;
    notesStore.togglePin(selected.id);
    actionsOpen = false;
  }

  function duplicateNote() {
    if (!selected) return;
    const copy = notesStore.duplicate(selected);
    actionsOpen = false;
    onopen(copy.id);
  }

  function deleteNote() {
    if (!selected) return;
    notesStore.trashNote(selected.id);
    actionsOpen = false;
  }

  function chooseColor(color: NoteColorKey) {
    if (!selected) return;
    notesStore.setColor(selected.id, color);
    colorOpen = false;
  }

  function chooseSort(sort: SortKey) {
    notesStore.setSort(sort);
    sortOpen = false;
  }

  function chooseTheme(theme: ThemeKey) {
    notesStore.setTheme(theme);
    themeOpen = false;
  }

  function later(fn: () => void) {
    setTimeout(fn, 210);
  }
</script>

<div class="home">
  <div class="scroll">
    <header class="home-head" class:searching>
      {#if searching}
        <button class="icon-btn" onclick={stopSearch} aria-label="Fermer la recherche">
          <Icon name="back" />
        </button>
        <input
          bind:this={searchEl}
          bind:value={query}
          class="search-input"
          type="search"
          placeholder="Rechercher des notes"
          enterkeyhint="search"
          autocomplete="off"
        />
        {#if query}
          <button class="icon-btn" onclick={() => (query = '')} aria-label="Effacer">
            <Icon name="close" size={20} />
          </button>
        {/if}
      {:else}
        <h1>Notes</h1>
        <div class="head-actions">
          <button class="icon-btn" onclick={startSearch} aria-label="Rechercher">
            <Icon name="search" />
          </button>
          <button class="icon-btn" onclick={() => (menuOpen = true)} aria-label="Plus d'options">
            <Icon name="more" />
          </button>
        </div>
      {/if}
    </header>

    {#if results.length > 0}
      <div class="grid">
        {#each columns as column, index (index)}
          <div class="col">
            {#each column as note (note.id)}
              <NoteCard {note} onopen={onopen} onlong={openActions} />
            {/each}
          </div>
        {/each}
      </div>
    {:else if notesStore.ready}
      <div class="empty">
        <div class="empty-art">
          <Icon name={query ? 'search' : 'note'} size={44} stroke={1.5} />
        </div>
        <p class="empty-title">{query ? 'Aucun résultat' : 'Aucune note'}</p>
        <p class="empty-sub">
          {query ? 'Essayez un autre mot-clé' : 'Appuyez sur + pour créer une note'}
        </p>
      </div>
    {/if}
  </div>

  {#if !searching}
    <button class="fab" onclick={() => onnew('text')} aria-label="Nouvelle note">
      <Icon name="plus" size={27} stroke={2.1} />
    </button>
  {/if}

  <!-- Menu principal -->
  <Sheet open={menuOpen} onclose={() => (menuOpen = false)}>
    <button
      class="sheet-row"
      onclick={() => {
        menuOpen = false;
        onnew('checklist');
      }}
    >
      <Icon name="checklist" size={22} />
      <span class="grow">Nouvelle liste</span>
    </button>
    <button
      class="sheet-row"
      onclick={() => {
        menuOpen = false;
        later(() => (sortOpen = true));
      }}
    >
      <Icon name="sort" size={22} />
      <span class="grow">Trier par</span>
      <span class="muted">{sortLabels[notesStore.sort]}</span>
    </button>
    <button
      class="sheet-row"
      onclick={() => {
        menuOpen = false;
        later(() => (themeOpen = true));
      }}
    >
      <Icon name="moon" size={22} />
      <span class="grow">Apparence</span>
      <span class="muted">{themeLabels[notesStore.theme]}</span>
    </button>
    <button
      class="sheet-row"
      onclick={() => {
        menuOpen = false;
        ontrash();
      }}
    >
      <Icon name="trash" size={22} />
      <span class="grow">Corbeille</span>
      {#if notesStore.trash.length}
        <span class="muted">{notesStore.trash.length}</span>
      {/if}
    </button>
  </Sheet>

  <!-- Tri -->
  <Sheet open={sortOpen} onclose={() => (sortOpen = false)} title="Trier par">
    {#each sortOptions as option (option)}
      <button class="sheet-row" onclick={() => chooseSort(option)}>
        <Icon name="sort" size={22} />
        <span class="grow">{sortLabels[option]}</span>
        {#if notesStore.sort === option}
          <Icon name="check" size={20} class="check" />
        {/if}
      </button>
    {/each}
  </Sheet>

  <!-- Apparence -->
  <Sheet open={themeOpen} onclose={() => (themeOpen = false)} title="Apparence">
    {#each themeOptions as option (option)}
      <button class="sheet-row" onclick={() => chooseTheme(option)}>
        <Icon name={themeIcons[option]} size={22} />
        <span class="grow">{themeLabels[option]}</span>
        {#if notesStore.theme === option}
          <Icon name="check" size={20} class="check" />
        {/if}
      </button>
    {/each}
  </Sheet>

  <!-- Actions sur une note -->
  <Sheet
    open={actionsOpen && !!selected}
    onclose={closeActions}
    title={selected?.title || 'Note'}
  >
    <button class="sheet-row" onclick={togglePin}>
      <Icon name={selected?.pinned ? 'pin-filled' : 'pin'} size={22} />
      <span class="grow">{selected?.pinned ? 'Désépingler' : 'Épingler'}</span>
    </button>
    <button
      class="sheet-row"
      onclick={() => {
        actionsOpen = false;
        later(() => (colorOpen = true));
      }}
    >
      <Icon name="palette" size={22} />
      <span class="grow">Couleur</span>
    </button>
    <button class="sheet-row" onclick={duplicateNote}>
      <Icon name="copy" size={22} />
      <span class="grow">Dupliquer</span>
    </button>
    <button class="sheet-row danger" onclick={deleteNote}>
      <Icon name="trash" size={22} />
      <span class="grow">Supprimer</span>
    </button>
  </Sheet>

  <!-- Couleurs -->
  <Sheet open={colorOpen} onclose={() => (colorOpen = false)} title="Couleur de la note">
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
  </Sheet>
</div>

<style>
  .home {
    position: relative;
    height: 100dvh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .scroll {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding-bottom: 118px;
  }

  .home-head {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: calc(var(--safe-top) + 12px) 10px 8px 18px;
    background: var(--bg);
  }

  .home-head h1 {
    flex: 1;
    margin: 0;
    font-size: 29px;
    font-weight: 700;
    letter-spacing: -0.8px;
    line-height: 1.15;
  }

  .head-actions {
    display: flex;
    gap: 0;
    margin-right: 2px;
  }

  .search-input {
    flex: 1;
    height: 42px;
    min-width: 0;
    border: 0;
    border-radius: 21px;
    background: var(--surface-2);
    padding: 0 16px;
    font-size: 16px;
    outline: none;
    -webkit-appearance: none;
    appearance: none;
  }
  .search-input::-webkit-search-cancel-button {
    display: none;
  }

  .grid {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 4px 12px 0;
  }

  .col {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .fab {
    position: absolute;
    right: 18px;
    bottom: calc(22px + var(--safe-bottom));
    width: 58px;
    height: 58px;
    border-radius: 50%;
    background: var(--accent);
    color: #fff;
    display: grid;
    place-items: center;
    box-shadow: var(--shadow-fab);
    transition: transform 0.14s var(--ease);
    z-index: 20;
  }

  .fab:active {
    transform: scale(0.93);
  }

  :global(.check) {
    color: var(--accent);
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
    background: var(--card-bg, var(--surface));
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
