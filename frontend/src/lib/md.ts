/**
 * Markdown → HTML : le chemin inverse de `htmlToMarkdown`.
 *
 * C'est ce qui permet de stocker les notes en Markdown (base + serveur) tout en
 * gardant l'éditeur en HTML. Le dialecte est exactement celui que produit
 * `htmlToMarkdown` : titres H1-H3, `**gras**`, `*italique*`, `~~barré~~`,
 * `==surligné==`, `<u>souligné</u>`, listes, `- [ ]` / `- [x]`, images, audio, `---`.
 */

const HIGHLIGHT = '#FFE58A';

const MARK_U = '\u0001u\u0001';
const MARK_END_U = '\u0001/u\u0001';

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Convertit les marques inline d'une ligne Markdown en HTML de l'éditeur. */
export function inlineMdToHtml(text: string): string {
  let out = text.replace(/<u>/g, MARK_U).replace(/<\/u>/g, MARK_END_U);
  out = escapeHtml(out);

  out = out.replace(/\*\*([^*]+)\*\*/g, '<span style="font-weight: bold;">$1</span>');
  out = out.replace(/__([^_]+)__/g, '<span style="font-weight: bold;">$1</span>');
  out = out.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<span style="font-style: italic;">$2</span>');
  out = out.replace(/_([^_\s][^_]*)_/g, '<span style="font-style: italic;">$1</span>');
  out = out.replace(/~~([^~]+)~~/g, '<span style="text-decoration-line: line-through;">$1</span>');
  out = out.replace(
    /==([^=]+)==/g,
    `<span style="background-color: ${HIGHLIGHT};">$1</span>`
  );
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');

  out = out.replaceAll(MARK_U, '<u>').replaceAll(MARK_END_U, '</u>');
  return out;
}

const AUDIO_LINE = /^<audio(?:\s+controls)?\s+src="([^"]*)"\s*><\/audio>$/i;
const IMAGE_LINE = /^!\[([^\]]*)\]\(([^)]*)\)$/;

type ListKind = 'ul' | 'ol';

type ListState = { kind: ListKind; items: string[] };

function listItem(line: string): { marker: ListKind; indent: number; text: string } | null {
  const match = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line);
  if (!match) return null;
  const indent = Math.floor((match[1] ?? '').length / 2);
  const marker: ListKind = /\d/.test(match[2] ?? '') ? 'ol' : 'ul';
  return { marker, indent, text: match[3] ?? '' };
}

function taskItem(text: string): { checked: boolean; text: string } | null {
  const match = /^\[( |x|X)\]\s*(.*)$/.exec(text);
  if (!match) return null;
  return { checked: (match[1] ?? '').toLowerCase() === 'x', text: match[2] ?? '' };
}

/** Ajoute un élément de sous-liste au dernier `<li>` (un seul niveau, comme l'éditeur). */
function appendNested(html: string, kind: ListKind, inner: string): string {
  const close = `</${kind}>`;
  if (html.endsWith(close)) {
    return `${html.slice(0, -close.length)}<li>${inner}</li>${close}`;
  }
  return `${html}<${kind}><li>${inner}</li></${kind}>`;
}

/** Convertit un document Markdown complet en HTML compatible avec l'éditeur. */
export function mdToHtml(md: string): string {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const html: string[] = [];
  let list: ListState | null = null;

  const flushList = () => {
    if (!list) return;
    html.push(
      `<${list.kind}>${list.items.map((item) => `<li>${item}</li>`).join('')}</${list.kind}>`
    );
    list = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      flushList();
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flushList();
      const level = (heading[1] ?? '#').length;
      html.push(`<h${level}>${inlineMdToHtml(heading[2] ?? '')}</h${level}>`);
      continue;
    }

    if (/^(---|\*\*\*|___)$/.test(line.trim())) {
      flushList();
      html.push('<hr>');
      continue;
    }

    const audio = AUDIO_LINE.exec(line.trim());
    if (audio) {
      flushList();
      html.push(`<audio controls src="${escapeHtml(audio[1] ?? '')}"></audio>`);
      continue;
    }

    const image = IMAGE_LINE.exec(line.trim());
    if (image) {
      flushList();
      const alt = escapeHtml(image[1] ?? '');
      const src = escapeHtml(image[2] ?? '');
      html.push(`<div><img src="${src}" alt="${alt}" /></div>`);
      continue;
    }

    const item = listItem(line);
    if (item) {
      const task = taskItem(item.text);
      if (task) {
        flushList();
        html.push(
          `<div class="task-line" data-checked="${task.checked ? 'true' : 'false'}">${inlineMdToHtml(task.text)}</div>`
        );
        continue;
      }
      if (list && item.indent > 0 && list.items.length > 0) {
        const index = list.items.length - 1;
        list.items[index] = appendNested(
          list.items[index] ?? '',
          item.marker,
          inlineMdToHtml(item.text)
        );
        continue;
      }
      if (!list || list.kind !== item.marker) {
        flushList();
        list = { kind: item.marker, items: [] };
      }
      list.items.push(inlineMdToHtml(item.text));
      continue;
    }

    flushList();
    html.push(`<div>${inlineMdToHtml(line.trim())}</div>`);
  }

  flushList();
  return html.join('');
}
