import type { Note } from './types';

const dayMonth = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const fullDate = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric'
});
const numeric = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric'
});

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

/** Date courte affichée sous une carte de note. */
export function formatCardDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  if (isSameDay(d, now)) {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(d, yesterday)) return 'Hier';
  if (d.getFullYear() === now.getFullYear()) return dayMonth.format(d);
  return numeric.format(d);
}

/** « 9 nov. 2026 · 14:03 » */
export function formatMeta(ts: number): string {
  const d = new Date(ts);
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${fullDate.format(d)} · ${time}`;
}

/** « 9 nov. 2026 » */
export function formatDay(ts: number): string {
  return fullDate.format(new Date(ts));
}

/** Texte brut d'une note (pour l'aperçu et la recherche). */
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
