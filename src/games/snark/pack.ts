// A Snark pack's prompts, stock answers and finals changed together: the pack editor, the
// wizard's kept items and "Fill in stock answers" all go through here, so a stock answer always
// belongs to one of the pack's own prompts (moved when its prompt is reworded, gone with it).
import type { SnarkFinal, SnarkPack } from '../../lib/content';

/** How two prompts are compared: lower case, spaces collapsed. */
export const promptKey = (q: string): string => q.trim().toLowerCase().replace(/\s+/g, ' ');

/** What the wizard writes: a prompt with its stock answer, or a final with the house's three lines. */
export type SnarkItem = { kind: 'prompt'; prompt: string; safety: string } | ({ kind: 'final' } & SnarkFinal);
/** A stock answer for one of the pack's prompts. */
export interface Stock { prompt: string; safety: string }

export const itemKey = (i: { prompt: string }): string => promptKey(i.prompt);

/** Every prompt the pack uses, regular and final: none may come again. */
export const packTexts = (p: SnarkPack): string[] => [...p.prompts, ...(p.finals ?? []).map((f) => f.prompt)];

/** The pack's prompts that have no stock answer. */
export const missingStock = (p: SnarkPack): string[] => p.prompts.filter((q) => !p.safety?.[q]);

/** The pack with `safety` as its stock answers, keeping only those for its own prompts (no field when none). */
function withSafety(p: SnarkPack, safety: Record<string, string>): SnarkPack {
  const { safety: _, ...rest } = p;
  const have = new Set(p.prompts);
  const kept = Object.entries(safety).filter(([q, a]) => a && have.has(q));
  return kept.length ? { ...rest, safety: Object.fromEntries(kept) } : rest;
}

/** `kept` on top of the pack: new prompts first with their stock answers, new finals first; none it already has. */
export function addItems(p: SnarkPack, kept: readonly SnarkItem[]): SnarkPack {
  const taken = new Set(packTexts(p).map(promptKey));
  const fresh = kept.filter((i) => !taken.has(itemKey(i)) && !!taken.add(itemKey(i)));
  const prompts = fresh.flatMap((i) => (i.kind === 'prompt' ? [i] : []));
  const finals: SnarkFinal[] = fresh.flatMap((i) => (i.kind === 'final' ? [{ prompt: i.prompt, house: [...i.house] as SnarkFinal['house'] }] : []));
  const next = { ...p, prompts: [...prompts.map((i) => i.prompt), ...p.prompts] };
  if (finals.length) next.finals = [...finals, ...(p.finals ?? [])];
  return withSafety(next, { ...p.safety, ...Object.fromEntries(prompts.map((i) => [i.prompt, i.safety])) });
}

/** Stock answers for prompts the pack has; an answer it already has stays. */
export function addStock(p: SnarkPack, kept: readonly Stock[]): SnarkPack {
  return withSafety(p, { ...Object.fromEntries(kept.map((s) => [s.prompt, s.safety])), ...p.safety });
}

/** Prompt `at` (or a new one, first) set to `text`, with `stock` as its stock answer ('' for none). */
export function setPrompt(p: SnarkPack, at: number | 'new', text: string, stock: string): SnarkPack {
  const prompts = at === 'new' ? [text, ...p.prompts] : p.prompts.map((q, i) => (i === at ? text : q));
  const safety = { ...p.safety };
  if (at !== 'new') delete safety[p.prompts[at]];
  if (stock) safety[text] = stock;
  return withSafety({ ...p, prompts }, safety);
}

/** The pack without prompt `at` and its stock answer. */
export function removePrompt(p: SnarkPack, at: number): SnarkPack {
  return withSafety({ ...p, prompts: p.prompts.filter((_, i) => i !== at) }, p.safety ?? {});
}
