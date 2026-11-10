<script lang="ts">
  import Icon from './Icon.svelte';
  import { notesStore } from '../notes.svelte';
  import { confirmStore } from '../confirm.svelte';
  import { formatDay } from '../format';

  interface Props {
    onclose: () => void;
  }

  let { onclose }: Props = $props();

  async function purge(id: string) {
    const ok = await confirmStore.ask(
      'Supprimer définitivement',
      'Cette note ne pourra pas être récupérée.',
      'Supprimer'
    );
    if (ok) notesStore.purge(id);
  }

  async function emptyTrash() {
    const ok = await confirmStore.ask(
      'Vider la corbeille',
      'Toutes les notes supprimées seront perdues.',
      'Vider'
    );
    if (ok) notesStore.emptyTrash();
  }
</script>

<div class="trash">
  <header class="trash-head">
    <button class="icon-btn" onclick={onclose} aria-label="Retour">
      <Icon name="back" size={25} />
    </button>
    {#if notesStore.trash.length}
      <button class="text-btn" onclick={emptyTrash}>Vider</button>
    {/if}
  </header>

  <h1 class="screen-title">Corbeille</h1>

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
        <div class="empty-art"><Icon name="trash" size={38} stroke={1.5} /></div>
        <p class="empty-title">Corbeille vide</p>
        <p class="empty-sub">Les notes supprimées apparaissent ici</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .trash {
    height: var(--app-height, 100dvh);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg);
  }

  .trash-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: calc(var(--safe-top) + 4px) 12px 0 8px;
  }

  .trash-scroll {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 22px 16px calc(40px + var(--safe-bottom));
  }

  .trash-row {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 16px 8px 16px 18px;
    border-radius: 18px;
    background: var(--card-bg, var(--surface-2));
    margin-bottom: 10px;
  }

  .trash-main {
    flex: 1;
    min-width: 0;
    padding-right: 8px;
  }

  .trash-title {
    font-size: 16.5px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .trash-date {
    font-size: 13px;
    color: var(--text-3);
    margin-top: 3px;
  }
</style>
