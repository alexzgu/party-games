// Would You Rather's questions for a room or the one-phone mode: only the picked packs', read as
// they are now, shuffled, one per question (the same choices in either order are one question).
import type { RatherPack } from '../../lib/content';
import { shuffle } from '../../lib/random';
import { ratherKey } from './rules';
import { DEFAULT_SETTINGS } from './state';

/** The picked packs that exist; when none of them does, the default picks (Classic), never every pack. */
export function pickedPacks(packs: readonly RatherPack[], ids: readonly string[]): RatherPack[] {
  const some = packs.filter((p) => ids.includes(p.id));
  return some.length ? some : packs.filter((p) => DEFAULT_SETTINGS.packs.includes(p.id));
}

/** The picked packs' questions, shuffled, none twice. */
export function roomQuestions(packs: readonly RatherPack[], ids: readonly string[], rand: () => number = Math.random): string[] {
  const seen = new Set<string>();
  return shuffle(pickedPacks(packs, ids).flatMap((p) => p.prompts), rand)
    .filter((q) => !seen.has(ratherKey(q)) && !!seen.add(ratherKey(q)));
}
