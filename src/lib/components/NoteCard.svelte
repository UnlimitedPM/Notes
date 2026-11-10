<script lang="ts">
  import Icon from './Icon.svelte';
  import { formatCardDate, htmlToText } from '../format';
  import type { Note } from '../types';

  interface Props {
    note: Note;
    selected?: boolean;
    selectable?: boolean;
    onopen: (id: string) => void;
    onlong: (note: Note) => void;
    ontoggle?: (id: string) => void;
  }

  let { note, selected = false, selectable = false, onopen, onlong, ontoggle }: Props = $props();

  let timer: ReturnType<typeof setTimeout> | undefined;
  let longPressed = false;

  const image = $derived(note.html.match(/<img[^>]+src="([^"]+)"/i)?.[1] ?? null);
  const lines = $derived(
    htmlToText(note.html)
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  );
  const displayTitle = $derived(note.title || lines[0] || '');
  const preview = $derived(note.title ? lines.join('\n') : lines.slice(1).join('\n'));

  function pressStart() {
    if (selectable) return;
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
    if (selectable) {
      ontoggle?.(note.id);
      return;
    }
    onopen(note.id);
  }

  function handleContext(event: MouseEvent) {
    event.preventDefault();
    if (!selectable) onlong(note);
  }
</script>

<button
  class="note-card"
  class:selected
  data-note-color={note.color}
  onpointerdown={pressStart}
  onpointerup={pressEnd}
  onpointerleave={pressEnd}
  onpointercancel={pressEnd}
  oncontextmenu={handleContext}
  onclick={handleClick}
>
  {#if image}
    <span class="thumb"><img src={image} alt="" /></span>
  {/if}
  <span class="content">
    {#if displayTitle}
      <h3 class="card-title">{displayTitle}</h3>
    {/if}
    {#if !image}
      <p class="card-text">{preview || 'Pas de texte'}</p>
    {/if}
    <span class="card-date">
      {#if note.remindAt}
        <span class="remind"><Icon name="bell" size={13} stroke={2} />{formatCardDate(note.remindAt)}</span>
        <span class="dot-sep">·</span>
      {/if}
      {formatCardDate(note.updatedAt)}
    </span>
  </span>
  {#if selectable}
    <span class="pick" class:on={selected}>
      {#if selected}<Icon name="check" size={14} stroke={3} />{/if}
    </span>
  {/if}
</button>

<style>
  .note-card {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    min-height: 145px;
    padding: 0;
    text-align: left;
    border-radius: 16px;
    background: var(--card-bg, var(--surface-2));
    color: var(--text);
    overflow: hidden;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    transition: transform 0.12s ease;
  }

  .note-card:active {
    transform: scale(0.985);
  }

  .thumb {
    display: block;
    width: 100%;
    background: #f5f5f5;
  }

  .thumb img {
    display: block;
    width: 100%;
    aspect-ratio: 4 / 3;
    object-fit: cover;
  }

  .content {
    display: flex;
    flex-direction: column;
    flex: 1;
    width: 100%;
    padding: 15px;
  }

  .card-title {
    margin: 0;
    font-size: var(--card-title);
    font-weight: 700;
    line-height: 1.3;
    letter-spacing: -0.1px;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    overflow-wrap: anywhere;
  }

  .card-text {
    margin: 12px 0 0;
    font-size: var(--card-text);
    line-height: 1.6;
    color: var(--text-2);
    white-space: pre-line;
    overflow-wrap: anywhere;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 5;
    line-clamp: 5;
    -webkit-box-orient: vertical;
  }

  .card-date {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: auto;
    padding-top: 14px;
    font-size: 13px;
    line-height: 1.2;
    color: var(--text-3);
    white-space: nowrap;
    overflow: hidden;
  }

  .remind {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    color: var(--accent);
  }

  .dot-sep {
    opacity: 0.6;
  }

  .pick {
    position: absolute;
    right: 10px;
    bottom: 10px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: rgba(120, 120, 128, 0.5);
    display: grid;
    place-items: center;
    color: #fff;
    transition: background 0.15s ease;
  }

  .pick.on {
    background: var(--accent);
  }
</style>
