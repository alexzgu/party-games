// Draw & guess live ink: the drawer's phone sends only what was added since its last send
// (about every 100 ms); undo and clear send the whole drawing. Each send is numbered, so a
// receiver that missed one asks for the whole drawing instead of drawing it wrong.
import type { Drawing, Stroke } from '../../lib/ink';

/** Keep strokes before `i`; stroke `i` keeps its first `o` numbers (o 0: it is dropped); then `d` is added, its first stroke continuing stroke `i` when o > 0. */
export type Delta = { i: number; o: number; d: Drawing };
export const SEND_MS = 100;

const same = (a: Stroke, b: Stroke) => a === b || (a.c === b.c && a.w === b.w && a.p.length === b.p.length && a.p.every((x, k) => x === b.p[k]));

/** What `b` adds to `a`; null when it is not only additions (undo, clear, a stroke replaced). */
export function diff(a: Drawing, b: Drawing): Delta | null {
  if (b.length < a.length) return null;
  if (!a.length) return { i: 0, o: 0, d: b };
  const i = a.length - 1;
  for (let k = 0; k < i; k++) if (!same(a[k], b[k])) return null;
  const was = a[i], now = b[i];
  if (was.c !== now.c || was.w !== now.w || now.p.length < was.p.length) return null;
  for (let k = 0; k < was.p.length; k++) if (was.p[k] !== now.p[k]) return null;
  return { i, o: was.p.length, d: [{ ...now, p: now.p.slice(was.p.length) }, ...b.slice(a.length)] };
}

/** What the drawer's phone sends next (`sent`: what the host has, null to send it all; `n`: sends so far), or null. A phone that has drawn nothing sends nothing: it may have taken over a turn half drawn. */
export function outgoing(sent: Drawing | null, n: number, d: Drawing): Delta | { all: Drawing } | null {
  if (d === sent || (!n && !d.length)) return null;
  return (sent && n ? diff(sent, d) : null) ?? { all: d };
}

/** `a` with the delta applied; null when `a` is not the drawing the delta was made from. */
export function apply(a: Drawing, { i, o, d }: Delta): Drawing | null {
  if (o === 0) return a.length === i ? [...a, ...d] : null;
  const s = a[i];
  if (a.length !== i + 1 || s.p.length !== o || !d[0] || d[0].c !== s.c || d[0].w !== s.w) return null;
  return [...a.slice(0, i), { ...s, p: [...s.p, ...d[0].p] }, ...d.slice(1)];
}
