export type NoteKind = 'text' | 'checklist';

export type NoteColorKey =
  | 'default'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'pink'
  | 'orange'
  | 'gray';

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Note {
  id: string;
  kind: NoteKind;
  title: string;
  /** Contenu HTML (notes texte). */
  html: string;
  /** Éléments (listes de cases à cocher). */
  items: ChecklistItem[];
  color: NoteColorKey;
  pinned: boolean;
  folderId: string | null;
  hidden: boolean;
  /** Horodatage du rappel, null si aucun. */
  remindAt: number | null;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  /** Horodatage de mise à la corbeille, null si active. */
  deletedAt: number | null;
}

export interface Folder {
  id: string;
  name: string;
}

export type SortKey = 'updated' | 'created' | 'title';
export type ThemeKey = 'system' | 'light' | 'dark';
export type TextSizeKey = 'small' | 'medium' | 'large';
export type LayoutKey = 'grid' | 'list';

export interface TaskItem {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
  updatedAt: number;
}
