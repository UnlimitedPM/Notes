<script lang="ts">
  import type { Snippet } from 'svelte';
  import { fade, fly } from 'svelte/transition';

interface Props {
  open: boolean;
  title?: string;
  onclose: () => void;
  children: Snippet;
}

let { open, title = '', onclose, children }: Props = $props();
</script>

{#if open}
  <button class="scrim" aria-label="Fermer" onclick={onclose} transition:fade={{ duration: 140 }}
  ></button>
  <div
    class="sheet"
    role="dialog"
    aria-modal="true"
    aria-label={title || 'Options'}
    transition:fly={{ y: 60, duration: 240, opacity: 0.4 }}
  >
    <div class="sheet-handle"></div>
    {#if title}<div class="sheet-title">{title}</div>{/if}
    {@render children()}
  </div>
{/if}
