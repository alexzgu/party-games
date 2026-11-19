// Deals prompts from the chosen packs. Each pack keeps its own "already seen" history, so
// switching pack combinations never resets what a group has already played.
import { makeBag } from '../../lib/bag';
import { quickPacks } from '../../lib/content';
import { promptKey } from './logic';

/** How many draws to spend looking for a prompt not yet dealt this game before giving up. */
const MAX_TRIES = 25;

export function makeDealer(packIds: string[]) {
  const packs = quickPacks().filter((p) => packIds.includes(p.id) && p.prompts.length > 0);
  const bags = packs.map((p) => ({ size: p.prompts.length, bag: makeBag('quick:' + p.id, p.prompts, promptKey) }));

  /** One prompt, from a pack chosen in proportion to its unseen prompts (its size once all are seen). */
  function draw(): string | undefined {
    const fresh = bags.filter((b) => b.bag.remaining > 0);
    const pool = fresh.length ? fresh.map((b) => ({ b, w: b.bag.remaining })) : bags.map((b) => ({ b, w: b.size }));
    let r = Math.random() * pool.reduce((n, p) => n + p.w, 0);
    const pick = pool.find((p) => (r -= p.w) < 0) ?? pool[pool.length - 1];
    return pick?.b.bag.next();
  }

  return {
    /** A prompt not in `dealt` (prompts already played this game), when one is left. */
    next(dealt: readonly string[] = []): string | undefined {
      const used = new Set(dealt);
      let prompt: string | undefined;
      for (let i = 0; i < MAX_TRIES; i++) {
        prompt = draw();
        if (!prompt || !used.has(promptKey(prompt))) return prompt;
      }
      return prompt;
    },
  };
}

/** Names of the chosen packs, in pack order, for a history entry. */
export function packNames(packIds: string[]): string[] {
  return quickPacks().filter((p) => packIds.includes(p.id)).map((p) => p.name);
}
