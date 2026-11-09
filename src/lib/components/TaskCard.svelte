<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from './Icon.svelte';
  import { notesStore } from '../notes.svelte';
  import type { TaskEntry } from '../types';

  interface Props {
    task: TaskEntry;
  }

  let { task }: Props = $props();

  // svelte-ignore state_referenced_locally
  let text = $state(task.text);
  let timer: ReturnType<typeof setTimeout> | undefined;

  // svelte-ignore state_referenced_locally
  const id = task.itemId;
  // svelte-ignore state_referenced_locally
  const noteId = task.noteId;

  function commit() {
    clearTimeout(timer);
    if (text !== task.text) notesStore.setTaskText(noteId, id, text);
  }

  function onInput() {
    clearTimeout(timer);
    timer = setTimeout(commit, 350);
  }

  function onKey(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
      (event.currentTarget as HTMLTextAreaElement).blur();
    }
  }

  function autosize(node: HTMLTextAreaElement) {
    const resize = () => {
      node.style.height = 'auto';
      node.style.height = `${node.scrollHeight}px`;
    };
    resize();
    node.addEventListener('input', resize);
    return {
      destroy() {
        node.removeEventListener('input', resize);
      }
    };
  }

  onMount(() => () => commit());
</script>

<div class="task-card" class:done={task.done}>
  <button
    class="task-check"
    onclick={() => notesStore.toggleTask(noteId, id)}
    aria-label={task.done ? 'Décocher la tâche' : 'Cocher la tâche'}
  >
    {#if task.done}<Icon name="check" size={16} stroke={3.2} />{/if}
  </button>
  <textarea
    class="task-input"
    rows="1"
    bind:value={text}
    use:autosize
    oninput={onInput}
    onblur={commit}
    onkeydown={onKey}
    placeholder="Tâche"
    spellcheck="false"
  ></textarea>
</div>

<style>
  .task-card {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    width: 100%;
    padding: 18px;
    border-radius: 18px;
    background: var(--card-bg, var(--surface-2));
    margin-bottom: 10px;
  }

  .task-check {
    flex: 0 0 auto;
    width: 26px;
    height: 26px;
    margin-top: 1px;
    border-radius: 7px;
    border: 2px solid var(--text-3);
    display: grid;
    place-items: center;
    color: #fff;
    transition:
      background 0.15s ease,
      border-color 0.15s ease,
      transform 0.12s ease;
  }

  .task-check:active {
    transform: scale(0.9);
  }

  .task-card.done .task-check {
    background: var(--accent);
    border-color: var(--accent);
  }

  .task-input {
    flex: 1;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    resize: none;
    overflow: hidden;
    outline: none;
    font-size: var(--card-title);
    font-weight: 600;
    line-height: 1.35;
    color: var(--text);
  }

  .task-card.done .task-input {
    color: var(--text-3);
    text-decoration: line-through;
  }
</style>
