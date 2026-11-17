import { describe, expect, it } from 'vitest';
import { formatCardDate, formatDay, formatFullDate, formatNoteDate } from '../src/lib/format';

/** Dates construites en heure locale pour être indépendantes du fuseau. */
const at = (y: number, m: number, d: number, h = 9, min = 5): number =>
  new Date(y, m - 1, d, h, min).getTime();

describe('formatNoteDate / formatFullDate / formatDay (unitaires)', () => {
  it('écrit une date de note sans l’année', () => {
    expect(formatNoteDate(at(2026, 10, 13, 19, 18))).toBe('13 octobre 19:18');
    expect(formatNoteDate(at(2026, 1, 2, 7, 4))).toBe('2 janvier 07:04');
  });

  it('écrit une date complète avec année et heure', () => {
    expect(formatFullDate(at(2026, 11, 9, 17, 58))).toBe('9 novembre 2026 · 17:58');
  });

  it('écrit un jour seul avec année', () => {
    expect(formatDay(at(2026, 12, 31, 23, 59))).toBe('31 décembre 2026');
  });
});

describe('formatCardDate (unitaires)', () => {
  it('ajoute l’année pour une date d’une autre année', () => {
    const now = new Date();
    const label = formatCardDate(at(now.getFullYear() - 1, 6, 15, 12, 0));

    expect(label).toBe(`15 Juin ${now.getFullYear() - 1}`);
  });

  it('préfixe « Hier » pour la veille', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(18, 51, 0, 0);

    expect(formatCardDate(yesterday.getTime())).toBe('Hier 18:51');
  });

  it('affiche une heure seule pour aujourd’hui', () => {
    const today = new Date();
    today.setHours(8, 7, 0, 0);

    expect(formatCardDate(today.getTime())).toBe('08:07');
  });
});
