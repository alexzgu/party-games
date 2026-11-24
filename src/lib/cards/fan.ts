// Where the cards of a hand sit in a given width (components/cards/CardFan.svelte): side by side
// when they fit, else overlapping in even rows, each card showing at least its left half (the
// corner with its rank and suit) and each row the top part of the cards under it.

/** The least part of a card's width left showing beside the next one. */
export const MIN_SHOWN = 0.5;
/** The part of a card's height each row moves down. */
export const ROW_STEP = 0.56;
const GAP = 4;

export type Fan = { perRow: number; rows: number; strip: number; step: number; width: number; height: number };

/** A hand of `n` cards, each `w` wide, laid out in `room` px. */
export function fanLayout(n: number, room: number, w: number): Fan {
  const h = w * 1.4;
  if (n <= 0) return { perRow: 0, rows: 0, strip: 0, step: 0, width: 0, height: 0 };
  const apart = w + GAP;
  const fit = Math.max(1, Math.floor((room + GAP) / apart));
  if (n <= fit) return { perRow: n, rows: 1, strip: apart, step: 0, width: n * apart - GAP, height: h };
  const most = Math.max(1, Math.floor((room - w) / (w * MIN_SHOWN)) + 1);
  const rows = Math.ceil(n / most);
  const perRow = Math.ceil(n / rows);
  const strip = perRow > 1 ? Math.min(apart, (room - w) / (perRow - 1)) : apart;
  const step = h * ROW_STEP;
  return { perRow, rows, strip, step, width: (perRow - 1) * strip + w, height: (rows - 1) * step + h };
}
