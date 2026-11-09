<script lang="ts">
  import Icon from './Icon.svelte';
  import { notesStore } from '../notes.svelte';
  import { formatDay } from '../format';

  interface Props {
    onclose: () => void;
  }

  let { onclose }: Props = $props();

  function purge(id: string) {
    if (confirm('Supprimer définitivement cette note ?')) notesStore.purge(id);
  }

  function emptyTrash() {
    if (confirm('Vider la corbeille ? Cette action est définitive.')) notesStore.emptyTrash();
  }
</script>

<div class="trash">
  <header class="trash-head">
    <button class="icon-btn" onclick={onclose} aria-label="Retour">
      <Icon name="back" />
    </button>
    <h1>Corbeille</h1>
    {#if notesStore.trash.length}
      <button class="text-btn" onclick={emptyTrash}>Vider</button>
    {/if}
  </header>

  <div class="trash-scroll">
    {#if notesStore.trash.length}
      {#each notesStore.trash as note (note.id)}
        <div class="trash-row">
          <div class="trash-main">
            <div class="trash-title">{note.title || 'Sans titre'}</div>
            <div class="trash-date">
              Supprimée le {formatDay(note.deletedAt ?? note.updatedAt)}
            </div>
          </div>
          <button
            class="icon-btn"
            onclick={() => notesStore.restore(note.id)}
            aria-label="Restaurer"
          >
            <Icon name="restore" size={21} />
          </button>
          <button
            class="icon-btn danger"
            onclick={() => purge(note.id)}
            aria-label="Supprimer définitivement"
          >
            <Icon name="trash" size={21} />
          </button>
        </div>
      {/each}
    {:else}
      <div class="empty">
        <div class="empty-art">
          <Icon name="trash" size={40} stroke={1.5} />
        </div>
        <p class="empty-title">Corbeille vide</p>
        <p class="empty-sub">Les notes supprimées apparaissent ici</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .trash {
    height: 100dvh;
    display: flex;
    flex-direction: column;
  }

  .trash-head {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: calc(var(--safe-top) + 10px) 12px 8px 8px;
  }

  .trash-head h1 {
    flex: 1;
    margin: 0;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.5px;
  }

  .trash-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 0 12px 120px;
  }

  .trash-row {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 12px 4px 12px 16px;
    border-radius: 16px;
    background: var(--surface);
    border: 1px solid var(--line);
    margin-bottom: 8px;
  }

  .trash-main {
    flex: 1;
    min-width: 0;
    padding-right: 6px;
  }

  .trash-title {
    font-size: 15.5px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .trash-date {
    font-size: 12.5px;
    color: var(--text-3);
    margin-top: 2px;
  }
</style>
