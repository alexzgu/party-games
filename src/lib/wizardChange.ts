// "Ask for changes" on the review of a pack Fizzwick just made, in every game: the player says
// what to change ("only the ones from France") and he writes the whole list again, the same size,
// keeping what still fits and replacing the rest. Each request is always three messages: the first
// run's prompt, a part of the list as the player kept it (in the game's own line format, as if he
// had written it), and the change. A list longer than one run may ask for is changed in parts, one
// request after another, so it never shrinks. Each game brings a `ChangeGame`; this file builds the
// messages, keeps each body under the server's limit, keeps the stream to the asked counts and says
// what changed.
import type { Turn } from './claude';
import { MAX_LISTED_CHARS, MAX_REQUEST_BYTES, streamMore } from './addMore';
import { NAME_ASK } from './wizardAsk';

/** The most characters a change may have. */
export const CHANGE_MAX = 200;
/** How many earlier changes a request repeats, newest kept. */
export const EARLIER_MAX = 5;
/** How many characters of removed items a request lists. */
export const REMOVED_CHARS = 4000;

/** What one game tells the change mechanism; `A` is what its avoid list holds (items, or their words). */
export interface ChangeGame<T, A = T> {
  system: string;
  maxTokens: number;
  /** The first run's prompt for `request` and `count`, with no avoid list and no name ask. */
  first: (request: string, count: number) => string;
  /** One item as the line the game's reader reads (`read(line(t))` gives `t` back). */
  line: (t: T) => string;
  /** One streamed line to an item, or null when it is not a usable one. */
  read: (line: string, request: string) => T | null;
  keyOf: (t: T) => string;
  /** Which list an item belongs to (games with several); one list when absent. */
  kindOf?: (t: T) => string;
  /** How many of each list a run of `count` asks for (one list: `{ all: count }`). */
  split?: (count: number) => Record<string, number>;
  /** "30 cards", "10 prompts and 40 answers" (a list with none is left out). */
  describe: (counts: Record<string, number>) => string;
  /** The most a single run on the make screen may ask for: no request asks for more of any list. */
  max: number;
  avoidLine: (a: A) => string;
  avoidKey: (a: A) => string;
  /** Keys never handed over whatever the request (examples in the system prompt). */
  taken?: readonly string[];
}

const ALL = 'all';
const kindOf = <T, A>(g: ChangeGame<T, A>, t: T) => g.kindOf?.(t) ?? ALL;
const split = <T, A>(g: ChangeGame<T, A>, count: number) => g.split?.(count) ?? { [ALL]: count };

/** A change typed over several lines, as one line. */
export const oneLine = (s: string): string => s.replace(/\s+/g, ' ').trim().slice(0, CHANGE_MAX);

/** One request of a change: its part of the kept list, and how many of each list it asks for. */
export interface Part<T> { kept: T[]; counts: Record<string, number> }

/**
 * The requests a change takes. Each list asks for as many as are kept, never fewer than the first
 * run asked for; a list longer than one run's largest count is cut into parts of at most that
 * many, the n-th part of every list going into the n-th request. Each request asks for exactly as
 * many as its part holds; what the first-asked count adds goes on the last request.
 */
export function parts<T, A>(g: ChangeGame<T, A>, kept: readonly T[], asked: number): Part<T>[] {
  const floor = split(g, asked);
  const cap = split(g, g.max);
  const kinds = Object.keys(floor);
  const chunks: Record<string, T[][]> = {};
  for (const k of kinds) {
    const mine = kept.filter((t) => kindOf(g, t) === k);
    const size = Math.max(1, cap[k] ?? floor[k]);
    chunks[k] = [];
    for (let i = 0; i < mine.length; i += size) chunks[k].push(mine.slice(i, i + size));
  }
  const n = Math.max(1, ...kinds.map((k) => chunks[k].length));
  const out = Array.from({ length: n }, (_, i): Part<T> => {
    const counts: Record<string, number> = {};
    for (const k of kinds) counts[k] = chunks[k][i]?.length ?? 0;
    return { kept: kinds.flatMap((k) => chunks[k][i] ?? []), counts };
  });
  for (const k of kinds) {
    const have = kept.filter((t) => kindOf(g, t) === k).length;
    out[n - 1].counts[k] += Math.max(0, floor[k] - have);
  }
  return out;
}

export interface ChangeAsk<T, A> {
  /** What the player first asked for, and how many. */
  request: string;
  asked: number;
  /** The list on screen: kept items (in order) and the ones the player removed. */
  kept: readonly T[];
  removed: readonly T[];
  /** Changes already applied, oldest first. */
  earlier: readonly string[];
  /** This change. */
  ask: string;
  /** What a first run avoids (other packs' items, the pack added to). */
  avoid: readonly A[];
  /** Ask for a pack name too. */
  named: boolean;
}

/** A string's size in a JSON body, in bytes. */
const bytes = (s: string) => new TextEncoder().encode(JSON.stringify(s)).length;

/** The lines from the start of `lines` that fit in `budget` bytes (and `chars` characters). */
function fit(lines: readonly string[], budget: number, chars = Infinity): string[] {
  const out: string[] = [];
  let used = 0;
  let count = 0;
  for (const l of lines) {
    used += bytes(l) + 1;
    count += l.length + 1;
    if (used > budget || count > chars) break;
    out.push(l);
  }
  return out;
}

/** Room left for a request's whole body besides its fields: model, token cap and the like. */
const OVERHEAD = 1024;

/**
 * The three messages of request `at` of a change (`part` from `parts`). `written`: what earlier
 * requests of this change brought, never repeated. The lists in the last message are trimmed to
 * keep the body within MAX_REQUEST_BYTES: the avoid list first, then the removed items, then what
 * was written.
 */
export function changeTurns<T, A>(g: ChangeGame<T, A>, o: ChangeAsk<T, A>, part: Part<T>, at = 0, of = 1, written: readonly T[] = []): Turn[] {
  const counts = Object.fromEntries(Object.entries(part.counts).filter(([, n]) => n > 0));
  const head = [`The player asks for a change: ${oneLine(o.ask)}`];
  const earlier = o.earlier.slice(-EARLIER_MAX).map(oneLine);
  if (earlier.length) head.push(`Changes already made, oldest first:\n${earlier.map((e) => `- ${e}`).join('\n')}`);
  const whole = of > 1
    ? `The list is long, so it is changed in ${of} parts; your list above is part ${at + 1}. Write that part again: exactly ${g.describe(counts)}, in the same format. Keep the ones that still fit the change and replace the rest.`
    : `Write the whole list again: exactly ${g.describe(counts)}, in the same format. Keep the ones that still fit the change and replace the rest.`;
  const tail = [whole];
  if (o.named && at === 0) tail.push(NAME_ASK);
  const first = g.first(o.request, o.asked);
  // An assistant message cannot be empty: a list with nothing kept says so.
  const list = part.kept.map(g.line).join('\n') || '(The player removed every item.)';
  let room = MAX_REQUEST_BYTES - OVERHEAD - bytes(g.system) - bytes(first) - bytes(list) - bytes([...head, ...tail].join('\n\n')) - 300;
  const take = (lines: string[], chars?: number) => {
    const kept = fit(lines, Math.max(0, room), chars);
    room -= kept.reduce((n, l) => n + bytes(l) + 1, 0);
    return kept;
  };
  const done = take(written.map(g.line));
  const removed = take(o.removed.map(g.line), REMOVED_CHARS);
  const avoid = take(o.avoid.map(g.avoidLine), MAX_LISTED_CHARS);
  const mid: string[] = [];
  if (done.length) mid.push(`Already written in this change, so never repeat them:\n${done.join('\n')}`);
  if (removed.length) mid.push(`The player removed these, so never bring them back:\n${removed.join('\n')}`);
  if (avoid.length) mid.push(`These are already in use elsewhere, so never use them either:\n${avoid.join('\n')}`);
  return [
    { role: 'user', content: first },
    { role: 'assistant', content: list },
    { role: 'user', content: [...head, ...mid, ...tail].join('\n\n') },
  ];
}

/** How many of `after` were already in `before` (by key), and how many are new. */
export function tally<T>(before: readonly T[], after: readonly T[], keyOf: (t: T) => string): { kept: number; replaced: number } {
  const had = new Set(before.map(keyOf));
  const kept = after.filter((t) => had.has(keyOf(t))).length;
  return { kept, replaced: after.length - kept };
}

/** Fizzwick's line in the thread: "Kept 12 · replaced 28". */
export const resultLine = (t: { kept: number; replaced: number }): string => `Kept ${t.kept} · replaced ${t.replaced}`;

/**
 * Streams the changed list, request after request: each new item within its request's counts,
 * none removed, avoided or already written. Resolves to how many came, or 0 when any request
 * brought nothing (the whole change then counts as failed).
 */
export async function streamChange<T, A>(g: ChangeGame<T, A>, o: ChangeAsk<T, A> & { onItem: (t: T) => void; onName?: (name: string) => void; signal?: AbortSignal }): Promise<number> {
  const all = parts(g, o.kept, o.asked);
  const written: T[] = [];
  const taken = [...o.removed.map(g.keyOf), ...o.avoid.map(g.avoidKey), ...(g.taken ?? [])];
  for (let at = 0; at < all.length; at++) {
    const turns = changeTurns(g, o, all[at], at, all.length, written);
    const left = { ...all[at].counts };
    const count = Object.values(left).reduce((n, x) => n + x, 0);
    const got = await streamMore<T>({
      system: g.system, prompt: turns[2].content, messages: turns, count, maxTokens: g.maxTokens,
      read: (line) => { const t = g.read(line, o.request); return t && (left[kindOf(g, t)] ?? 0) > 0 ? t : null; },
      keyOf: g.keyOf,
      taken: [...taken, ...written.map(g.keyOf)],
      onItem: (t) => { left[kindOf(g, t)]--; written.push(t); o.onItem(t); },
      onName: at === 0 ? o.onName : undefined, signal: o.signal,
    });
    if (got === 0 || o.signal?.aborted) return 0;
  }
  return written.length;
}
