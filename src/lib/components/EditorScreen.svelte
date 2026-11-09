<script lang="ts">
  import { onMount, tick } from 'svelte';
  import Icon from './Icon.svelte';
  import Sheet from './Sheet.svelte';
  import { cloneItems, notesStore, uid } from '../notes.svelte';
  import { NOTE_COLORS } from '../colors';
  import { escapeHtml, formatMeta } from '../format';
  import type { ChecklistItem, Note, NoteColorKey } from '../types';

  interface Props {
    note: Note;
    onclose: () => void;
  }

  let { note, onclose }: Props = $props();

  // Le composant est remonté pour chaque note (clé sur l'id) : on capture l'état initial.
  // svelte-ignore state_referenced_locally
  const id = note.id;
  // svelte-ignore state_referenced_locally
  let title = $state(note.title);
  // svelte-ignore state_referenced_locally
  let kind = $state<Note['kind']>(note.kind);
  // svelte-ignore state_referenced_locally
  let html = $state(note.html);
  // svelte-ignore state_referenced_locally
  let items = $state<ChecklistItem[]>(note.items.map((i) => ({ ...i })));

  let titleEl = $state<HTMLInputElement | null>(null);
  let bodyEl = $state<HTMLDivElement | null>(null);
  let docEl = $state<HTMLDivElement | null>(null);
  let fileEl = $state<HTMLInputElement | null>(null);

  let formatOpen = $state(false);
  let moreOpen = $state(false);
  let colorOpen = $state(false);

  const meta = $derived(formatMeta(note.updatedAt));

  let pending: Partial<Note> = {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  let savedRange: Range | null = null;

  function queue(patch: Partial<Note>) {
    Object.assign(pending, patch);
    clearTimeout(timer);
    timer = setTimeout(flush, 250);
  }

  function flush() {
    clearTimeout(timer);
    timer = undefined;
    if (!Object.keys(pending).length) return;
    const patch = pending;
    pending = {};
    void notesStore.update(id, patch);
  }

  function initBody(node: HTMLDivElement) {
    node.innerHTML = html;
  }

  function onTitleInput() {
    queue({ title });
  }

  function onTitleKey(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      bodyEl?.focus();
    }
  }

  function onBodyInput() {
    html = bodyEl?.innerHTML ?? '';
    queue({ html });
  }

  function trackSelection() {
    if (kind !== 'text' || !bodyEl) return;
    const selection = document.getSelection();
    if (!selection || !selection.rangeCount) return;
    const node = selection.anchorNode;
    if (node && bodyEl.contains(node)) {
      savedRange = selection.getRangeAt(0).cloneRange();
    }
  }

  function exec(command: string, value?: string) {
    if (kind !== 'text') return;
    bodyEl?.focus();
    if (savedRange) {
      const selection = document.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(savedRange);
      }
    }
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(command, false, value);
    onBodyInput();
    trackSelection();
  }

  function insertHtml(markup: string) {
    if (kind !== 'text') return;
    bodyEl?.focus();
    document.execCommand('insertHTML', false, markup);
    onBodyInput();
  }

  function goBack() {
    flush();
    onclose();
  }

  function togglePin() {
    flush();
    void notesStore.update(id, { pinned: !note.pinned });
    moreOpen = false;
  }

  function chooseColor(color: NoteColorKey) {
    flush();
    void notesStore.update(id, { color });
    colorOpen = false;
  }

  function duplicateNote() {
    flush();
    notesStore.duplicate(note);
    moreOpen = false;
    onclose();
  }

  function removeNote() {
    flush();
    notesStore.trashNote(id);
    onclose();
  }

  function convertKind() {
    flush();
    if (kind === 'text') {
      const raw = (bodyEl?.innerText ?? '').trim();
      const lines = raw
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      items = (lines.length ? lines : ['']).map((text) => ({
        id: uid(),
        text,
        done: false
      }));
      kind = 'checklist';
      void notesStore.update(id, { kind, items: cloneItems(items), html });
      void tick().then(() => focusItem(0));
    } else {
      const nextHtml = items
        .filter((item) => item.text.trim())
        .map((item) => `<div>${escapeHtml(item.text)}</div>`)
        .join('');
      html = nextHtml;
      kind = 'text';
      void notesStore.update(id, { kind: 'text', html: nextHtml });
      void tick().then(() => bodyEl?.focus());
    }
    moreOpen = false;
  }

  function autosizeNow(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  function autoGrow(node: HTMLTextAreaElement) {
    const resize = () => autosizeNow(node);
    resize();
    node.addEventListener('input', resize);
    return {
      destroy() {
        node.removeEventListener('input', resize);
      }
    };
  }

  async function focusItem(index: number) {
    await tick();
    const nodes = docEl?.querySelectorAll<HTMLTextAreaElement>('.check-input');
    const node = nodes?.[index];
    if (node) {
      node.focus();
      const length = node.value.length;
      node.setSelectionRange(length, length);
    }
  }

  async function addItem(at: number) {
    items.splice(at, 0, { id: uid(), text: '', done: false });
    queue({ items: cloneItems(items) });
    await tick();
    focusItem(at);
  }

  async function removeItem(at: number) {
    if (items.length <= 1) {
      items[0].text = '';
      queue({ items: cloneItems(items) });
      await tick();
      focusItem(0);
      return;
    }
    items.splice(at, 1);
    queue({ items: cloneItems(items) });
    await tick();
    focusItem(Math.max(0, at - 1));
  }

  function toggleItem(index: number) {
    const item = items[index];
    if (!item) return;
    item.done = !item.done;
    queue({ items: cloneItems(items) });
  }

  function saveItems() {
    queue({ items: cloneItems(items) });
  }

  async function onItemKey(event: KeyboardEvent, index: number) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      await addItem(index + 1);
      return;
    }
    if (event.key === 'Backspace' && !items[index]?.text) {
      event.preventDefault();
      await removeItem(index);
    }
  }

  function pickImage() {
    fileEl?.click();
  }

  function onFileChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        insertHtml(`<img src="${reader.result}" alt="" />`);
      }
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  onMount(() => {
    document.addEventListener('selectionchange', trackSelection);
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('beforeunload', flush);

    const fresh = !note.title && !note.html && note.items.every((i) => !i.text.trim());
    if (fresh) {
      if (kind === 'checklist') void focusItem(0);
      else titleEl?.focus();
    }

    return () => {
      document.removeEventListener('selectionchange', trackSelection);
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('beforeunload', flush);
      flush();
    };
  });
</script>

<div class="editor" data-note-color={note.color}>
  <header class="editor-head">
    <button class="icon-btn" onclick={goBack} aria-label="Retour">
      <Icon name="back" />
    </button>
    <div class="head-right">
      <button
        class="icon-btn"
        class:active={note.pinned}
        onclick={() => notesStore.togglePin(id)}
        aria-label={note.pinned ? 'Désépingler' : 'Épingler'}
      >
        <Icon name={note.pinned ? 'pin-filled' : 'pin'} size={21} />
      </button>
      <button class="icon-btn" onclick={() => (colorOpen = true)} aria-label="Couleur">
        <Icon name="palette" size={21} />
      </button>
      <button class="icon-btn" onclick={() => (moreOpen = true)} aria-label="Plus d'options">
        <Icon name="more" />
      </button>
    </div>
  </header>

  <div class="doc" bind:this={docEl}>
    <div class="meta">Modifié · {meta}</div>

    <input
      bind:this={titleEl}
      bind:value={title}
      class="title-input"
      placeholder="Titre"
      autocomplete="off"
      enterkeyhint="next"
      oninput={onTitleInput}
      onkeydown={onTitleKey}
    />

    {#if kind === 'text'}
      <div
        class="body"
        contenteditable="true"
        spellcheck="true"
        data-placeholder="Note"
        bind:this={bodyEl}
        use:initBody
        oninput={onBodyInput}
      ></div>
    {:else}
      <div class="checklist">
        {#each items as item, index (item.id)}
          <div class="check-row" class:done={item.done}>
            <button
              class="check-box"
              onclick={() => toggleItem(index)}
              aria-label={item.done ? 'Décocher' : 'Cocher'}
            >
              {#if item.done}<Icon name="check" size={13} stroke={3.2} />{/if}
            </button>
            <textarea
              class="check-input"
              rows="1"
              bind:value={item.text}
              placeholder="Élément"
              spellcheck="true"
              use:autoGrow
              oninput={saveItems}
              onkeydown={(event) => onItemKey(event, index)}
            ></textarea>
          </div>
        {/each}
        <button class="add-check" onclick={() => addItem(items.length)}>
          <Icon name="plus" size={20} />
          <span>Ajouter un élément</span>
        </button>
      </div>
    {/if}
  </div>

  <div class="toolbar">
    {#if kind === 'text'}
      <button class="tool-btn" onclick={() => (formatOpen = true)} aria-label="Mise en forme">
        <span class="aa">Aa</span>
      </button>
    {/if}
    <button class="tool-btn" onclick={convertKind} aria-label="Convertir">
      <Icon name={kind === 'text' ? 'checklist' : 'text'} size={23} />
    </button>
    {#if kind === 'text'}
      <button class="tool-btn" onclick={pickImage} aria-label="Insérer une image">
        <Icon name="image" size={23} />
      </button>
    {/if}
    <button
      class="tool-btn"
      class:active={note.pinned}
      onclick={() => notesStore.togglePin(id)}
      aria-label="Épingler"
    >
      <Icon name={note.pinned ? 'pin-filled' : 'pin'} size={22} />
    </button>
    <button class="tool-btn" onclick={() => (moreOpen = true)} aria-label="Plus d'options">
      <Icon name="more" />
    </button>
    <input
      bind:this={fileEl}
      class="file-input"
      type="file"
      accept="image/*"
      onchange={onFileChange}
    />
  </div>

  <Sheet open={formatOpen} onclose={() => (formatOpen = false)} title="Mise en forme">
    <div class="fmt-grid">
      <button class="fmt-btn" onclick={() => exec('bold')} onpointerdown={(e) => e.preventDefault()}>
        <span class="glyph bold">B</span><span>Gras</span>
      </button>
      <button class="fmt-btn" onclick={() => exec('italic')} onpointerdown={(e) => e.preventDefault()}>
        <span class="glyph italic">I</span><span>Italique</span>
      </button>
      <button
        class="fmt-btn"
        onclick={() => exec('underline')}
        onpointerdown={(e) => e.preventDefault()}
      >
        <span class="glyph underline">U</span><span>Souligné</span>
      </button>
      <button
        class="fmt-btn"
        onclick={() => exec('strikeThrough')}
        onpointerdown={(e) => e.preventDefault()}
      >
        <span class="glyph strike">S</span><span>Barré</span>
      </button>
      <button
        class="fmt-btn"
        onclick={() => exec('hiliteColor', '#FFE58A')}
        onpointerdown={(e) => e.preventDefault()}
      >
        <Icon name="highlighter" size={21} /><span>Surligner</span>
      </button>
      <button
        class="fmt-btn"
        onclick={() => exec('formatBlock', 'H2')}
        onpointerdown={(e) => e.preventDefault()}
      >
        <span class="glyph">H</span><span>Titre</span>
      </button>
      <button
        class="fmt-btn"
        onclick={() => exec('insertUnorderedList')}
        onpointerdown={(e) => e.preventDefault()}
      >
        <Icon name="list-bullet" size={21} /><span>Puces</span>
      </button>
      <button
        class="fmt-btn"
        onclick={() => exec('insertOrderedList')}
        onpointerdown={(e) => e.preventDefault()}
      >
        <Icon name="list-number" size={21} /><span>Numéros</span>
      </button>
      <button
        class="fmt-btn"
        onclick={() => exec('removeFormat')}
        onpointerdown={(e) => e.preventDefault()}
      >
        <Icon name="clear-format" size={21} /><span>Effacer</span>
      </button>
    </div>
  </Sheet>

  <Sheet open={moreOpen} onclose={() => (moreOpen = false)}>
    <button class="sheet-row" onclick={togglePin}>
      <Icon name={note.pinned ? 'pin-filled' : 'pin'} size={22} />
      <span class="grow">{note.pinned ? 'Désépingler' : 'Épingler'}</span>
    </button>
    <button
      class="sheet-row"
      onclick={() => {
        moreOpen = false;
        setTimeout(() => (colorOpen = true), 210);
      }}
    >
      <Icon name="palette" size={22} />
      <span class="grow">Couleur</span>
    </button>
    <button class="sheet-row" onclick={duplicateNote}>
      <Icon name="copy" size={22} />
      <span class="grow">Dupliquer</span>
    </button>
    <button class="sheet-row" onclick={convertKind}>
      <Icon name={kind === 'text' ? 'checklist' : 'text'} size={22} />
      <span class="grow">
        {kind === 'text' ? 'Convertir en liste' : 'Convertir en note'}
      </span>
    </button>
    <button class="sheet-row danger" onclick={removeNote}>
      <Icon name="trash" size={22} />
      <span class="grow">Supprimer</span>
    </button>
  </Sheet>

  <Sheet open={colorOpen} onclose={() => (colorOpen = false)} title="Couleur de la note">
    <div class="colors">
      {#each NOTE_COLORS as color (color.key)}
        <button
          class="swatch-wrap"
          onclick={() => chooseColor(color.key)}
          aria-label={color.label}
        >
          <span class="swatch" data-note-color={color.key}>
            {#if note.color === color.key}
              <Icon name="check" size={16} stroke={2.6} />
            {/if}
          </span>
          <span class="swatch-label">{color.label}</span>
        </button>
      {/each}
    </div>
  </Sheet>
</div>

<style>
  .editor {
    position: relative;
    height: 100dvh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--card-bg, var(--surface));
  }

  .editor-head {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: calc(var(--safe-top) + 4px) 8px 0;
  }

  .head-right {
    margin-left: auto;
    display: flex;
    align-items: center;
  }

  .icon-btn.active {
    color: var(--accent);
  }

  .doc {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 0 20px 132px;
  }

  .meta {
    font-size: 12.5px;
    color: var(--text-3);
    margin: 2px 2px 10px;
  }

  .title-input {
    width: 100%;
    border: 0;
    background: transparent;
    padding: 2px 0 8px;
    font-size: 23px;
    font-weight: 700;
    letter-spacing: -0.3px;
    line-height: 1.3;
    outline: none;
  }

  .title-input::placeholder {
    color: var(--text-3);
    font-weight: 600;
  }

  .body {
    min-height: 45vh;
    outline: none;
    font-size: 16.5px;
    line-height: 1.62;
    overflow-wrap: anywhere;
  }

  .body:empty::before {
    content: attr(data-placeholder);
    color: var(--text-3);
    pointer-events: none;
  }

  .body :global(img) {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 10px 0;
    border-radius: 12px;
  }

  .body :global(h2) {
    font-size: 19px;
    line-height: 1.35;
    margin: 14px 0 4px;
    font-weight: 700;
  }

  .body :global(ul),
  .body :global(ol) {
    padding-left: 22px;
    margin: 6px 0;
  }

  .body :global(li) {
    margin: 3px 0;
  }

  .body :global(div) {
    min-height: 1.2em;
  }

  .checklist {
    display: flex;
    flex-direction: column;
    gap: 1px;
    margin-top: 2px;
  }

  .check-row {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 4px 0;
  }

  .check-box {
    flex: 0 0 auto;
    width: 23px;
    height: 23px;
    margin-top: 3px;
    border-radius: 50%;
    border: 1.6px solid var(--text-3);
    display: grid;
    place-items: center;
    color: #fff;
    transition:
      background 0.15s ease,
      border-color 0.15s ease,
      transform 0.12s ease;
  }

  .check-box:active {
    transform: scale(0.9);
  }

  .check-row.done .check-box {
    background: var(--accent);
    border-color: var(--accent);
  }

  .check-input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: transparent;
    outline: none;
    resize: none;
    overflow: hidden;
    font-size: 16.5px;
    line-height: 1.5;
    padding: 2px 0;
    margin: 0;
  }

  .check-row.done .check-input {
    color: var(--text-3);
    text-decoration: line-through;
  }

  .add-check {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 0 6px;
    color: var(--text-2);
    font-size: 15.5px;
  }

  .add-check:active {
    color: var(--accent);
  }

  .toolbar {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: space-evenly;
    gap: 2px;
    padding: 7px 6px calc(7px + var(--safe-bottom));
    background: var(--card-bg, var(--surface));
    border-top: 1px solid var(--line);
    backdrop-filter: blur(16px);
  }

  .tool-btn {
    width: 48px;
    height: 44px;
    display: grid;
    place-items: center;
    border-radius: 12px;
    color: var(--text);
  }

  .tool-btn:active {
    background: rgba(120, 120, 140, 0.16);
  }

  .tool-btn.active {
    color: var(--accent);
  }

  .aa {
    font-size: 19px;
    font-weight: 700;
    letter-spacing: -0.5px;
  }

  .file-input {
    display: none;
  }

  .fmt-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    padding: 2px 8px 10px;
  }

  .fmt-btn {
    height: 64px;
    border-radius: 14px;
    background: var(--surface-2);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    font-size: 11px;
    color: var(--text-2);
  }

  .fmt-btn:active {
    background: var(--accent-soft);
    color: var(--accent);
  }

  .glyph {
    font-size: 17px;
    font-weight: 800;
    line-height: 1;
    color: var(--text);
  }

  .glyph.italic {
    font-family: Georgia, 'Times New Roman', serif;
    font-style: italic;
    font-weight: 600;
  }

  .glyph.underline {
    text-decoration: underline;
  }

  .glyph.strike {
    text-decoration: line-through;
  }

  .colors {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    padding: 4px 8px 10px;
  }

  .swatch-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 6px 0;
    border-radius: 14px;
  }

  .swatch {
    width: 54px;
    height: 54px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    color: var(--text);
    background: var(--card-bg, var(--surface));
    border: 1px solid var(--line);
  }

  .swatch-label {
    font-size: 11.5px;
    color: var(--text-3);
  }
</style>
