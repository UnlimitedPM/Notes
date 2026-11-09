<script lang="ts">
  import Icon from './Icon.svelte';
  import { formatCardDate, plainText } from '../format';
  import type { Note } from '../types';

  interface Props {
    note: Note;
    onopen: (id: string) => void;
    onlong: (note: Note) => void;
  }

  let { note, onopen, onlong }: Props = $props();

  let timer: ReturnType<typeof setTimeout> | undefined;
  let longPressed = false;

  const text = $derived(plainText(note));

  function pressStart() {
    longPressed = false;
    clearTimeout(timer);
    timer = setTimeout(() => {
      longPressed = true;
      onlong(note);
    }, 420);
  }

  function pressEnd() {
    clearTimeout(timer);
  }

  function handleClick(event: MouseEvent) {
    if (longPressed) {
      event.preventDefault();
      longPressed = false;
      return;
    }
    onopen(note.id);
  }

  function handleContext(event: MouseEvent) {
    event.preventDefault();
    onlong(note);
  }
</script>

<button
  class="note-card"
  data-note-color={note.color}
  onpointerdown={pressStart}
  onpointerup={pressEnd}
  onpointerleave={pressEnd}
  onpointercancel={pressEnd}
  oncontextmenu={handleContext}
  onclick={handleClick}
>
  {#if note.title}
    <h3 class="card-title">{note.title}</h3>
  {/if}

  {#if note.kind === 'checklist'}
    <div class="card-checks">
      {#each note.items.slice(0, 3) as item (item.id)}
        <div class="mini-row" class:done={item.done}>
          <span class="mini-box">
            {#if item.done}<Icon name="check" size={9} stroke={3.4} />{/if}
          </span>
          <span class="mini-text">{item.text || 'Élément'}</span>
        </div>
      {/each}
      {#if note.items.length > 3}
        <div class="mini-more">+{note.items.length - 3}</div>
      {/if}
    </div>
  {:else if text}
    <p class="card-snippet">{text}</p>
  {/if}

  <div class="card-foot">
    <span class="card-date">{formatCardDate(note.updatedAt)}</span>
    {#if note.pinned}
      <Icon name="pin" size={13} stroke={1.7} class="pin" />
    {/if}
  </div>
</button>

<style>
  .note-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
    padding: 13px 14px 10px;
    text-align: left;
    border-radius: 16px;
    background: var(--card-bg, var(--surface));
    border: 1px solid var(--line);
    box-shadow: var(--shadow-card);
    transition: transform 0.12s ease;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }

  .note-card:active {
    transform: scale(0.985);
  }

  [data-note-color]:not([data-note-color='default']) {
    border-color: transparent;
  }

  .card-title {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    line-height: 1.35;
    letter-spacing: -0.1px;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    overflow-wrap: anywhere;
  }

  .card-snippet {
    margin: 0;
    font-size: 13px;
    line-height: 1.45;
    color: var(--text-2);
    white-space: pre-line;
    display: -webkit-box;
    -webkit-line-clamp: 6;
    line-clamp: 6;
    -webkit-box-orient: vertical;
    overflow: hidden;
    overflow-wrap: anywhere;
  }

  .card-checks {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 1px;
  }

  .mini-row {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
    line-height: 1.35;
    color: var(--text-2);
    min-width: 0;
  }

  .mini-row.done .mini-text {
    color: var(--text-3);
    text-decoration: line-through;
  }

  .mini-box {
    flex: 0 0 auto;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 1.4px solid var(--text-3);
    display: grid;
    place-items: center;
    color: #fff;
    background: transparent;
  }

  .mini-row.done .mini-box {
    background: var(--accent);
    border-color: var(--accent);
  }

  .mini-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mini-more {
    font-size: 12px;
    color: var(--text-3);
    padding-left: 21px;
  }

  .card-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    margin-top: auto;
    padding-top: 3px;
  }

  .card-date {
    font-size: 11.5px;
    color: var(--text-3);
  }

  :global(.pin) {
    color: var(--accent);
  }
</style>
