// "Ask for changes" on the review of a pack Fizzwick just made, in every game: the player says
// what to change ("only the ones from France") and he writes the whole list again, the same size,
// keeping what still fits and replacing the rest. One request, always three messages: the first
// run's prompt, the list as the player kept it (in the game's own line format, as if he had
// written it), and the change. Each game brings a `ChangeGame`; this file builds the messages,
// keeps the stream to the asked counts and says what changed.
import type { Turn } from './claude';
import { MAX_LISTED_CHARS, streamMore, within } from './addMore';
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
  /** "30 cards", "10 prompts and 40 answers". */
  describe: (counts: Record<string, number>) => string;
  /** The most a single run on the make screen may ask for. */
  max: number;
  avoidLine: (a: A) => string;
  avoidKey: (a: A) => string;
  /** Keys never handed over whatever the request (examples in the system prompt). */
  taken?: readonly string[];
}

const ALL = 'all';
const kindOf = <T, A>(g: ChangeGame<T, A>, t: T) => g.kindOf?.(t) ?? ALL;
const split = <T, A>(g: ChangeGame<T, A>, count: number) => g.split?.(count) ?? { [ALL]: count };

/**
 * How many of each list the change asks for: as many as are kept on screen, never fewer than the
 * first run asked for and never more than one run may ask for. `capped`: the cap cut a list.
 */
export function quota<T, A>(g: ChangeGame<T, A>, kept: readonly T[], asked: number): { counts: Record<string, number>; capped: boolean } {
  const floor = split(g, asked);
  const cap = split(g, g.max);
  const counts: Record<string, number> = {};
  let capped = false;
  for (const k of Object.keys(floor)) {
    const have = kept.filter((t) => kindOf(g, t) === k).length;
    counts[k] = Math.min(Math.max(have, floor[k]), cap[k] ?? floor[k]);
    if (have > counts[k]) capped = true;
  }
  return { counts, capped };
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

/** The three messages of a change, and the counts it asks for. */
export function changeTurns<T, A>(g: ChangeGame<T, A>, o: ChangeAsk<T, A>): { turns: Turn[]; counts: Record<string, number>; capped: boolean } {
  const { counts, capped } = quota(g, o.kept, o.asked);
  const parts = [`The player asks for a change: ${o.ask.trim().slice(0, CHANGE_MAX)}`];
  const earlier = o.earlier.slice(-EARLIER_MAX);
  if (earlier.length) parts.push(`Changes already made, oldest first:\n${earlier.map((e) => `- ${e}`).join('\n')}`);
  const removed = within(o.removed.map(g.line), REMOVED_CHARS);
  if (removed.length) parts.push(`The player removed these, so never bring them back:\n${removed.join('\n')}`);
  parts.push(`Write the whole list again: exactly ${g.describe(counts)}, in the same format. Keep the ones that still fit the change and replace the rest.`);
  const avoid = within(o.avoid.map(g.avoidLine), MAX_LISTED_CHARS);
  if (avoid.length) parts.push(`These are already in use elsewhere, so never use them either:\n${avoid.join('\n')}`);
  if (o.named) parts.push(NAME_ASK);
  const list = o.kept.map(g.line).join('\n');
  return {
    turns: [
      { role: 'user', content: g.first(o.request, o.asked) },
      // An assistant message cannot be empty: a list with nothing kept says so.
      { role: 'assistant', content: list || '(The player removed every item.)' },
      { role: 'user', content: parts.join('\n\n') },
    ],
    counts,
    capped,
  };
}

/** How many of `after` were already in `before` (by key), and how many are new. */
export function tally<T>(before: readonly T[], after: readonly T[], keyOf: (t: T) => string): { kept: number; replaced: number } {
  const had = new Set(before.map(keyOf));
  const kept = after.filter((t) => had.has(keyOf(t))).length;
  return { kept, replaced: after.length - kept };
}

/** Fizzwick's line in the thread: "Kept 12 · replaced 28", and how many came back when one run's cap cut the list. */
export function resultLine(t: { kept: number; replaced: number }, capped: boolean): string {
  const line = `Kept ${t.kept} · replaced ${t.replaced}`;
  return capped ? `${line} · ${t.kept + t.replaced} came back, the most one ask can bring` : line;
}

/** Streams the changed list: each new item within the counts, none removed or avoided; resolves to how many came. */
export function streamChange<T, A>(g: ChangeGame<T, A>, o: ChangeAsk<T, A> & { onItem: (t: T) => void; onName?: (name: string) => void; signal?: AbortSignal }): Promise<{ n: number; capped: boolean }> {
  const { turns, counts, capped } = changeTurns(g, o);
  const left = { ...counts };
  const total = Object.values(left).reduce((n, x) => n + x, 0);
  return streamMore<T>({
    system: g.system, prompt: turns[2].content, messages: turns, count: total, maxTokens: g.maxTokens,
    read: (line) => { const t = g.read(line, o.request); return t && (left[kindOf(g, t)] ?? 0) > 0 ? t : null; },
    keyOf: g.keyOf,
    taken: [...o.removed.map(g.keyOf), ...o.avoid.map(g.avoidKey), ...(g.taken ?? [])],
    onItem: (t) => { left[kindOf(g, t)]--; o.onItem(t); },
    onName: o.onName, signal: o.signal,
  }).then((n) => ({ n, capped }));
}
