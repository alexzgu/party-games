// Keeps Tab inside a popup: from its last control to its first, and back.

/** Where Tab (or Shift+Tab, `back`) goes from `active`, when it must wrap round; null: the browser's own step is fine. */
export function wrapTo<T>(items: readonly T[], active: T | null, back: boolean): T | null {
  if (!items.length) return null;
  const at = active === null ? -1 : items.indexOf(active);
  if (back) return at <= 0 ? items[items.length - 1] : null;
  return at === items.length - 1 ? items[0] : null;
}

const CONTROLS = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/** The controls in `box` that Tab reaches, in order. */
export const controls = (box: HTMLElement): HTMLElement[] =>
  [...box.querySelectorAll<HTMLElement>(CONTROLS)].filter((x) => x.getClientRects().length > 0);
