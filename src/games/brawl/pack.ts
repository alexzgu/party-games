// Doodle Brawl's title pool for one game: the picked packs' titles, shuffled, then every other
// pack's, shuffled, so a small pack of the player's own never runs out mid-game.
import type { BrawlPack } from '../../lib/content';
import { titleKey } from './rules';

/** The titles in the order the game deals them, none twice (ignoring case, spacing and punctuation). */
export function dealTitles(packs: readonly BrawlPack[], ids: readonly string[], shuffle: <T>(xs: T[]) => T[]): string[] {
  const picked = packs.filter((p) => ids.includes(p.id));
  const rest = packs.filter((p) => !ids.includes(p.id));
  const seen = new Set<string>();
  return [...shuffle(picked.flatMap((p) => p.titles)), ...shuffle(rest.flatMap((p) => p.titles))]
    .filter((t) => !seen.has(titleKey(t)) && !!seen.add(titleKey(t)));
}
