<script lang="ts">
  import { formatCardDate, htmlToText } from '../format';
  import type { Note } from '../types';

  interface Props {
    note: Note;
    onopen: (id: string) => void;
    onlong: (note: Note) => void;
  }

  let { note, onopen, onlong }: Props = $props();

  let timer: ReturnType<typeof setTimeout> | undefined;
  let longPressed = false;

  const image = $derived(note.html.match(/<img[^>]+src="([^"]+)"/i)?.[1] ?? null);
  const preview = $derived(
    note.kind === 'checklist'
      ? note.items
          .map((i) => i.text)
          .filter(Boolean)
          .join('\n')
      : htmlToText(note.html)
  );

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
  {#if image}
    <span class="thumb"><img src={image} alt="" /></span>
  {/if}
  <span class="content">
    {#if note.title}
      <h3 class="card-title">{note.title}</h3>
    {/if}
    {#if !image}
      <p class="card-text">{preview || 'Pas de texte'}</p>
    {/if}
    <span class="card-date">{formatCardDate(note.updatedAt)}</span>
  </span>
</button>

<style>
  .note-card {
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
    display: block;
    margin-top: auto;
    padding-top: 14px;
    font-size: 13px;
    line-height: 1.2;
    color: var(--text-3);
  }
</style>
