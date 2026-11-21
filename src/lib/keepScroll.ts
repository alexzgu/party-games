// Parts of a page that scroll on their own (a pack page's packs, the screen itself when it fills
// the screen) carry `data-keep-scroll="<name>"`. The router keeps how far each was scrolled with
// the page when it is left, and puts them back on Back, as it does the page's own scroll.

/** How far each named part was scrolled. */
export type Kept = Record<string, number>;

const parts = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('[data-keep-scroll]')];

/** The scroll of every named part on the page now. */
export function readKept(): Kept {
  const kept: Kept = {};
  for (const el of parts()) kept[el.dataset.keepScroll as string] = el.scrollTop;
  return kept;
}

/** From a history entry: only names with a scroll of 0 or more (older entries have none). */
export function cleanKept(x: unknown): Kept {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return {};
  return Object.fromEntries(Object.entries(x).filter(([, v]) => typeof v === 'number' && Number.isFinite(v) && v >= 0));
}

/** Scrolls each named part on the page back to where it was. */
export function restoreKept(kept: Kept): void {
  for (const el of parts()) {
    const y = kept[el.dataset.keepScroll as string];
    if (y !== undefined) el.scrollTop = y;
  }
}
