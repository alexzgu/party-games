// "🧙 Ask the wizard" for Snark Tank: every prompt comes with a stock answer for "Give me one",
// and about one in five lines is a final for three-line duels with the house's three lines.
// Each streamed line is kept only when it meets AGENTS.md's Snark rules and lengths and is new
// to every Snark pack on the phone; anything else is dropped before anyone sees it.
import { aboutOf, MAX_LISTED_CHARS, morePrompt, streamMore, within, type MoreRun } from '../../lib/addMore';
import type { SnarkPack } from '../../lib/content';
import { ANSWER_MAX, LINE_MAX, LINES_EACH } from './logic';
import { MAX_PROMPT_CHARS } from './prompts';
import { itemKey, missingStock, packTexts, promptKey, type SnarkItem, type Stock } from './pack';

export const THEME_CHIPS = ['Office life', 'Roommates', 'Dating apps', 'Road trips', 'Family dinners', 'Group chats', 'Weddings', 'College', 'Pets', 'The gym', 'Holidays', 'After dark'];

/** "Make a pack": how many prompts to ask for. */
export const MAKE_RANGE = { start: 30, min: 10, max: 60, step: 5 };
/** "🧙 Add more" on a pack: how many prompts to ask for. */
export const MORE_RANGE = { start: 15, min: 5, max: 40, step: 5 };
/** How many missing stock answers one "Fill in stock answers" asks for. */
export const FILL_BATCH = 40;
/** Finals to ask for with `prompts` prompts: about one per five, at least one. */
export const finalsFor = (prompts: number): number => Math.max(1, Math.round(prompts / 5));

const STOCK_RULES = 'Stock answers (a player who is stuck taps "Give me one" and gets it): 1 to 8 words, sentence case, no punctuation at the end. Decent and mildly funny, never the best answer in the room.';

export const SYSTEM = `You write prompts for Snark Tank, a party game in the style of Quiplash. Everyone writes a funny answer to a prompt on their own phone, then the room votes for the funniest.

Write two kinds of line, one item per line and nothing else (no numbering, headings, quotes, blank lines or commentary):
1. A prompt, " | ", then its stock answer:
A terrible name for a boat | The Unsinkable II
2. A final: "Final: ", a prompt that asks for three things, then three short answers to it, all split by " | ":
Final: Three things you should never say to your landlord | I have a snake now | Define damage | Rent is a social construct

Prompts: 3 to 14 words, sentence case, no punctuation at the end, in your own words (never a commercial game's prompts). Open-ended, so there are a hundred funny answers, not one right one; nothing that needs inside knowledge. Players are adults in their 20s at a US house party; for cheeky or adult themes, cheeky, never explicit.
${STOCK_RULES}
Finals: the prompt starts with "Three" and is never one of the regular prompts; each of the three answers is 1 to 6 words (at most 40 characters) and genuinely funny.
Never repeat a prompt or use the examples.`;

export const FILL_SYSTEM = `You write stock answers for Snark Tank, a party game in the style of Quiplash, where everyone writes a funny answer to a prompt and the room votes.
For each prompt you are given, write one line: the prompt exactly as given, " | ", then its stock answer. Nothing else: no numbering, headings, quotes or commentary.
${STOCK_RULES}
Players are adults in their 20s at a US house party; cheeky, never explicit.
Example:
A terrible name for a boat | The Unsinkable II`;

const wordCount = (s: string) => s.split(' ').filter(Boolean).length;
const fits = (s: string, min: number, max: number, chars: number) => wordCount(s) >= min && wordCount(s) <= max && s.length <= chars;
const unquote = (s: string) => s.replace(/^["“](.*)["”]$/, '$1');
/** A house line: markdown, quotes and a closing full stop off, spaces collapsed. */
const plain = (s: string) => unquote(s.replace(/\*\*|__|`/g, '').trim()).replace(/\s+/g, ' ').replace(/\.+$/, '').trim();
/** A prompt or stock answer: plain, no end punctuation, first letter capital. */
function sentence(s: string): string {
  const t = plain(s).replace(/[.!?,;:…]+$/, '').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const FINAL = /^final\s*[:–—-]\s*/i;
/** A streamed line without markdown, list marker or table edges, and whether it is a final. */
function bare(line: string): { body: string; final: boolean } {
  const body = line.replace(/\*\*|__|`/g, '').replace(/^\s*(?:[-*•]\s+|\d+[.)]\s+)/, '').replace(/^\s*\|\s*|\s*\|\s*$/g, '').trim();
  return { body: body.replace(FINAL, ''), final: FINAL.test(body) };
}
const cells = (body: string) => body.split('|').map((c) => c.trim()).filter(Boolean);

const promptOk = (q: string) => fits(q, 3, 14, MAX_PROMPT_CHARS);
const stockOk = (a: string) => fits(a, 1, 8, ANSWER_MAX);

/** One streamed line to a prompt with its stock answer, or a final with three house lines; null when it breaks a rule. */
export function readItem(line: string): SnarkItem | null {
  const { body, final } = bare(line);
  const [first, ...rest] = cells(body);
  const prompt = sentence(first ?? '');
  if (!promptOk(prompt)) return null;
  if (!final) {
    const safety = sentence(rest[0] ?? '');
    return rest.length === 1 && stockOk(safety) ? { kind: 'prompt', prompt, safety } : null;
  }
  const house = rest.map(plain);
  if (!/^three\b/i.test(prompt) || house.length !== LINES_EACH || !house.every((l) => fits(l, 1, 6, LINE_MAX))) return null;
  return { kind: 'final', prompt, house: house as [string, string, string] };
}

/** The request for `prompts` prompts and `finals` finals on `theme`, never one in `avoid`. */
export function buildPrompt(theme: string, prompts: number, finals: number, avoid: readonly string[]): string {
  const parts = [`Theme: ${theme.trim() || 'a mix of everything'}`, `Write ${prompts} prompts with stock answers and ${finals} ${finals === 1 ? 'final' : 'finals'} that fit the theme.`];
  const listed = within(avoid, MAX_LISTED_CHARS);
  if (listed.length) parts.push(`These prompts are already in use, so never use them again or closely rephrase them:\n${listed.join('\n')}`);
  return parts.join('\n\n');
}

interface ItemStream { prompt: string; prompts: number; taken: readonly string[]; onItem: (i: SnarkItem) => void; signal?: AbortSignal }

/** Streams up to `prompts` prompts and finalsFor(prompts) finals, none whose prompt is in `taken`. */
function streamItems(o: ItemStream): Promise<number> {
  const left = { prompt: o.prompts, final: finalsFor(o.prompts) };
  return streamMore<SnarkItem>({
    system: SYSTEM, prompt: o.prompt, count: left.prompt + left.final, maxTokens: 6000,
    read: (line) => { const i = readItem(line); return i && left[i.kind] > 0 ? i : null; },
    keyOf: itemKey, taken: o.taken.map(promptKey), signal: o.signal,
    onItem: (i) => { left[i.kind]--; o.onItem(i); },
  });
}

/** "Make a pack": `count` prompts and their finals on a theme, never a prompt in `avoid` (every Snark pack's, and those on screen). */
export function generateItems(o: { theme: string; count: number; avoid: readonly string[]; onItem: (i: SnarkItem) => void; signal?: AbortSignal }): Promise<number> {
  const prompt = buildPrompt(o.theme, o.count, finalsFor(o.count), o.avoid);
  return streamItems({ prompt, prompts: o.count, taken: o.avoid, onItem: o.onItem, signal: o.signal });
}

/** More prompts and finals on top of `pack`, never one of its own, of those already written this time or of `others` (every other pack's). */
export function moreItems(pack: SnarkPack, others: readonly string[], run: MoreRun<SnarkItem>): Promise<number> {
  const have = [...run.avoid.map((i) => i.prompt), ...packTexts(pack)];
  const f = finalsFor(run.count);
  const prompt = morePrompt({ name: pack.name, blurb: pack.blurb, have, others }, run, `prompts with stock answers and ${f} ${f === 1 ? 'final' : 'finals'}`);
  return streamItems({ prompt, prompts: run.count, taken: [...have, ...others], onItem: run.onItem, signal: run.signal });
}

/** The prompts one "Fill in stock answers" asks about: missing ones not already answered on screen. */
export function toFill(pack: SnarkPack, done: readonly Stock[] = []): string[] {
  const answered = new Set(done.map(itemKey));
  return missingStock(pack).filter((q) => !answered.has(promptKey(q))).slice(0, FILL_BATCH);
}

export function fillPrompt(pack: SnarkPack, ask: readonly string[], steer: string): string {
  const parts = [`Pack: ${pack.name.trim() || 'My pack'}`];
  const about = aboutOf(pack.blurb);
  if (about) parts.push(`About: ${about}`);
  parts.push(`Write a stock answer for each of these ${ask.length} prompts:\n${ask.join('\n')}`);
  if (steer.trim()) parts.push(`The player asks for: ${steer.trim()}`);
  return parts.join('\n\n');
}

/** "🧙 Fill in stock answers": one for each prompt toFill lists, matched back to the pack's own prompt text. */
export function fillStock(pack: SnarkPack, run: MoreRun<Stock>): Promise<number> {
  const ask = toFill(pack, run.avoid);
  const byKey = new Map(ask.map((q) => [promptKey(sentence(q)), q]));
  const read = (line: string): Stock | null => {
    const [q, a, ...extra] = cells(bare(line).body);
    const prompt = byKey.get(promptKey(sentence(q ?? '')));
    const safety = sentence(a ?? '');
    return prompt && !extra.length && stockOk(safety) ? { prompt, safety } : null;
  };
  return streamMore({
    system: FILL_SYSTEM, prompt: fillPrompt(pack, ask, run.steer), count: ask.length, maxTokens: 4000,
    read, keyOf: itemKey, taken: run.avoid.map(itemKey), onItem: run.onItem, signal: run.signal,
  });
}
