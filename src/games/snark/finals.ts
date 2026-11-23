// A Snark pack's finals (three-line duels). The rule an import keeps them by is here once: pack
// files read with it, and sharing refuses a pack holding a final it would drop. The editor's own
// limits (the ones the wizard writes by) are stricter.
import type { SnarkFinal, SnarkPack } from '../../lib/content';
import { LINE_MAX, LINES_EACH } from './logic';
import { packTexts, promptKey } from './pack';
import { MAX_PROMPT_CHARS, promptProblem } from './prompts';

/** A final an import leaves out, and why. */
export interface DroppedFinal { prompt: string; why: string }

const text = (x: unknown): string => (typeof x === 'string' ? x.trim().replace(/\s+/g, ' ') : '');

/** Why a final's prompt or house lines cannot be used, or ''. */
function brokenBy(prompt: string, house: readonly string[]): string {
  if (!prompt) return 'no prompt';
  const why = promptProblem(prompt);
  if (why) return why;
  if (house.length !== LINES_EACH || house.some((l) => !l)) return `needs ${LINES_EACH} house lines`;
  return house.some((l) => l.length > LINE_MAX) ? `a house line is over ${LINE_MAX} characters` : '';
}

/** A pack's finals as an import keeps them, and the ones it leaves out (broken, too short or long, repeated). */
export function readFinals(raw: readonly unknown[]): { finals: SnarkFinal[]; dropped: DroppedFinal[] } {
  const finals: SnarkFinal[] = [];
  const dropped: DroppedFinal[] = [];
  const seen = new Set<string>();
  for (const x of raw) {
    const f = (x && typeof x === 'object' ? x : {}) as { prompt?: unknown; house?: unknown };
    const prompt = text(f.prompt);
    const house = Array.isArray(f.house) ? f.house.map(text) : [];
    const why = brokenBy(prompt, house) || (seen.has(prompt.toLowerCase()) ? 'repeated' : '');
    if (why) { dropped.push({ prompt, why }); continue; }
    seen.add(prompt.toLowerCase());
    finals.push({ prompt, house: house as SnarkFinal['house'] });
  }
  return { finals, dropped };
}

/** "Fix these finals first: “Three things” (repeated).", naming at most two; '' when none are dropped. */
export function finalsNote(dropped: readonly DroppedFinal[]): string {
  if (!dropped.length) return '';
  const named = dropped.slice(0, 2).map((d) => `${d.prompt ? `“${d.prompt}”` : 'one final'} (${d.why})`).join(', ');
  const rest = dropped.length > 2 ? ` and ${dropped.length - 2} more` : '';
  return `Fix ${dropped.length === 1 ? 'this final' : 'these finals'} first: ${named}${rest}.`;
}

/** Why final `at` of the pack (or a new one) cannot be saved as typed, or ''. */
export function finalProblem(p: SnarkPack, at: number | 'new', f: SnarkFinal): string {
  const words = f.prompt.split(' ').filter(Boolean).length;
  if (words < 3 || words > 14) return 'The prompt needs 3 to 14 words.';
  if (f.prompt.length > MAX_PROMPT_CHARS) return `The prompt is over ${MAX_PROMPT_CHARS} characters.`;
  const others = packTexts({ ...p, finals: p.finals?.filter((_, i) => i !== at) });
  if (others.some((q) => promptKey(q) === promptKey(f.prompt))) return 'That prompt is already in this pack.';
  const n = f.house.findIndex((l) => !l || l.length > LINE_MAX);
  return n < 0 ? '' : `House line ${n + 1} needs 1 to ${LINE_MAX} characters.`;
}

/** The pack with final `at` (or a new one, first) set to `f`. */
export function setFinal(p: SnarkPack, at: number | 'new', f: SnarkFinal): SnarkPack {
  const finals = p.finals ?? [];
  return { ...p, finals: at === 'new' ? [f, ...finals] : finals.map((x, i) => (i === at ? f : x)) };
}

/** The pack without final `at` (and no list at all once none are left). */
export function removeFinal(p: SnarkPack, at: number): SnarkPack {
  const { finals = [], ...rest } = p;
  const left = finals.filter((_, i) => i !== at);
  return left.length ? { ...rest, finals: left } : rest;
}
