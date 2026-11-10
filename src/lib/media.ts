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
