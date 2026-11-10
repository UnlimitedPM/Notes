import { describe, expect, it } from 'vitest';
import { escapeHtml, formatCardDate, htmlToText, plainText } from '../src/lib/format';
import { findMedia, removeMedia } from '../src/lib/media';
import { NOTE_RICHE } from './fixtures';

describe('htmlToText', () => {
  it('supprime les balises et décode les entités', () => {
    expect(htmlToText('<div>a &amp; b</div>')).toBe('a & b');
  });

  it('met les titres et les listes sur des lignes séparées', () => {
    const text = htmlToText('<h1>Titre</h1><div>corps</div>');
    expect(text).toContain('Titre');
    expect(text).toContain('corps');
    expect(text.split('\n').length).toBeGreaterThan(1);
  });

  it('retire le marqueur interne du surlignage', () => {
    expect(htmlToText('<div>a\u200bb</div>')).toBe('ab');
  });

  it('donne le texte d’une note riche', () => {
    const text = htmlToText(NOTE_RICHE.html);
    expect(text).toContain('Un titre');
    expect(text).toContain('Puce une');
    expect(text).not.toContain('<');
  });
});

describe('plainText', () => {
  it('renvoie le texte du corps (le titre est affiché à part)', () => {
    const note = { ...NOTE_RICHE, title: 'Mon titre', html: '<div>corps</div>' };
    expect(plainText(note)).toBe('corps');
  });
});

describe('formatCardDate', () => {
  it('affiche une heure pour aujourd’hui', () => {
    const today = new Date();
    today.setHours(14, 32, 0, 0);
    expect(formatCardDate(today.getTime())).toBe('14:32');
  });

  it('affiche « Hier » pour la veille', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(9, 5, 0, 0);
    expect(formatCardDate(yesterday.getTime())).toBe('Hier 09:05');
  });

  it('affiche jour + mois pour une date ancienne', () => {
    const old = new Date(2026, 0, 6, 10, 0).getTime();
    expect(formatCardDate(old)).toMatch(/6 Janvier/);
  });
});

describe('escapeHtml', () => {
  it('échappe les caractères dangereux', () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  });
});

describe('findMedia / removeMedia (suppression des images et audios)', () => {
  function build(html: string): HTMLElement {
    const host = document.createElement('div');
    host.innerHTML = html;
    document.body.appendChild(host);
    return host;
  }

  it('reconnaît une image cliquée', () => {
    const host = build('<div><img src="data:image/png;base64,AA" /></div>');
    const img = host.querySelector('img')!;
    expect(findMedia(img)).toBe(img);
    host.remove();
  });

  it('reconnaît un audio cliqué', () => {
    const host = build('<div><audio controls src="data:audio/wav;base64,AA"></audio></div>');
    const audio = host.querySelector('audio')!;
    expect(findMedia(audio)).toBe(audio);
    host.remove();
  });

  it('ne reconnaît pas du texte', () => {
    const host = build('<div>du texte</div>');
    expect(findMedia(host.querySelector('div'))).toBeNull();
    host.remove();
  });

  it('supprime l’image et laisse le reste intact', () => {
    const host = build('<div>avant</div><div><img src="data:image/png;base64,AA" /></div><div>après</div>');
    const img = host.querySelector('img')!;
    removeMedia(img);
    expect(host.innerHTML).not.toContain('<img');
    expect(host.textContent).toContain('avant');
    expect(host.textContent).toContain('après');
    host.remove();
  });

  it('supprime l’audio', () => {
    const host = build('<div>avant</div><div><audio controls src="data:audio/wav;base64,AA"></audio></div>');
    const audio = host.querySelector('audio')!;
    removeMedia(audio);
    expect(host.innerHTML).not.toContain('<audio');
    host.remove();
  });
});
