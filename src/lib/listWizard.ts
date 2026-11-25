// "🧙 Ask the wizard" and "🧙 Add more" for list packs (listPack.ts): Fizzwick writes one item per
// line, each starting with its list's label ("Prompt: …", "Answer: …"; a one-list game may leave
// the label out). A line is kept only when it meets its list's rules (the content gate's) and is
// new to every pack of the game on the phone; anything else is dropped before anyone sees it.
import { MAX_LISTED_CHARS, morePrompt, streamMore, within, type MoreRun } from './addMore';
import { checked, itemKey, packItems, type ListItem, type ListPack, type ListSpec } from './listPack';
import { askedFor, withNameAsk } from './wizardAsk';

export interface ListWizard {
  specs: readonly ListSpec[];
  system: string;
  /** Each list's line label, by field ("Prompt"). */
  labels: Record<string, string>;
  /** How many of each list one ask for `count` wants; the main (first) list gets `count` itself. */
  split: (count: number) => Record<string, number>;
}

const unquote = (s: string) => s.replace(/^["“](.*)["”]$/, '$1');

/** One streamed line to an item of the list its label names, or null when it breaks a rule. */
export function readLine(w: ListWizard, line: string): ListItem | null {
  const body = line.replace(/\*\*|`/g, '').replace(/^\s*(?:[-*•]\s+|\d+[.)]\s+)/, '').trim();
  const m = /^([A-Za-z]+)\s*[:–—-]\s*(.*)$/.exec(body);
  const spec = m ? w.specs.find((s) => w.labels[s.field].toLowerCase() === m[1].toLowerCase()) : undefined;
  const target = spec ?? (w.specs.length === 1 ? w.specs[0] : undefined);
  if (!target) return null;
  const text = checked(target, unquote((spec ? m![2] : body).trim()));
  return text ? { field: target.field, text } : null;
}

/** "30 prompts and 120 answers". */
export const askLine = (w: ListWizard, counts: Record<string, number>): string =>
  w.specs.map((s) => `${counts[s.field]} ${counts[s.field] === 1 ? s.one : s.many}`).join(' and ');

/** Items as the request lists them: "Prompt: …". */
const listed = (w: ListWizard, items: readonly ListItem[]): string[] => items.map((i) => `${w.labels[i.field]}: ${i.text}`);

/** The prompt for a new pack from the player's `request`, never an item in `avoid`; `named`: ask for a pack name too. */
export function buildPrompt(w: ListWizard, request: string, count: number, avoid: readonly ListItem[], named = false): string {
  const parts = withNameAsk([askedFor(request, 'a mix of everything'), `Write ${askLine(w, w.split(count))} that fit the request.`], named);
  const used = within(listed(w, avoid), MAX_LISTED_CHARS);
  if (used.length) parts.push(`These are already in use, so never use them again or closely rephrase them:\n${used.join('\n')}`);
  return parts.join('\n\n');
}

interface Stream { prompt: string; counts: Record<string, number>; taken: readonly ListItem[]; onItem: (i: ListItem) => void; onName?: (name: string) => void; signal?: AbortSignal }

function stream(w: ListWizard, o: Stream): Promise<number> {
  const left = { ...o.counts };
  const total = Object.values(left).reduce((n, x) => n + x, 0);
  const key = itemKey(w.specs);
  return streamMore<ListItem>({
    system: w.system, prompt: o.prompt, count: total, maxTokens: 8000,
    read: (line) => { const i = readLine(w, line); return i && (left[i.field] ?? 0) > 0 ? i : null; },
    keyOf: key, taken: o.taken.map(key), signal: o.signal, onName: o.onName,
    onItem: (i) => { left[i.field]--; o.onItem(i); },
  });
}

/**
 * "Make a pack": `count` items for the player's request, never one in `avoid` (every pack's of the
 * game, and those on screen). With `onName`, Fizzwick also suggests the pack's name, handed there.
 */
export function generateItems(w: ListWizard, o: { theme: string; count: number; avoid: readonly ListItem[]; onItem: (i: ListItem) => void; onName?: (name: string) => void; signal?: AbortSignal }): Promise<number> {
  return stream(w, { prompt: buildPrompt(w, o.theme, o.count, o.avoid, !!o.onName), counts: w.split(o.count), taken: o.avoid, onItem: o.onItem, onName: o.onName, signal: o.signal });
}

/** "🧙 Add more": more on top of `pack`, never one of its own, of those written this time or of `others` (every other pack's). */
export function moreItems(w: ListWizard, pack: ListPack, others: readonly ListItem[], run: MoreRun<ListItem>): Promise<number> {
  const have = [...run.avoid, ...packItems(w.specs, pack)];
  const counts = w.split(run.count);
  // The main list's count is the stepper's, so "Write 15 more prompts and 60 answers".
  const noun = askLine(w, counts).replace(/^\d+ /, '');
  const prompt = morePrompt({ name: pack.name, blurb: pack.blurb, have: listed(w, have), others: listed(w, others) }, run, noun);
  return stream(w, { prompt, counts, taken: [...have, ...others], onItem: run.onItem, signal: run.signal });
}
