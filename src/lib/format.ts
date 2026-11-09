import type { Note } from './types';

const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre'
];

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function time(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** « 6 Novembre » (ou « 6 Novembre 2024 » si autre année). */
export function formatCardDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const month = capitalize(MONTHS[d.getMonth()]);
  if (d.getFullYear() !== now.getFullYear()) {
    return `${d.getDate()} ${month} ${d.getFullYear()}`;
  }
  return `${d.getDate()} ${month}`;
}

/** « 13 octobre 19:18 » */
export function formatNoteDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${time(ts)}`;
}

/** « 9 novembre 2026 · 17:58 » */
export function formatFullDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} · ${time(ts)}`;
}

/** « 9 novembre 2026 » */
export function formatDay(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Texte brut d'une note (aperçu, recherche, partage). */
export function plainText(note: Note): string {
  if (note.kind === 'checklist') {
    return note.items
      .map((i) => i.text)
      .filter(Boolean)
      .join('\n');
  }
  return htmlToText(note.html);
}

export function htmlToText(html: string): string {
  if (!html) return '';
  if (typeof document === 'undefined') return html.replace(/<[^>]*>/g, ' ');
  const el = document.createElement('div');
  el.innerHTML = html
    .replace(/<\/(div|p|li|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n');
  return (el.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}
