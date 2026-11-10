<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from './Icon.svelte';
  import Sheet from './Sheet.svelte';
  import { notesStore } from '../notes.svelte';
  import { NOTE_COLORS } from '../colors';
  import { formatNoteDate, htmlToText } from '../format';
  import { toast } from '../toast.svelte';
  import type { Note, NoteColorKey } from '../types';

  type SheetName = 'more' | 'color' | 'folder' | null;

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
  let html = $state(note.html);

  let titleEl = $state<HTMLInputElement | null>(null);
  let bodyEl = $state<HTMLDivElement | null>(null);
  let fileEl = $state<HTMLInputElement | null>(null);

  let editing = $state(false);
  let formatOpen = $state(false);
  let sheet = $state<SheetName>(null);
  let savedRange: Range | null = null;

  let pending: Partial<Note> = {};
  let timer: ReturnType<typeof setTimeout> | undefined;

  const chars = $derived(htmlToText(html).length);
  const charLabel = $derived(`${chars} caractère${chars > 1 ? 's' : ''}`);
  const meta = $derived(formatNoteDate(note.updatedAt));

  let format = $state({
    bold: false,
    italic: false,
    h1: false,
    h2: false,
    h3: false,
    highlight: false
  });

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
    refreshFormat();
  }

  function startEditing() {
    if (!editing) editing = true;
  }

  function stopEditing() {
    formatOpen = false;
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
    if (!bodyEl) return;
    if (document.activeElement !== bodyEl) return;
    const selection = document.getSelection();
    if (!selection || !selection.rangeCount) return;
    const node = selection.anchorNode;
    if (node && bodyEl.contains(node)) {
      savedRange = selection.getRangeAt(0).cloneRange();
      refreshFormat();
    }
  }

  function ensureFocus() {
    if (!bodyEl) return;
    if (!document.activeElement || !bodyEl.contains(document.activeElement)) {
      bodyEl.focus();
    }
    if (savedRange) {
      const selection = document.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(savedRange);
      }
    }
  }

  function blockElement(): HTMLElement | null {
    if (!bodyEl) return null;
    const selection = document.getSelection();
    if (!selection || !selection.rangeCount) return null;
    let node: Node | null = selection.anchorNode;
    if (!node || !bodyEl.contains(node)) return null;
    let el: HTMLElement | null =
      node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
    while (el && el !== bodyEl) {
      if (el.parentElement === bodyEl) return el;
      el = el.parentElement;
    }
    return null;
  }

  function highlightedNodes(): HTMLElement[] {
    if (!bodyEl) return [];
    return Array.from(bodyEl.querySelectorAll<HTMLElement>('span, font')).filter(
      (el) => !!el.style.backgroundColor && el.style.backgroundColor !== 'transparent'
    );
  }

  function selectionHasHighlight(): boolean {
    if (!bodyEl) return false;
    const selection = document.getSelection();
    if (!selection || !selection.rangeCount) return false;

    const range = selection.getRangeAt(0);
    for (const node of highlightedNodes()) {
      if (range.intersectsNode(node)) return true;
    }

    let node: Node | null = selection.anchorNode;
    let el: HTMLElement | null =
      node?.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : (node?.parentElement ?? null);
    while (el && el !== bodyEl) {
      if (el.style.backgroundColor && el.style.backgroundColor !== 'transparent') return true;
      el = el.parentElement;
    }
    return false;
  }

  function refreshFormat() {
    if (!bodyEl) return;
    const block = blockElement();
    const tag = block?.tagName ?? '';
    format = {
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      h1: tag === 'H1',
      h2: tag === 'H2',
      h3: tag === 'H3',
      highlight: selectionHasHighlight()
    };
  }

  function exec(command: string, value?: string) {
    ensureFocus();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(command, false, value);
    onBodyInput();
  }

  function toggleBold() {
    exec('bold');
  }

  function toggleItalic() {
    exec('italic');
  }

  function toggleHeading(level: 1 | 2 | 3) {
    ensureFocus();
    const block = blockElement();
    if (block && block.tagName === `H${level}`) {
      exec('formatBlock', 'DIV');
    } else {
      exec('formatBlock', `H${level}`);
    }
    refreshFormat();
  }

  function highlightColor(): string {
    return document.documentElement.dataset.theme === 'light' ? '#FFE58A' : '#4D3F12';
  }

  function toggleHighlight() {
    ensureFocus();
    const selection = document.getSelection();
    if (!selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);

    if (range.collapsed) {
      toast.show('Sélectionnez du texte pour surligner');
      return;
    }

    if (selectionHasHighlight()) {
      for (const node of highlightedNodes()) {
        if (!range.intersectsNode(node)) continue;
        node.style.backgroundColor = '';
        if (!node.getAttribute('style')) {
          const parent = node.parentNode;
          while (node.firstChild) parent?.insertBefore(node.firstChild, node);
          node.remove();
        }
      }
      onBodyInput();
    } else {
      exec('hiliteColor', highlightColor());
    }
    refreshFormat();
  }

  function clearFormat() {
    exec('removeFormat');
    const block = blockElement();
    if (block && /^H[1-3]$/.test(block.tagName)) exec('formatBlock', 'DIV');
    refreshFormat();
  }

  function toggleTaskLine() {
    ensureFocus();
    const block = blockElement();
    if (!block) {
      document.execCommand(
        'insertHTML',
        false,
        '<div class="task-line" data-checked="false"><br></div>'
      );
      onBodyInput();
      return;
    }
    if (block.classList.contains('task-line')) {
      block.classList.remove('task-line');
      block.removeAttribute('data-checked');
    } else {
      block.classList.add('task-line');
      block.setAttribute('data-checked', 'false');
    }
    onBodyInput();
  }

  function placeCaretAtStart(el: HTMLElement) {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(true);
    const selection = document.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
      savedRange = range.cloneRange();
    }
  }

  function onBodyKeydown(event: KeyboardEvent) {
    if (event.key !== 'Enter' || event.shiftKey) return;
    const block = blockElement();
    if (!block || !block.classList.contains('task-line')) return;
    event.preventDefault();
    const next = document.createElement('div');
    next.className = 'task-line';
    next.setAttribute('data-checked', 'false');
    next.innerHTML = '<br>';
    block.after(next);
    placeCaretAtStart(next);
    onBodyInput();
  }

  function onBodyClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const line = target.closest('.task-line') as HTMLElement | null;
    if (!line) {
      if (formatOpen) formatOpen = false;
      return;
    }
    const rect = line.getBoundingClientRect();
    if (event.clientX - rect.left <= 32) {
      event.preventDefault();
      line.setAttribute(
        'data-checked',
        line.getAttribute('data-checked') === 'true' ? 'false' : 'true'
      );
      onBodyInput();
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
        ensureFocus();
        document.execCommand('insertHTML', false, `<img src="${reader.result}" alt="" />`);
        onBodyInput();
      }
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  function undo() {
    bodyEl?.focus();
    document.execCommand('undo');
    onBodyInput();
  }

  function redo() {
    bodyEl?.focus();
    document.execCommand('redo');
    onBodyInput();
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
    const text = `${title}\n\n${htmlToText(html)}`.trim();
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
    document.addEventListener('selectionchange', trackSelection);
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('beforeunload', flush);

    const fresh = !note.title && !htmlToText(note.html);
    if (fresh) {
      editing = true;
      titleEl?.focus();
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
      <Icon name="back" size={22} />
    </button>

    {#if editing}
      <div class="bar-right">
        <button class="icon-btn" onclick={undo} aria-label="Annuler">
          <Icon name="undo" size={21} />
        </button>
        <button class="icon-btn" onclick={redo} aria-label="Rétablir">
          <Icon name="redo" size={21} />
        </button>
        <button class="icon-btn" onclick={stopEditing} aria-label="Terminer l'édition">
          <Icon name="check" size={22} stroke={2.1} />
        </button>
      </div>
    {:else}
      <div class="bar-right">
        <button class="icon-btn" onclick={share} aria-label="Partager">
          <Icon name="share" size={22} />
        </button>
        <button class="icon-btn" onclick={() => (sheet = 'color')} aria-label="Style de la note">
          <Icon name="tshirt" size={22} />
        </button>
        <button class="icon-btn" onclick={() => (sheet = 'more')} aria-label="Plus d'options">
          <Icon name="more" size={22} />
        </button>
      </div>
    {/if}
  </header>

  <div class="doc">
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

    <div
      class="note-body"
      contenteditable="true"
      role="textbox"
      aria-multiline="true"
      aria-label="Contenu de la note"
      tabindex="0"
      spellcheck="false"
      data-placeholder="Écrivez quelque chose…"
      bind:this={bodyEl}
      use:initBody
      oninput={onBodyInput}
      onfocus={startEditing}
      onkeydown={onBodyKeydown}
      onclick={onBodyClick}
    ></div>
  </div>

  {#if editing}
    <div class="edit-tools">
      {#if formatOpen}
        <div class="format-bar">
          <button
            class="fmt-tool"
            class:active={format.highlight}
            onpointerdown={(event) => event.preventDefault()}
            onclick={toggleHighlight}
            aria-label="Surligner"
          >
            <Icon name="highlighter" size={22} />
          </button>
          <button
            class="fmt-tool"
            class:active={format.h1}
            onpointerdown={(event) => event.preventDefault()}
            onclick={() => toggleHeading(1)}
            aria-label="Titre 1"
          >
            <span class="hglyph">H1</span>
          </button>
          <button
            class="fmt-tool"
            class:active={format.h2}
            onpointerdown={(event) => event.preventDefault()}
            onclick={() => toggleHeading(2)}
            aria-label="Titre 2"
          >
            <span class="hglyph">H2</span>
          </button>
          <button
            class="fmt-tool"
            class:active={format.h3}
            onpointerdown={(event) => event.preventDefault()}
            onclick={() => toggleHeading(3)}
            aria-label="Titre 3"
          >
            <span class="hglyph">H3</span>
          </button>
          <button
            class="fmt-tool"
            class:active={format.bold}
            onpointerdown={(event) => event.preventDefault()}
            onclick={toggleBold}
            aria-label="Gras"
          >
            <span class="glyph bold">B</span>
          </button>
          <button
            class="fmt-tool"
            class:active={format.italic}
            onpointerdown={(event) => event.preventDefault()}
            onclick={toggleItalic}
            aria-label="Italique"
          >
            <span class="glyph italic">I</span>
          </button>
          <button
            class="fmt-tool"
            onpointerdown={(event) => event.preventDefault()}
            onclick={clearFormat}
            aria-label="Effacer la mise en forme"
          >
            <Icon name="close" size={20} />
          </button>
        </div>
      {:else}
        <button
          class="tool-btn"
          onclick={() => toast.show('Notes vocales bientôt disponibles')}
          aria-label="Note vocale"
        >
          <Icon name="waveform" size={25} />
        </button>
        <button class="tool-btn" onclick={pickImage} aria-label="Insérer une image">
          <Icon name="image" size={25} />
        </button>
        <button
          class="tool-btn"
          onclick={() => toast.show('Dessin bientôt disponible')}
          aria-label="Dessiner"
        >
          <Icon name="draw" size={25} />
        </button>
        <button
          class="tool-btn"
          onpointerdown={(event) => event.preventDefault()}
          onclick={toggleTaskLine}
          aria-label="Liste de contrôle"
        >
          <Icon name="check-square" size={25} />
        </button>
        <button
          class="tool-btn"
          class:active={formatOpen}
          onpointerdown={(event) => event.preventDefault()}
          onclick={() => {
            ensureFocus();
            formatOpen = true;
            refreshFormat();
          }}
          aria-label="Mise en forme"
        >
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
    title={sheet === 'color' ? 'Couleur de la note' : sheet === 'folder' ? 'Dossier' : ''}
  >
    {#if sheet === 'more'}
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
    padding: calc(var(--safe-top) + 4px) 8px 0 14px;
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
    padding: 0 24px 40px;
  }

  .note-title {
    display: block;
    width: 100%;
    margin: 28px 0 0;
    padding: 0;
    border: 0;
    background: transparent;
    outline: none;
    font-size: var(--note-title);
    font-weight: 700;
    letter-spacing: -0.5px;
    line-height: 1.2;
    color: var(--text);
  }

  .note-title::placeholder {
    color: var(--text-3);
  }

  .note-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 7px;
    font-size: 14px;
    color: var(--text-3);
  }

  .separator {
    opacity: 0.6;
  }

  .note-body {
    margin-top: 28px;
    min-height: 40vh;
    outline: none;
    font-size: var(--note-text);
    line-height: 1.58;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }

  .note-body:empty::before {
    content: attr(data-placeholder);
    color: var(--text-3);
    pointer-events: none;
  }

  .note-body :global(div + div) {
    margin-top: 10px;
  }

  .note-body :global(img) {
    display: block;
    max-width: 100%;
    height: auto;
    margin: 14px 0;
    border-radius: 14px;
  }

  .note-body :global(h1) {
    font-size: calc(var(--note-text) + 8px);
    line-height: 1.35;
    margin: 16px 0 4px;
    font-weight: 700;
  }

  .note-body :global(h2) {
    font-size: calc(var(--note-text) + 5px);
    line-height: 1.35;
    margin: 14px 0 4px;
    font-weight: 700;
  }

  .note-body :global(h3) {
    font-size: calc(var(--note-text) + 2px);
    line-height: 1.35;
    margin: 12px 0 4px;
    font-weight: 700;
  }

  .note-body :global(.task-line) {
    position: relative;
    padding-left: 30px;
    min-height: 1.55em;
  }

  .note-body :global(.task-line::before) {
    content: '';
    position: absolute;
    left: 0;
    top: 0.42em;
    width: 18px;
    height: 18px;
    border-radius: 5px;
    border: 2px solid var(--text-3);
    box-sizing: border-box;
  }

  .note-body :global(.task-line[data-checked='true']::before) {
    background: var(--text);
    border-color: var(--text);
  }

  .note-body :global(.task-line[data-checked='true']::after) {
    content: '';
    position: absolute;
    left: 5px;
    top: 0.72em;
    width: 8px;
    height: 4px;
    border-left: 2.2px solid var(--bg);
    border-bottom: 2.2px solid var(--bg);
    transform: rotate(-45deg);
  }

  .edit-tools {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-around;
    gap: 4px;
    padding: 6px 8px calc(8px + var(--safe-bottom));
    background: var(--surface-2);
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

  .format-bar {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2px;
  }

  .fmt-tool {
    flex: 1;
    height: 48px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    color: var(--text);
  }

  .fmt-tool:active {
    background: var(--surface-3);
  }

  .fmt-tool.active {
    color: var(--accent);
  }

  .hglyph {
    font-size: 15px;
    font-weight: 700;
    letter-spacing: -0.3px;
  }

  .glyph {
    font-size: 19px;
    font-weight: 700;
    line-height: 1;
  }

  .glyph.bold {
    font-weight: 800;
  }

  .glyph.italic {
    font-family: Georgia, 'Times New Roman', serif;
    font-style: italic;
    font-weight: 600;
  }

  .file-input {
    display: none;
  }

  :global(.check) {
    color: var(--accent);
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
