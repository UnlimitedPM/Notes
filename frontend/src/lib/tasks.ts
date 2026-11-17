import { escapeHtml } from './format';

export interface ParsedTask {
  index: number;
  text: string;
  done: boolean;
}

function parse(html: string): Document {
  return new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
}

/** Toutes les lignes « case à cocher » d'une note, dans l'ordre du texte. */
export function parseTasks(html: string): ParsedTask[] {
  const doc = parse(html);
  return Array.from(doc.querySelectorAll<HTMLElement>('.task-line')).map((el, index) => ({
    index,
    text: (el.textContent ?? '').replace(/\u00a0/g, ' ').trim(),
    done: el.getAttribute('data-checked') === 'true'
  }));
}

export function toggleTaskAt(html: string, index: number): string {
  const doc = parse(html);
  const el = doc.querySelectorAll<HTMLElement>('.task-line')[index];
  if (!el) return html;
  el.setAttribute('data-checked', el.getAttribute('data-checked') === 'true' ? 'false' : 'true');
  return doc.body.innerHTML;
}

export function setTaskTextAt(html: string, index: number, text: string): string {
  const doc = parse(html);
  const el = doc.querySelectorAll<HTMLElement>('.task-line')[index];
  if (!el) return html;
  el.textContent = text;
  return doc.body.innerHTML;
}

export function taskLineHtml(text = '', checked = false): string {
  return `<div class="task-line" data-checked="${checked}">${
    text ? escapeHtml(text) : '<br>'
  }</div>`;
}

/** La ligne contient-elle déjà une case à cocher ? */
export function isTaskLine(el: Element | null): el is HTMLElement {
  return !!el && el.classList.contains('task-line');
}
