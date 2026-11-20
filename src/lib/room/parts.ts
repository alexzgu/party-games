// PeerJS errors and drops the link on a JSON message of 16,300 UTF-8 bytes or more, so a big
// message (a drawing, a view that carries one) goes as numbered parts and is put back together
// before anyone reads it.
export const PART_AT = 15000;
/** Characters of JSON per part. Sending escapes the part again, so one character can take up to
 *  3 bytes (a quote or backslash 2, any other non-ASCII character at most 3): 5,000 stays under. */
export const PART_CHARS = 5000;
/** A message of more parts than this (about 640 KB) is someone else's mistake: refused. */
export const MAX_PARTS = 128;
const STALE_MS = 30000;

export interface Part { t: 'part'; id: string; i: number; n: number; s: string }

const bytes = (s: string) => new TextEncoder().encode(s).byteLength;

/** The message as it goes on the wire: itself when small, else its parts. */
export function toWire(msg: unknown, id: () => string): unknown[] {
  const json = JSON.stringify(msg);
  if (bytes(json) < PART_AT) return [msg];
  const n = Math.ceil(json.length / PART_CHARS);
  const key = id();
  return Array.from({ length: n }, (_, i) => ({ t: 'part', id: key, i, n, s: json.slice(i * PART_CHARS, (i + 1) * PART_CHARS) }));
}

const isPart = (m: unknown): m is Part => {
  const p = m as Part;
  return !!p && typeof p === 'object' && p.t === 'part' && typeof p.id === 'string' && p.id.length <= 40
    && Number.isInteger(p.n) && p.n >= 1 && p.n <= MAX_PARTS && Number.isInteger(p.i) && p.i >= 0 && p.i < p.n
    && typeof p.s === 'string' && p.s.length <= PART_CHARS;
};

/** Collects parts from one link; hands back each whole message once its last part is in. */
export class Assembler {
  private open = new Map<string, { got: (string | undefined)[]; left: number; at: number }>();

  /** A message as read off the link: returns it (not a part), the whole one (last part), or null. */
  take(raw: unknown, now = Date.now()): unknown {
    if ((raw as Part)?.t !== 'part') return raw;
    if (!isPart(raw)) return null;
    for (const [k, v] of this.open) if (now - v.at > STALE_MS) this.open.delete(k);
    let entry = this.open.get(raw.id);
    if (!entry) {
      if (this.open.size >= 4) return null; // a few big messages in flight at once, no more
      entry = { got: new Array(raw.n), left: raw.n, at: now };
      this.open.set(raw.id, entry);
    }
    if (entry.got.length !== raw.n || entry.got[raw.i] !== undefined) return null;
    entry.got[raw.i] = raw.s;
    entry.at = now;
    if (--entry.left > 0) return null;
    this.open.delete(raw.id);
    try { return JSON.parse(entry.got.join('')); } catch { return null; }
  }
}
