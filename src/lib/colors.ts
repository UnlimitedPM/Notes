import type { NoteColorKey } from './types';

export interface NoteColor {
  key: NoteColorKey;
  label: string;
}

export const NOTE_COLORS: NoteColor[] = [
  { key: 'default', label: 'Défaut' },
  { key: 'yellow', label: 'Jaune' },
  { key: 'green', label: 'Vert' },
  { key: 'blue', label: 'Bleu' },
  { key: 'purple', label: 'Violet' },
  { key: 'pink', label: 'Rose' },
  { key: 'orange', label: 'Orange' },
  { key: 'gray', label: 'Gris' }
];
