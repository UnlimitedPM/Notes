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
    class="confirm"
    role="alertdialog"
    aria-modal="true"
    aria-label={confirmStore.title}
    transition:fly={{ y: 60, duration: 230, opacity: 0.4 }}
  >
    <h2>{confirmStore.title}</h2>
    <p>{confirmStore.message}</p>
    <div class="buttons">
      <button class="btn" onclick={() => confirmStore.answer(false)}>Annuler</button>
      <button class="btn danger" onclick={() => confirmStore.answer(true)}>
        {confirmStore.confirmLabel}
      </button>
    </div>
  </div>
{/if}

<style>
  .confirm {
    position: fixed;
    left: 26px;
    right: 26px;
    bottom: calc(78px + var(--safe-bottom));
    z-index: 41;
    max-width: 460px;
    margin: 0 auto;
    padding: 22px 22px 18px;
    border-radius: 26px;
    background: #2c2c2e;
    color: #fff;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45);
  }

  h2 {
    margin: 0;
    text-align: center;
    font-size: 19px;
    font-weight: 600;
  }

  p {
    margin: 12px 0 20px;
    text-align: center;
    font-size: 16px;
    color: #c7c7cc;
  }

  .buttons {
    display: flex;
    gap: 12px;
  }

  .btn {
    flex: 1;
    height: 50px;
    border-radius: 16px;
    background: #3a3a3c;
    color: #fff;
    font-size: 16px;
    font-weight: 500;
  }

  .btn:active {
    opacity: 0.8;
  }

  .btn.danger {
    color: #ff453a;
  }
</style>
