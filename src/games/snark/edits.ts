// Typed changes to a saved Snark pack, put on the pack as saved now: another tab may have changed
// or deleted it since the editor read it. A change that no longer fits says why and saves nothing.
import { customSnark, snarkPacks, type SnarkFinal, type SnarkPack } from '../../lib/content';
import { NO_ROOM } from '../../lib/packfile';
import { finalProblem, removeFinal, setFinal } from './finals';
import { packTexts, promptKey, removePrompt, setPrompt } from './pack';

/** The pack changed, or why it cannot be. */
export type Change = (now: SnarkPack) => SnarkPack | { problem: string };

export const GONE = 'This pack was deleted somewhere else, so nothing was saved.';
const moved = (what: string) => `This ${what} was changed or deleted somewhere else, so nothing was saved. Close this to see the pack as it is now.`;

/** Saves the change on the pack as it is now; the pack as it then stands (null: deleted), and why nothing was saved, or ''. */
export function changeSaved(id: string, change: Change): { pack: SnarkPack | null; problem: string } {
  const now = snarkPacks().find((p) => p.id === id);
  if (!now) return { pack: null, problem: GONE };
  const next = change(now);
  if ('problem' in next) return { pack: now, problem: next.problem };
  const { custom: _, ...plain } = next;
  return customSnark.put(plain) ? { pack: next, problem: '' } : { pack: now, problem: NO_ROOM };
}

const sameFinal = (a: SnarkFinal, b: SnarkFinal) => a.prompt === b.prompt && a.house.join('\n') === b.house.join('\n');

/** The final that read `was` (null: a new one) set to `to` (null: deleted). */
export const changeFinal = (was: SnarkFinal | null, to: SnarkFinal | null): Change => (now) => {
  const at = was ? (now.finals ?? []).findIndex((f) => sameFinal(f, was)) : 'new';
  if (at === -1) return { problem: moved('final') };
  if (!to) return at === 'new' ? now : removeFinal(now, at);
  const problem = finalProblem(now, at, to);
  return problem ? { problem } : setFinal(now, at, to);
};

/** A prompt with its stock answer ('' for none). */
export interface PromptText { text: string; stock: string }

/** The prompt that read `was` (null: a new one) set to `to` (null: deleted). */
export const changePrompt = (was: PromptText | null, to: PromptText | null): Change => (now) => {
  const at = was ? now.prompts.findIndex((q) => q === was.text && (now.safety?.[q] ?? '') === was.stock) : 'new';
  if (at === -1) return { problem: moved('prompt') };
  if (!to) return at === 'new' ? now : removePrompt(now, at);
  const taken = packTexts({ ...now, prompts: now.prompts.filter((_, i) => i !== at) }).some((q) => promptKey(q) === promptKey(to.text));
  return taken ? { problem: 'That prompt is already in this pack.' } : setPrompt(now, at, to.text, to.stock);
};
