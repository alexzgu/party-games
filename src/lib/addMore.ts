// "🧙 Add more" on a pack the player made: Fizzwick writes more items on top of the pack, in its
// spirit, never repeating what is there. Each game brings its own system prompt, how an item reads
// in a list and how a streamed line becomes an item; this file builds the request, keeps the stream
// to new items and merges the kept ones into the pack.
import { streamLines } from './claude';

/** What the player asked for: how many, and an optional steer ("more 90s ones", "harder"). */
export interface MoreAsk {
  count: number;
  steer: string;
}

/** One request from the add-more screen: the ask, plus what the screen already holds. */
export interface MoreRun<T> extends MoreAsk {
  /** Items already written this time, never to come again. */
  avoid: readonly T[];
  onItem: (t: T) => void;
  signal?: AbortSignal;
}

/** The pack as the prompt sees it. */
export interface MorePack {
  name: string;
  blurb: string;
  /** Items the wizard must not repeat (the pack's, plus any already written this time), one line each. */
  have: readonly string[];
  /** Items other packs of the game already use, for games whose items are unique across packs. */
  others?: readonly string[];
  /** What each listed line is, when not a whole item ("their answers"). */
  listed?: string;
}

/** How many characters of existing items one request lists (the wizard server takes 64 KB in all). */
export const MAX_LISTED_CHARS = 24_000;

/** What the add-more screen says when nothing new came back. */
export const EMPTY_HANDED = 'Fizzwick came back empty-handed. Try again, or change the steer.';

/** The lines from the start of `lines` that fit in `budget` characters. */
export function within(lines: readonly string[], budget: number): string[] {
  const out: string[] = [];
  let used = 0;
  for (const l of lines) {
    used += l.length + 1;
    if (used > budget) break;
    out.push(l);
  }
  return out;
}

/** The theme a pack's description gives: the app's own placeholder blurbs say nothing about it. */
export function aboutOf(blurb: string): string {
  const b = blurb.trim().replace(/^Conjured by Fizzwick:?\s*/i, '');
  return /^(pasted list|(made|pasted) on this phone|conjured by fizzwick|\d+ prompts)$/i.test(b) ? '' : b;
}

/** The request for `ask.count` more `noun` on top of a pack. */
export function morePrompt(pack: MorePack, ask: MoreAsk, noun: string): string {
  const parts = [`Pack: ${pack.name.trim() || 'My pack'}`];
  const about = aboutOf(pack.blurb);
  if (about) parts.push(`About: ${about}`);
  parts.push(`Write ${ask.count} more ${noun} for this pack, on its theme and in the same spirit as the ones it already has.`);
  if (ask.steer.trim()) parts.push(`The player asks for: ${ask.steer.trim()}`);
  const what = pack.listed ? ` (${pack.listed})` : '';
  const have = within(pack.have, MAX_LISTED_CHARS);
  if (have.length) parts.push(`Already in the pack${what}, so never repeat or closely rephrase any of these:\n${have.join('\n')}`);
  const used = have.reduce((n, l) => n + l.length + 1, 0);
  const others = within(pack.others ?? [], MAX_LISTED_CHARS - used);
  if (others.length) parts.push(`Already used in other packs${what}, so never use these either:\n${others.join('\n')}`);
  return parts.join('\n\n');
}

export interface MoreStream<T> {
  system: string;
  prompt: string;
  /** The most items to hand over; later lines are ignored. */
  count: number;
  maxTokens?: number;
  /** One streamed line to an item, or null when it is not a usable one. */
  read: (line: string) => T | null;
  keyOf: (t: T) => string;
  /** Keys never to hand over: the pack's, other packs' where the game needs it, earlier batches'. */
  taken: Iterable<string>;
  onItem: (t: T) => void;
  /** The pack name the prompt asked for, lifted out of the stream (never an item). */
  onName?: (name: string) => void;
  signal?: AbortSignal;
}

/** Streams the wizard's answer and hands over each new, unique item; resolves to how many came. */
export async function streamMore<T>(o: MoreStream<T>): Promise<number> {
  const seen = new Set(o.taken);
  let n = 0;
  await streamLines({
    system: o.system,
    prompt: o.prompt,
    signal: o.signal,
    maxTokens: o.maxTokens,
    onName: o.onName,
    onLine: (line) => {
      const item = n < o.count ? o.read(line) : null;
      const k = item ? o.keyOf(item) : '';
      if (!item || !k || seen.has(k)) return;
      seen.add(k);
      n++;
      o.onItem(item);
    },
  });
  return n;
}

/** `kept` on top of `have`, leaving out any already there or repeated. */
export function mergeOnTop<T>(have: readonly T[], kept: readonly T[], keyOf: (t: T) => string): T[] {
  const seen = new Set(have.map(keyOf));
  const fresh = kept.filter((t) => {
    const k = keyOf(t);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return [...fresh, ...have];
}
