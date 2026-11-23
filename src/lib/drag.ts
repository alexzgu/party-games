// Pure parts of dragging a floating element: keeping it on screen and telling a tap from a drag.

export interface Point { x: number; y: number }
export interface Size { w: number; h: number }

/** A movement shorter than this (px) is a tap, not a drag. */
export const TAP_SLOP = 8;

/** True while a press has moved too little to count as a drag. */
export const isTap = (from: Point, to: Point, slop = TAP_SLOP): boolean => Math.hypot(to.x - from.x, to.y - from.y) < slop;

/** Two taps this close in time (ms) and place (px) are a double tap. */
const DOUBLE_MS = 350;
const DOUBLE_SLOP = 24;

/** A press that ended: where, when, and whether it was a tap on a bare spot (not a drag, not a button). */
export interface Press { at: Point; time: number; bareTap: boolean }

/** True when `next` is the second tap of a double tap; a drag or a button press between them breaks it. */
export const isDoubleTap = (last: Press | null, next: Press): boolean =>
  !!last && last.bareTap && next.bareTap && next.time - last.time <= DOUBLE_MS && isTap(last.at, next.at, DOUBLE_SLOP);

/**
 * The top-left corner `p` moved so a box of `size` sits wholly inside `area`, `margin` px from
 * its edges (a box bigger than the area sits at its top-left margin).
 */
export function clampInto(p: Point, size: Size, area: Size, margin = 8): Point {
  const fit = (v: number, len: number, room: number) => Math.max(margin, Math.min(v, room - len - margin));
  return { x: fit(p.x, size.w, area.w), y: fit(p.y, size.h, area.h) };
}
