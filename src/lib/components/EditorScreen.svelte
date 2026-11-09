<script lang="ts">
  import { onMount, tick } from 'svelte';
  import Icon from './Icon.svelte';
  import Sheet from './Sheet.svelte';
  import { cloneItems, notesStore, uid } from '../notes.svelte';
  import { NOTE_COLORS } from '../colors';
  import { escapeHtml, formatNoteDate, htmlToText } from '../format';
  import { toast } from '../toast.svelte';
  import type { ChecklistItem, Note, NoteColorKey } from '../types';

  type SheetName = 'format' | 'more' | 'color' | 'folder' | null;

  interface Props {
    note: Note;
    onclose: () => void;
  }

  let { note, onclose }: Props = $props();

  // Le composant est remonté pour chaque note (clé sur l'id) : état initial capturé.
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

  let editing = $state(false);
  let sheet = $state<SheetName>(null);
  let savedRange: Range | null = null;

  let pending: Partial<Note> = {};
  let timer: ReturnType<typeof setTimeout> | undefined;

  let history: ChecklistItem[][] = [];
  let historyIndex = -1;

  const chars = $derived(
    kind === 'text'
      ? htmlToText(html).length
      : items.reduce((total, item) => total + item.text.length, 0)
  );
  const charLabel = $derived(`${chars} caractère${chars > 1 ? 's' : ''}`);
  const meta = $derived(formatNoteDate(note.updatedAt));

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

  function onBodyInput() {
    html = bodyEl?.innerHTML ?? '';
    queue({ html });
  }

  function startEditing() {
    if (!editing) editing = true;
  }

  function stopEditing() {
    flush();
    editing = false;
    (document.activeElement as HTMLElement | null)?.blur();
  }

  function goBack() {
    if (editing) {
      stopEditing();
      return;
    }
    flush();
    onclose();
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
    if (kind !== 'text') {
      toast.show('Les images sont disponibles dans les notes texte');
      return;
    }
    bodyEl?.focus();
    document.execCommand('insertHTML', false, markup);
    onBodyInput();
  }

  function undo() {
    if (kind === 'text') {
      bodyEl?.focus();
      document.execCommand('undo');
      onBodyInput();
      return;
    }
    if (historyIndex > 0) {
      historyIndex -= 1;
      items = cloneItems(history[historyIndex]);
      queue({ items: cloneItems(items) });
    }
  }

  function redo() {
    if (kind === 'text') {
      bodyEl?.focus();
      document.execCommand('redo');
      onBodyInput();
      return;
    }
    if (historyIndex < history.length - 1) {
      historyIndex += 1;
      items = cloneItems(history[historyIndex]);
      queue({ items: cloneItems(items) });
    }
  }

  function pushHistory() {
    history = history.slice(0, historyIndex + 1);
    history.push(cloneItems(items));
    if (history.length > 60) history.shift();
    historyIndex = history.length - 1;
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
    pushHistory();
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
    pushHistory();
    queue({ items: cloneItems(items) });
    await tick();
    focusItem(Math.max(0, at - 1));
  }

  function toggleItem(index: number) {
    const item = items[index];
    if (!item) return;
    item.done = !item.done;
    pushHistory();
    queue({ items: cloneItems(items) });
  }

  function saveItems() {
    queue({ items: cloneItems(items) });
  }

  function commitItems() {
    pushHistory();
    saveItems();
  }

  async function onItemKey(event: KeyboardEvent, index: number) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      commitItems();
      await addItem(index + 1);
      return;
    }
    if (event.key === 'Backspace' && !items[index]?.text) {
      event.preventDefault();
      await removeItem(index);
    }
  }

  function pickImage() {
    if (kind !== 'text') {
      toast.show('Les images sont disponibles dans les notes texte');
      return;
    }
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

  function convertKind() {
    flush();
    if (kind === 'text') {
      const raw = (bodyEl?.innerText ?? '').trim();
      const lines = raw
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      items = (lines.length ? lines : ['']).map((text) => ({ id: uid(), text, done: false }));
      kind = 'checklist';
      history = [cloneItems(items)];
      historyIndex = 0;
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
    sheet = null;
  }

  function togglePin() {
    void notesStore.update(id, { pinned: !note.pinned });
    sheet = null;
  }

  function chooseColor(color: NoteColorKey) {
    void notesStore.update(id, { color });
    sheet = null;
  }

  function setFolder(folderId: string | null) {
    void notesStore.update(id, { folderId });
    sheet = null;
  }

  function duplicateNote() {
    flush();
    notesStore.duplicate(note);
    sheet = null;
    onclose();
  }

  function removeNote() {
    flush();
    notesStore.trashNote(id);
    onclose();
  }

  async function share() {
    const text = (
      kind === 'text' ? `${title}\n\n${htmlToText(html)}` : `${title}\n\n${items.map((i) => i.text).join('\n')}`
    ).trim();
    try {
      if (navigator.share) {
        await navigator.share({ title: title || 'Note', text });
      } else {
        await navigator.clipboard.writeText(text);
        toast.show('Note copiée');
      }
    } catch {
      /* partage annulé */
    }
  }

  onMount(() => {
    history = [cloneItems(items)];
    historyIndex = 0;

    document.addEventListener('selectionchange', trackSelection);
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('beforeunload', flush);

    const fresh = !note.title && !note.html && note.items.every((i) => !i.text.trim());
    if (fresh) {
      editing = true;
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

<div class="note" data-note-color={note.color}>
  <header class="note-bar">
    <button class="icon-btn" onclick={goBack} aria-label="Retour">
      <Icon name="back" size={25} />
    </button>

    {#if editing}
      <div class="bar-right">
        <button class="icon-btn" onclick={undo} aria-label="Annuler">
          <Icon name="undo" size={23} />
        </button>
        <button class="icon-btn" onclick={redo} aria-label="Rétablir">
          <Icon name="redo" size={23} />
        </button>
        <button class="icon-btn" onclick={stopEditing} aria-label="Terminer l'édition">
          <Icon name="check" size={25} stroke={2.1} />
        </button>
      </div>
    {:else}
      <div class="bar-right">
        <button class="icon-btn" onclick={share} aria-label="Partager">
          <Icon name="share" size={24} />
        </button>
        <button class="icon-btn" onclick={() => (sheet = 'color')} aria-label="Style de la note">
          <Icon name="tshirt" size={24} />
        </button>
        <button class="icon-btn" onclick={() => (sheet = 'more')} aria-label="Plus d'options">
          <Icon name="more" size={23} />
        </button>
      </div>
    {/if}
  </header>

  <div class="doc" bind:this={docEl}>
    <input
      bind:this={titleEl}
      bind:value={title}
      class="note-title"
      placeholder="Titre"
      autocomplete="off"
      oninput={onTitleInput}
      onfocus={startEditing}
      onkeydown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          bodyEl?.focus();
        }
      }}
    />

    <div class="note-meta">
      <span>{meta}</span>
      <span class="separator">|</span>
      <span>{charLabel}</span>
    </div>

    {#if kind === 'text'}
      <div
        class="note-body"
        contenteditable="true"
        spellcheck="false"
        data-placeholder="Écrivez quelque chose…"
        bind:this={bodyEl}
        use:initBody
        oninput={onBodyInput}
        onfocus={startEditing}
      ></div>
    {:else}
      <div class="checklist" onfocusin={startEditing}>
        {#each items as item, index (item.id)}
          <div class="check-row" class:done={item.done}>
            <button
              class="check-box"
              onclick={() => toggleItem(index)}
              aria-label={item.done ? 'Décocher' : 'Cocher'}
            >
              {#if item.done}<Icon name="check" size={15} stroke={3.2} />{/if}
            </button>
            <textarea
              class="check-input"
              rows="1"
              bind:value={item.text}
              placeholder="Élément"
              spellcheck="false"
              use:autoGrow
              oninput={saveItems}
              onblur={commitItems}
              onkeydown={(event) => onItemKey(event, index)}
            ></textarea>
          </div>
        {/each}
        <button class="add-check" onclick={() => addItem(items.length)}>
          <Icon name="plus" size={21} />
          <span>Ajouter un élément</span>
        </button>
      </div>
    {/if}
  </div>

  {#if editing}
    <div class="edit-tools">
      <button class="tool-btn" onclick={() => toast.show('Notes vocales bientôt disponibles')} aria-label="Note vocale">
        <Icon name="waveform" size={25} />
      </button>
      <button class="tool-btn" onclick={pickImage} aria-label="Insérer une image">
        <Icon name="image" size={25} />
      </button>
      <button class="tool-btn" onclick={() => toast.show('Dessin bientôt disponible')} aria-label="Dessiner">
        <Icon name="draw" size={25} />
      </button>
      <button
        class="tool-btn"
        class:active={kind === 'checklist'}
        onclick={convertKind}
        aria-label="Liste de cases à cocher"
      >
        <Icon name="check-square" size={25} />
      </button>
      {#if kind === 'text'}
        <button class="tool-btn" onclick={() => (sheet = 'format')} aria-label="Mise en forme">
          <Icon name="t" size={25} />
        </button>
      {/if}
      <input
        bind:this={fileEl}
        class="file-input"
        type="file"
        accept="image/*"
        onchange={onFileChange}
      />
    </div>
  {/if}

  <Sheet
    open={sheet !== null}
    onclose={() => (sheet = null)}
    title={sheet === 'format'
      ? 'Mise en forme'
      : sheet === 'color'
        ? 'Couleur de la note'
        : sheet === 'folder'
          ? 'Dossier'
          : ''}
  >
    {#if sheet === 'format'}
      <div class="fmt-grid">
        <button class="fmt-btn" onclick={() => exec('bold')} onpointerdown={(e) => e.preventDefault()}>
          <span class="glyph bold">B</span><span>Gras</span>
        </button>
        <button class="fmt-btn" onclick={() => exec('italic')} onpointerdown={(e) => e.preventDefault()}>
          <span class="glyph italic">I</span><span>Italique</span>
        </button>
        <button class="fmt-btn" onclick={() => exec('underline')} onpointerdown={(e) => e.preventDefault()}>
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
          onclick={() => exec('hiliteColor', '#FFB300')}
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
    {:else if sheet === 'more'}
      <button class="sheet-row" onclick={togglePin}>
        <Icon name={note.pinned ? 'pin-filled' : 'pin'} size={22} />
        <span class="grow">{note.pinned ? 'Désépingler' : 'Épingler'}</span>
      </button>
      <button class="sheet-row" onclick={() => (sheet = 'folder')}>
        <Icon name="folder" size={22} />
        <span class="grow">Dossier</span>
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
    {:else if sheet === 'color'}
      <div class="colors">
        {#each NOTE_COLORS as color (color.key)}
          <button class="swatch-wrap" onclick={() => chooseColor(color.key)} aria-label={color.label}>
            <span class="swatch" data-note-color={color.key}>
              {#if note.color === color.key}
                <Icon name="check" size={16} stroke={2.6} />
              {/if}
            </span>
            <span class="swatch-label">{color.label}</span>
          </button>
        {/each}
      </div>
    {:else if sheet === 'folder'}
      <button class="sheet-row" onclick={() => setFolder(null)}>
        <Icon name="note" size={22} />
        <span class="grow">Aucun dossier</span>
        {#if !note.folderId}<Icon name="check" size={18} class="check" />{/if}
      </button>
      {#each notesStore.folders as folder (folder.id)}
        <button class="sheet-row" onclick={() => setFolder(folder.id)}>
          <Icon name="folder" size={22} />
          <span class="grow">{folder.name}</span>
          {#if note.folderId === folder.id}
            <Icon name="check" size={18} class="check" />
          {/if}
        </button>
      {/each}
    {/if}
  </Sheet>
</div>

<style>
  .note {
    height: 100dvh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--note-bg, var(--bg));
    color: var(--text);
  }

  .note-bar {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: calc(var(--safe-top) + 4px) 8px 0;
  }

  .bar-right {
    margin-left: auto;
    display: flex;
    align-items: center;
  }

  .doc {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 6px 18px 40px;
  }

  .note-title {
    display: block;
    width: 100%;
    margin: 22px 0 0;
    padding: 0;
    border: 0;
    background: transparent;
    outline: none;
    font-size: var(--note-title);
    font-weight: 700;
    letter-spacing: -0.5px;
    line-height: 1.24;
    color: var(--text);
  }

  .note-title::placeholder {
    color: var(--text-3);
  }

  .note-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 10px;
    font-size: 14px;
    color: var(--text-3);
  }

  .separator {
    opacity: 0.6;
  }

  .note-body {
    margin-top: 24px;
    min-height: 40vh;
    outline: none;
    font-size: var(--note-text);
    line-height: 1.8;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }

  .note-body:empty::before {
    content: attr(data-placeholder);
    color: var(--text-3);
    pointer-events: none;
  }

  .note-body :global(img) {
    display: block;
    max-width: 100%;
    height: auto;
    margin: 14px 0;
    border-radius: 14px;
  }

  .note-body :global(h2) {
    font-size: calc(var(--note-text) + 3px);
    line-height: 1.4;
    margin: 18px 0 4px;
    font-weight: 700;
  }

  .note-body :global(ul),
  .note-body :global(ol) {
    padding-left: 24px;
    margin: 8px 0;
  }

  .checklist {
    margin-top: 22px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .check-row {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 7px 0;
  }

  .check-box {
    flex: 0 0 auto;
    width: 25px;
    height: 25px;
    margin-top: 3px;
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
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    outline: none;
    resize: none;
    overflow: hidden;
    font-size: var(--note-text);
    line-height: 1.45;
    color: var(--text);
  }

  .check-row.done .check-input {
    color: var(--text-3);
    text-decoration: line-through;
  }

  .add-check {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 0 6px;
    color: var(--text-3);
    font-size: 16px;
  }

  .add-check:active {
    color: var(--accent);
  }

  .edit-tools {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-around;
    gap: 4px;
    padding: 6px 8px calc(8px + var(--safe-bottom));
    background: var(--surface-2);
    border-top: 1px solid var(--line);
  }

  .tool-btn {
    width: 52px;
    height: 48px;
    display: grid;
    place-items: center;
    border-radius: 12px;
    color: var(--text);
  }

  .tool-btn:active {
    background: var(--surface-3);
  }

  .tool-btn.active {
    color: var(--accent);
  }

  .file-input {
    display: none;
  }

  :global(.check) {
    color: var(--accent);
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
    background: var(--card-bg, var(--surface-2));
    border: 1px solid var(--line);
  }

  .swatch-label {
    font-size: 11.5px;
    color: var(--text-3);
  }
</style>
