// Would You Rather's question pool for one game: the picked packs' questions, shuffled, then every
// other pack's, shuffled, so a small pack of the player's own never runs out mid-game.
import type { RatherPack } from '../../lib/content';
import { shuffle } from '../../lib/random';
import { ratherKey } from './rules';

/** The questions in the order the game asks them, none twice (the same choices in either order are one question). */
export function roomQuestions(packs: readonly RatherPack[], ids: readonly string[], rand: () => number = Math.random): string[] {
  const picked = packs.filter((p) => ids.includes(p.id));
  const rest = packs.filter((p) => !ids.includes(p.id));
  const seen = new Set<string>();
  return [...shuffle(picked.flatMap((p) => p.prompts), rand), ...shuffle(rest.flatMap((p) => p.prompts), rand)]
    .filter((q) => !seen.has(ratherKey(q)) && !!seen.add(ratherKey(q)));
}
