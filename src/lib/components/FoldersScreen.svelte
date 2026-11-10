<script lang="ts">
  import { tick } from 'svelte';
  import Icon from './Icon.svelte';
  import { notesStore } from '../notes.svelte';
  import { confirmStore } from '../confirm.svelte';
  import type { Folder } from '../types';

  interface Props {
    onclose: () => void;
  }

  let { onclose }: Props = $props();

  let adding = $state(false);
  let name = $state('');
  let input = $state<HTMLInputElement | null>(null);
  let deleteMode = $state(false);

  const allCount = $derived(notesStore.active.length);
  const noneCount = $derived(notesStore.active.filter((n) => !n.folderId).length);

  function select(category: string) {
    notesStore.activeCategory = category;
    onclose();
  }

  async function startAdd() {
    adding = true;
    await tick();
    input?.focus();
  }

  function create() {
    const folder = notesStore.createFolder(name);
    name = '';
    adding = false;
    if (folder) notesStore.activeCategory = folder.id;
    onclose();
  }

  async function remove(folder: Folder) {
    const ok = await confirmStore.ask(
      'Supprimer le dossier',
      `Supprimer « ${folder.name} » ? Les notes ne sont pas supprimées.`,
      'Supprimer'
    );
    if (ok) notesStore.deleteFolder(folder.id);
  }
</script>

<div class="folders">
  <header class="folders-head">
    <button class="icon-btn" onclick={onclose} aria-label="Retour">
      <Icon name="back" size={24} />
    </button>
    <h1>Dossiers</h1>
    <button
      class="icon-btn"
      class:active={deleteMode}
      onclick={() => (deleteMode = !deleteMode)}
      aria-label="Supprimer un dossier"
    >
      <Icon name="trash" size={23} />
    </button>
  </header>

  <div class="folders-scroll">
    <button class="folder-row" onclick={() => select('all')}>
      <span class="mark">
        {#if notesStore.activeCategory === 'all'}<Icon name="check" size={20} stroke={2.6} />{/if}
      </span>
      <span class="folder-name bold">Tous</span>
      <span class="count">{allCount}</span>
    </button>

    {#each notesStore.folders as folder (folder.id)}
      <div class="folder-line">
        <button class="folder-row" onclick={() => select(folder.id)}>
          <span class="mark">
            {#if notesStore.activeCategory === folder.id}
              <Icon name="check" size={20} stroke={2.6} />
            {/if}
          </span>
          <span class="folder-name">{folder.name}</span>
          {#if !deleteMode}
            <span class="count">{notesStore.countFolder(folder.id)}</span>
          {/if}
        </button>
        {#if deleteMode}
          <button class="row-delete" onclick={() => remove(folder)} aria-label={`Supprimer ${folder.name}`}>
            <Icon name="trash" size={20} />
          </button>
        {/if}
      </div>
    {/each}

    <button class="folder-row" onclick={() => select('none')}>
      <span class="mark">
        {#if notesStore.activeCategory === 'none'}<Icon name="check" size={20} stroke={2.6} />{/if}
      </span>
      <span class="folder-name">Sans catégorie</span>
      <span class="count">{noneCount}</span>
    </button>

    {#if adding}
      <div class="new-folder">
        <input
          bind:this={input}
          bind:value={name}
          placeholder="Nom du dossier"
          autocomplete="off"
          onkeydown={(event) => {
            if (event.key === 'Enter') create();
          }}
        />
        <button class="create" onclick={create}>Créer</button>
      </div>
    {:else}
      <button class="new-card" onclick={startAdd}>
        <span class="plus"><Icon name="plus" size={22} stroke={2.4} /></span>
        <span>Nouveau dossier</span>
      </button>
    {/if}
  </div>
</div>

<style>
  .folders {
    height: var(--app-height, 100dvh);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--surface);
  }

  .folders-head {
    display: flex;
    align-items: center;
    padding: calc(var(--safe-top) + 8px) 10px 8px;
  }

  .folders-head h1 {
    flex: 1;
    margin: 0;
    text-align: center;
    font-size: 19px;
    font-weight: 500;
    letter-spacing: -0.2px;
  }

  .icon-btn.active {
    color: var(--accent);
  }

  .folders-scroll {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 16px 18px 40px;
  }

  .folder-line {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .folder-row {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    height: 56px;
    padding: 0 18px;
    margin-bottom: 10px;
    border-radius: 16px;
    background: var(--surface-2);
    text-align: left;
  }

  .folder-line .folder-row {
    flex: 1;
    min-width: 0;
  }

  .mark {
    width: 22px;
    display: grid;
    place-items: center;
    color: var(--accent);
  }

  .folder-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 17px;
    color: var(--text);
  }

  .folder-name.bold {
    font-weight: 600;
  }

  .count {
    font-size: 15px;
    color: var(--text-3);
  }

  .row-delete {
    width: 44px;
    height: 44px;
    margin-bottom: 10px;
    display: grid;
    place-items: center;
    border-radius: 12px;
    color: var(--danger);
  }

  .new-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    height: 78px;
    margin-top: 4px;
    border-radius: 16px;
    background: var(--surface-2);
    color: var(--text-3);
    font-size: 14px;
  }

  .plus {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--accent);
    color: #fff;
    display: grid;
    place-items: center;
  }

  .new-folder {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
  }

  .new-folder input {
    flex: 1;
    min-width: 0;
    height: 52px;
    padding: 0 16px;
    border: 0;
    border-radius: 16px;
    background: var(--surface-2);
    outline: none;
    font-size: 16px;
  }

  .create {
    height: 52px;
    padding: 0 18px;
    border-radius: 16px;
    background: var(--accent);
    color: #fff;
    font-weight: 600;
    font-size: 15px;
  }
</style>
