// Deals a round's prompts and finals from what the game deals from (room.ts `pools`): the picks'
// first, then the lenders', none this game already dealt while any is left. Each pool keeps its own
// bag (lib/bag), so nothing repeats across games either until its pool runs out.
import { makeBag } from '../../lib/bag';
import { LAST_PROMPT, type Dealt } from './logic';
import { promptKey } from './pack';
import { dealIn, finalsIn, promptsOf, type Pools } from './room';

/**
 * `count` prompts, each with its pack's stock answer when it has one. When the packs have none
 * left at all, the game's own prompts already dealt (`dealt`, oldest first) come round again, and
 * only a game with none of those gets `LAST_PROMPT`. Never fewer than `count`, never an empty one.
 */
export function drawPrompts(from: Pools, count: number, dealt: readonly string[]): Dealt[] {
  const picks = promptsOf(from.picks), mine = new Set(picks.map(promptKey));
  const lent = promptsOf(from.prompts).filter((q) => !mine.has(promptKey(q)));
  const safety = new Map(from.prompts.flatMap((p) => Object.entries(p.safety ?? {})));
  const keys = ['snark', 'snark:lent'];
  const got = dealIn([picks, lent], count, (q) => q, new Set(dealt), (i) => makeBag(keys[i], i ? lent : picks, (x) => x));
  const again = dealt.length ? dealt : [LAST_PROMPT];
  const all = [...got, ...Array.from({ length: count - got.length }, (_, i) => again[i % again.length])];
  return all.map((prompt) => {
    const stock = safety.get(prompt);
    return stock ? { prompt, safety: stock } : prompt;
  });
}

/**
 * Finals for three-line duels, dealt like prompts; none when the packs have none, and then the
 * final is the one prompt for everyone (logic.ts `lineDuels`).
 */
export function drawFinals(from: Pools, count: number, dealt: readonly string[]): Dealt[] {
  const picks = finalsIn(from.picks), mine = new Set(picks.map((f) => f.prompt));
  const lent = finalsIn(from.finals).filter((f) => !mine.has(f.prompt));
  const keys = ['snark:finals', 'snark:finals:lent'];
  return dealIn([picks, lent], count, (f) => f.prompt, new Set(dealt), (i) => makeBag(keys[i], i ? lent : picks, (f) => f.prompt));
}
