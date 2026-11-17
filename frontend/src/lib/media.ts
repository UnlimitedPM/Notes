/** Sélecteur de média partagé entre l'éditeur et les tests. */
export function findMedia(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const media = target.closest('img, audio');
  return media instanceof HTMLElement ? media : null;
}

/** Retire un média (image ou audio) de la note. */
export function removeMedia(media: Element): void {
  media.remove();
}

export type MediaEntry = { kind: 'img' | 'audio'; n: number };

/**
 * Liste les médias d'une note, numérotés par type (« Image 1 », « Note vocale 1 »…).
 */
export function listMedia(root: ParentNode | null): MediaEntry[] {
  if (!root) return [];
  let img = 0;
  let audio = 0;
  return Array.from(root.querySelectorAll('img, audio')).map((el) => {
    if (el.tagName === 'AUDIO') {
      audio += 1;
      return { kind: 'audio' as const, n: audio };
    }
    img += 1;
    return { kind: 'img' as const, n: img };
  });
}

/** Supprime le n-ième média et renvoie l'élément retiré. */
export function removeMediaAt(root: ParentNode | null, index: number): Element | null {
  if (!root) return null;
  const media = Array.from(root.querySelectorAll('img, audio'))[index] ?? null;
  if (!media) return null;
  removeMedia(media);
  return media;
}
