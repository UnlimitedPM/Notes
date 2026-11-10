<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from './Icon.svelte';
  import Sheet from './Sheet.svelte';
  import DrawingPad from './DrawingPad.svelte';
  import VoiceRecorder from './VoiceRecorder.svelte';
  import { notesStore } from '../notes.svelte';
  import { NOTE_COLORS } from '../colors';
  import { formatNoteDate, htmlToText } from '../format';
  import { noteToMarkdown } from '../markdown';
  import { removeMediaAt as removeMediaElementAt } from '../media';
  import {
    imageFilename,
    markdownFilename,
    renderNoteImage,
    shareOrDownload
  } from '../noteImage';
  import { toast } from '../toast.svelte';
  import { ensureNotificationPermission } from '../reminders';
  import type { Note, NoteColorKey } from '../types';

  type SheetName = 'more' | 'color' | 'folder' | 'share' | 'remind' | 'imgdesc' | null;

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
  let highlightPending = $state(false);
  let formatScrollEl = $state<HTMLDivElement | null>(null);
  let formatAtEnd = $state(false);
  let drawingOpen = $state(false);
  let voiceOpen = $state(false);

  let pending: Partial<Note> = {};
  let timer: ReturnType<typeof setTimeout> | undefined;

  const chars = $derived(htmlToText(html).length);
  const charLabel = $derived(`${chars} caractère${chars > 1 ? 's' : ''}`);
  const meta = $derived(formatNoteDate(note.updatedAt));

  let format = $state({
    bold: false,
    italic: false,
    strike: false,
    h1: false,
    h2: false,
    h3: false,
    ul: false,
    ol: false,
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
    node.innerHTML = normalizeHighlight(html);
  }

  /** Les surlignages enregistrés avec l'ancienne couleur sombre prennent la couleur actuelle. */
  function normalizeHighlight(source: string): string {
    const target = highlightColor();
    return source.split('rgb(77, 63, 18)').join(target).split('#4D3F12').join(target);
  }

  function onTitleInput() {
    queue({ title });
  }

  function onBodyInput() {
    html = (bodyEl?.innerHTML ?? '').replace(/\u200b/g, '');
    queue({ html });
    refreshFormat();
  }

  function startEditing() {
    if (!editing) editing = true;
  }

  function stopEditing() {
    formatOpen = false;
    highlightPending = false;
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
    const selection = document.getSelection();
    const liveCaret =
      !!selection &&
      selection.rangeCount > 0 &&
      !!selection.anchorNode &&
      bodyEl.contains(selection.anchorNode);
    if (liveCaret) {
      // Le curseur réel est déjà dans la note : surtout ne pas le remplacer par un
      // Range mémorisé (il peut être périmé, ce qui ferait sauter le curseur).
      if (document.activeElement !== bodyEl) bodyEl.focus({ preventScroll: true });
      return;
    }
    bodyEl.focus({ preventScroll: true });
    if (savedRange) {
      if (selection && bodyEl.contains(savedRange.startContainer)) {
        selection.removeAllRanges();
        selection.addRange(savedRange);
      }
    }
  }

  /** La barre de mise en forme défile : on masque l'indice de défilement en fin de course. */
  function syncFormatScroll() {
    const el = formatScrollEl;
    if (!el) return;
    formatAtEnd = el.scrollWidth - (el.scrollLeft + el.clientWidth) < 8;
  }

  /** Molette de la souris -> défilement horizontal de la barre (desktop). */
  function onFormatWheel(event: WheelEvent) {
    const el = formatScrollEl;
    if (!el || el.scrollWidth <= el.clientWidth + 1) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    el.scrollLeft += event.deltaY;
    event.preventDefault();
    syncFormatScroll();
  }

  function blockElement(): HTMLElement | null {
    if (!bodyEl) return null;
    const selection = document.getSelection();
    if (!selection || !selection.rangeCount) return null;
    let node: Node | null = selection.anchorNode;
    if (!node || !bodyEl.contains(node)) return null;
    let el: HTMLElement | null =
      node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
    // La ligne la plus proche (div, li, titre…), pas seulement l'enfant direct du corps.
    while (el && el !== bodyEl) {
      if (/^(DIV|P|LI|H1|H2|H3|BLOCKQUOTE|PRE)$/.test(el.tagName)) return el;
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
    if (!range.collapsed) {
      for (const node of highlightedNodes()) {
        if (range.intersectsNode(node)) return true;
      }
    }

    let node: Node | null = selection.anchorNode;
    let el: HTMLElement | null =
      node?.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : (node?.parentElement ?? null);
    // Le style le plus proche décide : un span « transparent » coupe le surlignage.
    while (el && el !== bodyEl) {
      const bg = el.style?.backgroundColor;
      if (bg) return bg !== 'transparent';
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
      strike: document.queryCommandState('strikeThrough'),
      h1: tag === 'H1',
      h2: tag === 'H2',
      h3: tag === 'H3',
      ul: document.queryCommandState('insertUnorderedList') || listAncestor(block)?.tagName === 'UL',
      ol: document.queryCommandState('insertOrderedList') || listAncestor(block)?.tagName === 'OL',
      highlight: highlightPending || selectionHasHighlight()
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

  function toggleStrike() {
    ensureFocus();
    const selection = document.getSelection();
    if (!selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);

    if (range.collapsed) {
      if (nearestDecoration() === 'line-through') {
        if (!splitStrikeAtCaret()) exec('strikeThrough');
      } else {
        exec('strikeThrough');
      }
      refreshFormat();
      return;
    }
    exec('strikeThrough');
    refreshFormat();
  }

  function nearestDecoration(): string | null {
    if (!bodyEl) return null;
    const selection = document.getSelection();
    let node: Node | null = selection?.anchorNode ?? null;
    if (!node || !bodyEl.contains(node)) return null;
    let el: HTMLElement | null =
      node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
    while (el && el !== bodyEl) {
      const deco = el.style?.textDecorationLine || el.style?.textDecoration || '';
      if (deco.includes('line-through')) return 'line-through';
      el = el.parentElement;
    }
    return null;
  }

  function toggleList(kind: 'ul' | 'ol') {
    ensureFocus();
    const current = listAncestor(caretItem() ?? blockElement());
    if (!current) {
      // Chrome recrée les nœuds en fabriquant la liste et replace le curseur au début
      // de la ligne : on retient l'index du curseur dans la ligne puis on le replace.
      const block = blockElement();
      const index = block ? caretIndexIn(block) : null;
      exec(kind === 'ul' ? 'insertUnorderedList' : 'insertOrderedList');
      const item = caretItem();
      if (item) placeCaretAtTextIndex(item, index ?? (item.textContent?.length ?? 0));
      refreshFormat();
      return;
    }
    if (current.tagName === kind.toUpperCase()) {
      unwrapCaretItem(current);
    } else {
      convertList(current, kind);
    }
    onBodyInput();
    refreshFormat();
  }

  /** Nombre de caractères entre le début du bloc et le curseur. */
  function caretIndexIn(block: HTMLElement): number | null {
    const selection = document.getSelection();
    if (!selection || !selection.anchorNode || !block.contains(selection.anchorNode)) return null;
    const range = document.createRange();
    range.selectNodeContents(block);
    range.setEnd(selection.anchorNode, selection.anchorOffset);
    return range.toString().length;
  }

  function placeCaretAtTextIndex(root: HTMLElement, index: number): void {
    const selection = document.getSelection();
    if (!selection) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let remaining = index;
    let node: Node | null = null;
    while (walker.nextNode()) {
      const len = walker.currentNode.textContent?.length ?? 0;
      if (remaining <= len) {
        node = walker.currentNode;
        break;
      }
      remaining -= len;
    }
    const range = document.createRange();
    if (node) {
      range.setStart(node, Math.min(remaining, node.textContent?.length ?? 0));
      range.collapse(true);
    } else {
      range.selectNodeContents(root);
      range.collapse(false);
    }
    selection.removeAllRanges();
    selection.addRange(range);
    savedRange = range.cloneRange();
  }

  /** Le <li> sous le curseur (blockElement() renvoie la liste entière, pas la ligne). */
  function caretItem(): HTMLElement | null {
    if (!bodyEl) return null;
    const selection = document.getSelection();
    let node: Node | null = selection?.anchorNode ?? null;
    if (!node || !bodyEl.contains(node)) return null;
    let el: HTMLElement | null =
      node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
    while (el && el !== bodyEl) {
      if (el.tagName === 'LI') return el;
      el = el.parentElement;
    }
    return null;
  }

  /**
   * Change le type de toute la liste (puces <-> numéros). Le navigateur, lui, coupe la
   * liste en deux au niveau du curseur quand on change de type.
   * Le curseur est mémorisé sous forme (nœud, décalage) : un Range serait déplacé par
   * le navigateur au moment où l'ancienne liste quitte le DOM.
   */
  function convertList(list: HTMLElement, kind: 'ul' | 'ol') {
    const selection = document.getSelection();
    const anchorNode = selection?.anchorNode ?? null;
    const anchorOffset = selection?.anchorOffset ?? 0;
    const focusNode = selection?.focusNode ?? null;
    const focusOffset = selection?.focusOffset ?? 0;
    const wasCollapsed = selection?.isCollapsed ?? true;

    const target = document.createElement(kind);
    while (list.firstChild) target.appendChild(list.firstChild);
    list.replaceWith(target);

    if (selection && anchorNode && target.contains(anchorNode)) {
      const restored = document.createRange();
      restored.setStart(anchorNode, Math.min(anchorOffset, anchorNode.textContent?.length ?? 0));
      if (wasCollapsed || !focusNode || !target.contains(focusNode)) {
        restored.collapse(true);
      } else {
        restored.setEnd(focusNode, Math.min(focusOffset, focusNode.textContent?.length ?? 0));
      }
      selection.removeAllRanges();
      selection.addRange(restored);
      savedRange = restored.cloneRange();
    }
  }

  /** Retire la puce / le numéro de la ligne courante (les autres lignes restent listées). */
  function unwrapCaretItem(list: HTMLElement) {
    const li = caretItem();
    if (!li || li.parentElement !== list) return;

    const following: Node[] = [];
    let passed = false;
    for (const child of Array.from(list.childNodes)) {
      if (child === li) {
        passed = true;
        continue;
      }
      if (passed) following.push(child);
    }

    const selection = document.getSelection();
    const anchorNode = selection?.anchorNode ?? null;
    const anchorOffset = selection?.anchorOffset ?? 0;

    const line = document.createElement('div');
    while (li.firstChild) line.appendChild(li.firstChild);
    if (!line.firstChild) line.appendChild(document.createElement('br'));
    li.remove();
    list.after(line);

    if (following.length) {
      const tail = list.cloneNode(false) as HTMLElement;
      for (const node of following) tail.appendChild(node);
      line.after(tail);
    }
    if (!list.childNodes.length) list.remove();

    if (selection) {
      const restored = document.createRange();
      if (anchorNode && line.contains(anchorNode)) {
        restored.setStart(anchorNode, Math.min(anchorOffset, anchorNode.textContent?.length ?? 0));
        restored.collapse(true);
      } else {
        restored.selectNodeContents(line);
        restored.collapse(false);
      }
      selection.removeAllRanges();
      selection.addRange(restored);
      savedRange = restored.cloneRange();
    }
  }

  function listAncestor(from: HTMLElement | null): HTMLElement | null {
    let el: HTMLElement | null = from;
    while (el && el !== bodyEl) {
      if (el.tagName === 'UL' || el.tagName === 'OL') return el;
      el = el.parentElement;
    }
    return null;
  }

  function toggleHeading(level: 1 | 2 | 3) {
    ensureFocus();
    // Un titre ne peut pas vivre dans une liste : on sort d'abord la ligne de la liste.
    const list = listAncestor(caretItem());
    if (list) {
      unwrapCaretItem(list);
      onBodyInput();
    }
    const block = blockElement();
    if (block && block.tagName === `H${level}`) {
      exec('formatBlock', 'DIV');
    } else {
      exec('formatBlock', `H${level}`);
    }
    refreshFormat();
  }

  function highlightColor(): string {
    // Sur une note colorée (fond clair), on utilise la teinte claire comme en thème clair.
    const lightNote = note.color !== 'default';
    return lightNote || document.documentElement.dataset.theme === 'light' ? '#FFE58A' : '#817962';
  }

  type FormatTool = {
    label: string;
    icon?: string;
    text?: string;
    glyphClass?: string;
    active?: () => boolean;
    run: () => void;
  };

  // Même ordre que la barre du téléphone (surligneur, H1-H3, gras, italique) puis les ajouts.
  const formatTools = $derived<FormatTool[]>([
    {
      label: 'Surligner',
      icon: 'highlighter',
      active: () => format.highlight,
      run: toggleHighlight
    },
    {
      label: 'Titre 1',
      text: 'H1',
      glyphClass: 'hglyph',
      active: () => format.h1,
      run: () => toggleHeading(1)
    },
    {
      label: 'Titre 2',
      text: 'H2',
      glyphClass: 'hglyph',
      active: () => format.h2,
      run: () => toggleHeading(2)
    },
    {
      label: 'Titre 3',
      text: 'H3',
      glyphClass: 'hglyph',
      active: () => format.h3,
      run: () => toggleHeading(3)
    },
    {
      label: 'Gras',
      text: 'B',
      glyphClass: 'glyph bold',
      active: () => format.bold,
      run: toggleBold
    },
    {
      label: 'Italique',
      text: 'I',
      glyphClass: 'glyph italic',
      active: () => format.italic,
      run: toggleItalic
    },
    {
      label: 'Barré',
      text: 'S',
      glyphClass: 'glyph strike',
      active: () => format.strike,
      run: toggleStrike
    },
    {
      label: 'Liste à puces',
      icon: 'list-bullet',
      active: () => format.ul,
      run: () => toggleList('ul')
    },
    {
      label: 'Liste numérotée',
      icon: 'list-number',
      active: () => format.ol,
      run: () => toggleList('ol')
    },
    {
      label: 'Effacer la mise en forme',
      icon: 'clear-format',
      run: clearFormat
    }
  ]);

  function toggleHighlight() {
    ensureFocus();
    const selection = document.getSelection();
    if (!selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);

    if (range.collapsed) {
      const isOn = highlightPending || selectionHasHighlight();
      document.execCommand('styleWithCSS', false, 'true');
      if (isOn) {
        splitHighlightAtCaret();
        document.execCommand('hiliteColor', false, 'transparent');
        highlightPending = false;
      } else {
        document.execCommand('hiliteColor', false, highlightColor());
        highlightPending = true;
      }
      refreshFormat();
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
    highlightPending = false;
    refreshFormat();
  }

  /**
   * Coupe le span surligné au curseur et place le curseur dans un nœud de texte neutre
   * entre les deux morceaux : le texte tapé ensuite n'hérite plus du fond coloré.
   */
  function splitHighlightAtCaret(): void {
    const selection = document.getSelection();
    if (!selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (!range.collapsed) return;

    let node: Node | null = range.startContainer;
    let el: HTMLElement | null =
      node?.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : (node?.parentElement ?? null);
    let span: HTMLElement | null = null;
    while (el && el !== bodyEl) {
      const bg = el.style?.backgroundColor;
      if (bg) {
        if (bg !== 'transparent') span = el;
        break;
      }
      el = el.parentElement;
    }
    if (!span) return;
    splitSpanAtCaret(span, range);
  }

  /** Idem pour le texte barré : le curseur sort du span barré. */
  function splitStrikeAtCaret(): boolean {
    const selection = document.getSelection();
    if (!selection || !selection.rangeCount) return false;
    const range = selection.getRangeAt(0);
    if (!range.collapsed) return false;

    let node: Node | null = range.startContainer;
    let el: HTMLElement | null =
      node?.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : (node?.parentElement ?? null);
    let span: HTMLElement | null = null;
    while (el && el !== bodyEl) {
      if (/line-through/.test(el.style?.textDecorationLine || el.style?.textDecoration || '')) {
        span = el;
        break;
      }
      el = el.parentElement;
    }
    if (!span) return false;
    return splitSpanAtCaret(span, range);
  }

  function splitSpanAtCaret(span: HTMLElement, range: Range): boolean {
    if (!span.parentNode || !range.collapsed) return false;
    const selection = document.getSelection();
    if (!selection) return false;

    const leftRange = range.cloneRange();
    leftRange.selectNodeContents(span);
    leftRange.setEnd(range.startContainer, range.startOffset);
    const rightRange = range.cloneRange();
    rightRange.selectNodeContents(span);
    rightRange.setStart(range.startContainer, range.startOffset);

    const left = span.cloneNode(false) as HTMLElement;
    left.appendChild(leftRange.cloneContents());
    const right = span.cloneNode(false) as HTMLElement;
    right.appendChild(rightRange.extractContents());

    const parent = span.parentNode;
    if (left.textContent || left.firstElementChild) parent.insertBefore(left, span);
    const marker = document.createTextNode('\u200b');
    parent.insertBefore(marker, span);
    if (right.textContent || right.firstElementChild) parent.insertBefore(right, span);
    parent.removeChild(span);

    const caret = document.createRange();
    caret.setStart(marker, 1);
    caret.collapse(true);
    selection.removeAllRanges();
    selection.addRange(caret);
    savedRange = caret.cloneRange();
    return true;
  }

  function clearFormat() {
    highlightPending = false;
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

    // Entrée sur une puce vide : on sort de la liste (ligne normale).
    const item = caretItem();
    if (item && !item.textContent?.trim() && !item.querySelector('img')) {
      const list = listAncestor(item);
      if (list) {
        event.preventDefault();
        highlightPending = false;
        unwrapCaretItem(list);
        onBodyInput();
        refreshFormat();
        return;
      }
    }

    const block = blockElement();

    if (block && block.classList.contains('task-line')) {
      event.preventDefault();
      highlightPending = false;
      document.execCommand('styleWithCSS', false, 'true');
      document.execCommand('hiliteColor', false, 'transparent');
      const next = document.createElement('div');
      next.className = 'task-line';
      next.setAttribute('data-checked', 'false');
      next.innerHTML = '<br>';
      block.after(next);
      placeCaretAtStart(next);
      onBodyInput();
      return;
    }

    // Entrée désactive le surlignage en cours et repart sur une ligne normale.
    if (highlightPending || selectionHasHighlight()) {
      event.preventDefault();
      const div = document.createElement('div');
      div.innerHTML = '<br>';
      block ? block.after(div) : bodyEl?.appendChild(div);
      placeCaretAtStart(div);
      highlightPending = false;
      document.execCommand('styleWithCSS', false, 'true');
      document.execCommand('hiliteColor', false, 'transparent');
      onBodyInput();
    }
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

  // ---- Média sélectionné : barre d'actions posée sur l'image / la note vocale --
  // Comme dans MIUI : un appui sur le média le sélectionne (liseré ambre) et fait
  // apparaître une barre d'actions (description, plein écran, enregistrer, supprimer).
  // L'appui est capté sur le document en phase de capture : c'est le seul moyen
  // d'attraper un appui sur les contrôles natifs d'un <audio>.
  let mediaMenu = $state<{ index: number; kind: 'img' | 'audio'; top: number; left: number } | null>(
    null
  );

  function mediaNodes(): HTMLElement[] {
    if (!bodyEl) return [];
    return Array.from(bodyEl.querySelectorAll('img, audio')) as HTMLElement[];
  }

  function audioNodes(): HTMLAudioElement[] {
    if (!bodyEl) return [];
    return Array.from(bodyEl.querySelectorAll('audio')) as HTMLAudioElement[];
  }

  // Le lecteur natif d'un <audio> avale tous les appuis (contrôles dans un shadow
  // DOM) : on masque donc le lecteur natif (il reste la source du son) et on pose
  // notre propre pastille, comme dans MIUI.
  const audioBound = new WeakSet<HTMLAudioElement>();
  let audioTick = $state(0);

  type PillState = {
    i: number;
    top: number;
    left: number;
    width: number;
    height: number;
    visible: boolean;
    playing: boolean;
    current: string;
    duration: string;
    ratio: number;
  };

  let pills = $state<PillState[]>([]);
  const WAVE = [7, 13, 19, 11, 22, 16, 9, 18, 24, 13, 8, 17, 21, 12, 19, 10, 15, 22, 9, 14];

  function clock(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function bindAudio(el: HTMLAudioElement) {
    if (audioBound.has(el)) return;
    audioBound.add(el);
    const bump = () => {
      audioTick += 1;
    };
    el.addEventListener('play', bump);
    el.addEventListener('pause', bump);
    el.addEventListener('ended', bump);
    el.addEventListener('timeupdate', bump);
    el.addEventListener('loadedmetadata', bump);
  }

  function playerHost(): HTMLElement | null {
    return (bodyEl?.offsetParent as HTMLElement | null) ?? bodyEl;
  }

  function refreshPills() {
    void audioTick;
    const audios = audioNodes();
    if (!audios.length || !bodyEl) {
      pills = [];
      return;
    }
    const host = playerHost();
    const view = host?.getBoundingClientRect() ?? null;
    pills = audios.map((el, i) => {
      bindAudio(el);
      const duration = Number.isFinite(el.duration) ? el.duration : 0;
      const current = Number.isFinite(el.currentTime) ? el.currentTime : 0;
      const rect = el.getBoundingClientRect();
      const visible =
        !!view && rect.bottom > view.top + 4 && rect.top < view.bottom - 4 && rect.height > 0;
      return {
        i,
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        width: Math.round(rect.width),
        height: Math.round(rect.height) || 42,
        visible,
        playing: !el.paused && !el.ended,
        current: clock(current),
        duration: clock(duration),
        ratio: duration > 0 ? Math.min(1, current / duration) : 0
      };
    });
  }

  function toggleAudio(index: number) {
    const el = audioNodes()[index];
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  }

  function selectAudio(index: number) {
    const el = audioNodes()[index];
    if (el) selectMedia(el);
  }

  function audioIsSelected(index: number): boolean {
    if (!mediaMenu || mediaMenu.kind !== 'audio') return false;
    const audio = audioNodes()[index];
    return !!audio && mediaNodes()[mediaMenu.index] === audio;
  }

  function placeMediaMenu(index: number) {
    const el = mediaNodes()[index];
    if (!el) {
      mediaMenu = null;
      return;
    }
    const rect = el.getBoundingClientRect();
    const count = el.tagName === 'AUDIO' ? 2 : 4;
    const width = count * 40 + 16;
    const maxLeft = Math.max(8, window.innerWidth - width - 8);
    const left = Math.min(Math.max(8, rect.left + rect.width / 2 - width / 2), maxLeft);
    // au milieu du média s'il est assez haut (comme MIUI sur une image), sinon dessous ;
    // et toujours dans la zone visible.
    const maxTop = Math.max(8, window.innerHeight - 68);
    let top = rect.height >= 120 ? rect.top + rect.height / 2 - 26 : rect.bottom + 10;
    if (top > maxTop) top = Math.max(8, rect.top - 62);
    top = Math.min(top, maxTop);
    mediaMenu = { index, kind: el.tagName === 'AUDIO' ? 'audio' : 'img', top, left };
  }

  function selectMedia(el: HTMLElement) {
    const nodes = mediaNodes();
    const index = nodes.indexOf(el);
    if (index < 0) return;
    nodes.forEach((node) => node.classList.remove('media-selected'));
    el.classList.add('media-selected');
    placeMediaMenu(index);
  }

  function clearMedia() {
    mediaNodes().forEach((node) => node.classList.remove('media-selected'));
    mediaMenu = null;
  }

  function selectedMediaElement(): HTMLElement | null {
    if (!mediaMenu) return null;
    return mediaNodes()[mediaMenu.index] ?? null;
  }

  $effect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || !bodyEl) return;
      if (target.closest('.media-menu')) return;
      const media = target.closest('img, audio');
      if (media && bodyEl.contains(media)) {
        // on ne laisse pas le texte prendre le focus : sinon la note passe en
        // édition et la barre d'actions disparaît aussitôt.
        if (!editing) event.preventDefault();
        selectMedia(media as HTMLElement);
        return;
      }
      if (mediaMenu) clearMedia();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  });

  $effect(() => {
    const current = mediaMenu;
    if (!current) return;
    const reposition = () => placeMediaMenu(current.index);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  });

  $effect(() => {
    // recalculé au changement de contenu, d'édition ou à chaque tick de lecture
    void editing;
    void html;
    void formatOpen;
    void audioTick;
    refreshPills();
  });

  $effect(() => {
    const host = playerHost();
    if (!host) return;
    const ro = new ResizeObserver(() => refreshPills());
    ro.observe(host);
    if (bodyEl) ro.observe(bodyEl);
    window.addEventListener('resize', refreshPills);
    window.addEventListener('scroll', refreshPills, true);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', refreshPills);
      window.removeEventListener('scroll', refreshPills, true);
    };
  });

  function removeSelectedMedia() {
    if (!mediaMenu) return;
    if (!removeMediaElementAt(bodyEl, mediaMenu.index)) return;
    clearMedia();
    onBodyInput();
    toast.show('Média supprimé');
  }

  function saveSelectedMedia() {
    const el = selectedMediaElement();
    const src = el?.getAttribute('src');
    if (!el || !src) return;
    const audio = el.tagName === 'AUDIO';
    const link = document.createElement('a');
    link.href = src;
    link.download = audio ? 'note-vocale' : 'image';
    link.click();
    toast.show(audio ? 'Note vocale enregistrée' : 'Image enregistrée');
  }

  async function shareSelectedMedia() {
    const el = selectedMediaElement();
    const src = el?.getAttribute('src');
    if (!src) return;
    try {
      const blob = await (await fetch(src)).blob();
      const ext = blob.type.includes('mpeg') ? 'mp3' : 'webm';
      const file = new File([blob], `note-vocale.${ext}`, { type: blob.type });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
    } catch {
      // partage indisponible ou refusé : on enregistre le fichier
    }
    saveSelectedMedia();
  }

  let fullscreenMedia = $state<string | null>(null);

  function openMediaFullscreen() {
    const src = selectedMediaElement()?.getAttribute('src');
    if (src) fullscreenMedia = src;
  }

  let imageAlt = $state('');

  function editImageDescription() {
    imageAlt = selectedMediaElement()?.getAttribute('alt') ?? '';
    sheet = 'imgdesc';
  }

  function applyImageDescription() {
    const el = selectedMediaElement();
    if (el) {
      if (imageAlt.trim()) el.setAttribute('alt', imageAlt.trim());
      else el.removeAttribute('alt');
      onBodyInput();
    }
    sheet = null;
  }

  function pickImage() {
    fileEl?.click();
  }

  function insertHtmlAtCaret(html: string) {
    ensureFocus();
    document.execCommand('insertHTML', false, html);
    onBodyInput();
    editing = true;
  }

  function onDrawDone(dataUrl: string) {
    drawingOpen = false;
    insertHtmlAtCaret(`<img src="${dataUrl}" alt="" />`);
  }

  function onVoiceDone(dataUrl: string, mime: string) {
    voiceOpen = false;
    const type = mime || 'audio/webm';
    insertHtmlAtCaret(
      `<audio controls src="${dataUrl}" data-mime="${type}"></audio><div><br></div>`
    );
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

  function plainNoteText(): string {
    return `${title}\n\n${htmlToText(html)}`.trim();
  }

  // ---- Rappel -------------------------------------------------------------
  let remindValue = $state('');

  function pad(value: number): string {
    return String(value).padStart(2, '0');
  }

  function toInputValue(timestamp: number): string {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}`;
  }

  function reminderLabel(timestamp: number): string {
    return formatNoteDate(timestamp);
  }

  async function openReminder() {
    remindValue = note.remindAt ? toInputValue(note.remindAt) : toInputValue(Date.now() + 60 * 60 * 1000);
    sheet = 'remind';
    void ensureNotificationPermission();
  }

  function setReminderIn(delta: number | null) {
    notesStore.setReminder(id, delta === null ? null : Date.now() + delta);
    sheet = null;
    toast.show(delta === null ? 'Rappel retiré' : 'Rappel programmé');
  }

  function setReminderAtEvening() {
    const date = new Date();
    date.setHours(20, 0, 0, 0);
    if (date.getTime() <= Date.now()) date.setDate(date.getDate() + 1);
    notesStore.setReminder(id, date.getTime());
    sheet = null;
    toast.show('Rappel programmé');
  }

  function setReminderTomorrow() {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    date.setHours(8, 0, 0, 0);
    notesStore.setReminder(id, date.getTime());
    sheet = null;
    toast.show('Rappel programmé');
  }

  function applyReminder() {
    const time = new Date(remindValue).getTime();
    if (Number.isNaN(time)) {
      toast.show('Date invalide');
      return;
    }
    notesStore.setReminder(id, time);
    sheet = null;
    toast.show('Rappel programmé');
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.show('Note copiée');
    } catch {
      toast.show('Copie impossible');
    }
  }

  /** « Partager une note comme texte » */
  async function shareAsText() {
    sheet = null;
    const text = plainNoteText();
    try {
      if (navigator.share) await navigator.share({ title: title || 'Note', text });
      else await copyText(text);
    } catch {
      /* partage annulé */
    }
  }

  /** « Partager une note en tant qu'image » */
  async function shareAsImage() {
    sheet = null;
    toast.show('Création de l’image…');
    try {
      const blob = await renderNoteImage({
        title,
        meta,
        html,
        dark: document.documentElement.dataset.theme !== 'light'
      });
      const result = await shareOrDownload(blob, imageFilename(title), title || 'Note');
      if (result === 'downloaded') toast.show('Image enregistrée');
    } catch {
      toast.show('Image impossible à créer');
    }
  }

  /** « Exporter comme Markdown » */
  async function exportMarkdown() {
    sheet = null;
    const markdown = noteToMarkdown(title, html);
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    try {
      const result = await shareOrDownload(blob, markdownFilename(title), title || 'Note');
      if (result === 'downloaded') toast.show('Markdown enregistré');
    } catch (error) {
      console.error('Export Markdown impossible', error);
      await copyText(markdown);
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
        <button class="icon-btn" onclick={() => (sheet = 'share')} aria-label="Partager">
          <Icon name="share" size={22} />
        </button>
        <button class="icon-btn" onclick={() => (sheet = 'color')} aria-label="Style de la note">
          <Icon name="tshirt" size={22} />
        </button>
        <button class="icon-btn" onclick={() => (sheet = 'more')} aria-label="Plus d'options">
          <Icon name="more" size={22} />
        </button>      </div>
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
          <div class="format-scroll-wrap" class:at-end={formatAtEnd}>
            <div
              class="format-scroll"
              bind:this={formatScrollEl}
              onscroll={syncFormatScroll}
              onwheel={onFormatWheel}
            >
              {#each formatTools as tool (tool.label)}
                <button
                  class="fmt-tool"
                  class:active={tool.active?.() ?? false}
                  onpointerdown={(event) => event.preventDefault()}
                  onclick={tool.run}
                  aria-label={tool.label}
                >
                  {#if tool.icon}
                    <Icon name={tool.icon} size={22} />
                  {:else}
                    <span class={tool.glyphClass}>{tool.text}</span>
                  {/if}
                </button>
              {/each}
            </div>
          </div>
          <button
            class="fmt-tool fmt-close"
            onpointerdown={(event) => event.preventDefault()}
            onclick={() => {
              formatOpen = false;
              highlightPending = false;
              refreshFormat();
            }}
            aria-label="Fermer la mise en forme"
          >
            <Icon name="close" size={20} />
          </button>
        </div>
      {:else}
        <button
          class="tool-btn"
          onclick={() => (voiceOpen = true)}
          aria-label="Note vocale"
        >
          <Icon name="waveform" size={25} />
        </button>
        <button class="tool-btn" onclick={pickImage} aria-label="Insérer une image">
          <Icon name="image" size={25} />
        </button>
        <button
          class="tool-btn"
          onclick={() => (drawingOpen = true)}
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
            setTimeout(syncFormatScroll, 0);
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
</div>

<!-- Feuilles et plein-écran : hors de `.note`, sinon ils héritent de la palette
     de la note (texte foncé sur une feuille sombre). -->
{#each pills as pill (pill.i)}
  {#if pill.visible}
    <div
      class="voice-pill"
      class:selected={audioIsSelected(pill.i)}
      style="top:{pill.top}px;left:{pill.left}px;width:{pill.width}px;height:{pill.height}px"
    >
      <button
        class="vp-play"
        onclick={() => toggleAudio(pill.i)}
        aria-label={pill.playing ? 'Mettre en pause' : 'Lire la note vocale'}
      >
        <Icon name={pill.playing ? 'pause' : 'play'} size={15} />
      </button>
      <button class="vp-body" onclick={() => selectAudio(pill.i)} aria-label="Note vocale">
        <span class="vp-wave">
          {#each WAVE as h, k}
            <i style="height:{h}px" class:on={k / WAVE.length <= pill.ratio}></i>
          {/each}
        </span>
        <span class="vp-time">{pill.playing || pill.ratio > 0 ? pill.current : pill.duration}</span>
      </button>
    </div>
  {/if}
{/each}

{#if mediaMenu}
  <div class="media-menu" style="top:{mediaMenu.top}px;left:{mediaMenu.left}px">
    {#if mediaMenu.kind === 'img'}
      <button class="mm-btn" onclick={editImageDescription} aria-label="Description de l'image">
        <Icon name="comment" size={21} />
      </button>
      <button class="mm-btn" onclick={openMediaFullscreen} aria-label="Afficher en plein écran">
        <Icon name="expand" size={21} />
      </button>
      <button class="mm-btn" onclick={saveSelectedMedia} aria-label="Enregistrer l'image">
        <Icon name="download" size={21} />
      </button>
    {:else}
      <button class="mm-btn" onclick={shareSelectedMedia} aria-label="Partager la note vocale">
        <Icon name="share" size={21} />
      </button>
      <button class="mm-btn" onclick={saveSelectedMedia} aria-label="Enregistrer la note vocale">
        <Icon name="download" size={21} />
      </button>
    {/if}
    <button class="mm-btn" onclick={removeSelectedMedia} aria-label="Supprimer le média">
      <Icon name="trash" size={21} />
    </button>
  </div>
{/if}

{#if fullscreenMedia}
  <div class="media-full" role="presentation" onclick={() => (fullscreenMedia = null)}>
    <img src={fullscreenMedia} alt="" />
  </div>
{/if}

<Sheet
    open={sheet !== null}
    onclose={() => (sheet = null)}
    title={sheet === 'color'
      ? 'Couleur de la note'
      : sheet === 'folder'
        ? 'Dossier'
        : sheet === 'share'
          ? 'Partager une note'
          : sheet === 'remind'
            ? 'Rappel'
            : sheet === 'imgdesc'
              ? "Description de l'image"
              : ''}
  >
    {#if sheet === 'share'}
      <button class="sheet-row" onclick={shareAsText}>
        <Icon name="text" size={22} />
        <span class="grow wrap">Partager une note comme texte</span>
      </button>
      <button class="sheet-row" onclick={shareAsImage}>
        <Icon name="image" size={22} />
        <span class="grow wrap">Partager une note en tant qu'image</span>
      </button>
      <button class="sheet-row" onclick={exportMarkdown}>
        <Icon name="note" size={22} />
        <span class="grow wrap">Exporter comme Markdown</span>
      </button>
      <button class="sheet-cancel" onclick={() => (sheet = null)}>Annuler</button>
    {:else if sheet === 'more'}
      <button class="sheet-row" onclick={openReminder}>
        <Icon name="bell" size={22} />
        <span class="grow">Rappel</span>
        {#if note.remindAt}
          <span class="sheet-extra">{reminderLabel(note.remindAt)}</span>
        {/if}
      </button>
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
    {:else if sheet === 'remind'}
      <button class="sheet-row" onclick={() => setReminderIn(60 * 60 * 1000)}>
        <Icon name="bell" size={22} />
        <span class="grow">Dans 1 heure</span>
      </button>
      <button class="sheet-row" onclick={() => setReminderAtEvening()}>Ce soir à 20:00</button>
      <button class="sheet-row" onclick={() => setReminderTomorrow()}>Demain à 8:00</button>
      <div class="remind-custom">
        <input type="datetime-local" bind:value={remindValue} aria-label="Date et heure du rappel" />
        <button class="remind-apply" onclick={applyReminder} disabled={!remindValue}>OK</button>
      </div>
      {#if note.remindAt}
        <button class="sheet-row danger" onclick={() => setReminderIn(null)}>
          <Icon name="trash" size={22} />
          <span class="grow">Retirer le rappel</span>
        </button>
      {/if}
      <p class="remind-note">Le rappel s'affiche tant que l'app est ouverte ; les rappels système viendront avec la synchronisation.</p>
      <button class="sheet-cancel" onclick={() => (sheet = null)}>Annuler</button>
    {:else if sheet === 'imgdesc'}
      <div class="alt-field">
        <input
          type="text"
          bind:value={imageAlt}
          placeholder="Description de l'image"
          aria-label="Description de l'image"
        />
      </div>
      <button class="sheet-row" onclick={applyImageDescription}>
        <Icon name="check" size={22} />
        <span class="grow">Enregistrer la description</span>
      </button>
      <button class="sheet-cancel" onclick={() => (sheet = null)}>Annuler</button>
    {/if}
  </Sheet>

  {#if drawingOpen}
    <DrawingPad onclose={() => (drawingOpen = false)} ondone={onDrawDone} />
  {/if}

  {#if voiceOpen}
    <VoiceRecorder onclose={() => (voiceOpen = false)} ondone={onVoiceDone} />
  {/if}

<style>
  .note {
    height: var(--app-height, 100dvh);
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
    position: relative;
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

  .note-body :global(audio) {
    display: block;
    width: 100%;
    margin: 12px 0;
    /* le lecteur natif reste la source du son mais n'est ni peint ni cliquable :
       ses contrôles internes avalent tous les appuis. La pastille ci-dessous le
       remplace visuellement. */
    visibility: hidden;
  }

  .voice-pill {
    position: fixed;
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 14px 0 10px;
    border-radius: 22px;
    background: var(--surface-3, #2a2a2d);
    box-sizing: border-box;
  }

  .voice-pill.selected {
    outline: 3px solid var(--accent);
    outline-offset: 3px;
  }

  .vp-play {
    flex: 0 0 auto;
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--accent);
    color: #1a1200;
  }

  .vp-body {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    height: 100%;
    min-width: 0;
  }

  .vp-wave {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 3px;
    height: 26px;
    overflow: hidden;
  }

  .vp-wave i {
    flex: 1 1 0;
    min-width: 2px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.28);
  }

  .vp-wave i.on {
    background: var(--accent);
  }

  .vp-time {
    flex: 0 0 auto;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    color: rgba(255, 255, 255, 0.75);
  }

  .note-body :global(img.media-selected),
  .note-body :global(audio.media-selected) {
    outline: 3px solid var(--accent);
    outline-offset: 3px;
    border-radius: 14px;
  }

  .media-menu {
    position: fixed;
    /* sous le voile et la feuille du bas (40/41) : la barre s'efface quand une
       feuille s'ouvre, mais la sélection reste pour agir dessus. */
    z-index: 35;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 5px 6px;
    border-radius: 24px;
    background: rgba(30, 30, 32, 0.97);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  }

  .mm-btn {
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    color: #f2f2f4;
  }

  .mm-btn:active {
    background: rgba(255, 255, 255, 0.12);
  }

  .media-full {
    position: fixed;
    inset: 0;
    z-index: 70;
    display: grid;
    place-items: center;
    padding: 16px;
    background: rgba(0, 0, 0, 0.94);
  }

  .media-full img {
    max-width: 100%;
    max-height: 100%;
    border-radius: 8px;
    object-fit: contain;
  }

  .alt-field {
    padding: 4px 16px 12px;
  }

  .alt-field input {
    width: 100%;
    padding: 13px 14px;
    border-radius: 12px;
    background: var(--surface-2);
    color: var(--text);
    font-size: 16px;
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

  .note-body :global(ul),
  .note-body :global(ol) {
    margin: 0.35em 0;
    padding-left: 1.55em;
  }

  .note-body :global(ul) {
    list-style: disc outside;
  }

  .note-body :global(ul ul) {
    list-style: circle outside;
  }

  .note-body :global(ol) {
    list-style: decimal outside;
  }

  .note-body :global(li) {
    display: list-item;
    margin: 0.12em 0;
  }

  .edit-tools {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-around;
    gap: 4px;
    padding: 6px 8px calc(8px + var(--safe-bottom));
    background: var(--bar-bg, var(--surface-2));
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
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .format-scroll {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 2px;
    overflow-x: auto;
    overflow-y: hidden;
    padding-bottom: 4px;
    scrollbar-width: thin;
    scrollbar-color: var(--text-3) transparent;
    overscroll-behavior-x: contain;
  }

  .format-scroll-wrap {
    position: relative;
    flex: 1;
    min-width: 0;
    display: flex;
  }

  .format-scroll-wrap::after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 20px;
    pointer-events: none;
    background: linear-gradient(to right, transparent, var(--bar-bg, var(--surface-2)) 75%);
    transition: opacity 0.15s ease;
  }

  .format-scroll-wrap.at-end::after {
    opacity: 0;
  }

  .format-scroll::-webkit-scrollbar {
    height: 5px;
  }

  .format-scroll::-webkit-scrollbar-track {
    background: transparent;
  }

  .format-scroll::-webkit-scrollbar-thumb {
    background: var(--text-3);
    border-radius: 3px;
  }

  .fmt-tool {
    flex: 0 0 auto;
    width: 36px;
    height: 46px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    color: var(--text);
  }

  .fmt-close {
    margin-left: 2px;
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

  .glyph.strike {
    text-decoration: line-through;
    text-decoration-thickness: 2px;
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

  .sheet-extra {
    margin-left: auto;
    font-size: 14.5px;
    color: var(--accent);
  }

  .remind-custom {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
  }

  .remind-custom input {
    flex: 1;
    min-width: 0;
    height: 46px;
    padding: 0 12px;
    border: 0;
    border-radius: 12px;
    background: var(--surface-2);
    color: var(--text);
    font-size: 16px;
    font-family: inherit;
    color-scheme: inherit;
  }

  .remind-apply {
    height: 46px;
    padding: 0 18px;
    border-radius: 12px;
    background: var(--accent);
    color: var(--on-accent);
    font-size: 16px;
    font-weight: 600;
  }

  .remind-apply:disabled {
    opacity: 0.4;
  }

  .remind-note {
    margin: 6px 16px 4px;
    font-size: 13px;
    line-height: 1.35;
    color: var(--text-3);
  }
</style>
