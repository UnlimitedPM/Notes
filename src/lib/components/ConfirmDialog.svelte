<script lang="ts">
  import { confirmStore } from '../confirm.svelte';
  import { fade, fly } from 'svelte/transition';
</script>

{#if confirmStore.open}
  <button
    class="scrim"
    aria-label="Annuler"
    onclick={() => confirmStore.answer(false)}
    transition:fade={{ duration: 140 }}
  ></button>
  <div
    class="sheet confirm-sheet"
    role="alertdialog"
    aria-modal="true"
    aria-label={confirmStore.message}
    transition:fly={{ y: 70, duration: 250, opacity: 0.4 }}
  >
    <div class="sheet-handle"></div>
    <p class="confirm-text">{confirmStore.message}</p>
    <div class="confirm-actions">
      <button class="confirm-btn" onclick={() => confirmStore.answer(false)}>Annuler</button>
      <button class="confirm-btn danger" onclick={() => confirmStore.answer(true)}>
        {confirmStore.confirmLabel}
      </button>
    </div>
  </div>
{/if}

<style>
  .confirm-sheet {
    padding: 0 10px calc(12px + var(--safe-bottom));
  }

  .confirm-text {
    margin: 0;
    padding: 16px 16px 6px;
    font-size: 16px;
    line-height: 1.45;
    color: var(--text);
  }

  .confirm-actions {
    display: flex;
    gap: 8px;
    padding: 10px 6px 2px;
  }

  .confirm-btn {
    flex: 1;
    height: 48px;
    border-radius: 14px;
    background: var(--surface-2);
    font-size: 16px;
    font-weight: 600;
  }

  .confirm-btn:active {
    opacity: 0.75;
  }

  .confirm-btn.danger {
    background: rgba(229, 72, 77, 0.14);
    color: var(--danger);
  }
</style>
