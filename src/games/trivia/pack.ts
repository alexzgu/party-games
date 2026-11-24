// Smarty Pants's questions for a room or Solo: only the picked packs', read as they are now,
// shuffled, none twice (the same question text is one question).
import type { TriviaPack } from '../../lib/content';
import { shuffle } from '../../lib/random';
import { triviaKey } from './rules';
import { DEFAULT_SETTINGS } from './state';

/** The picked packs that exist; when none of them does, the default picks (Classic), never every pack. */
export function pickedPacks(packs: readonly TriviaPack[], ids: readonly string[]): TriviaPack[] {
  const some = packs.filter((p) => ids.includes(p.id));
  return some.length ? some : packs.filter((p) => DEFAULT_SETTINGS.packs.includes(p.id));
}

/** The picked packs' question lines, shuffled, none twice. */
export function roomQuestions(packs: readonly TriviaPack[], ids: readonly string[], rand: () => number = Math.random): string[] {
  const seen = new Set<string>();
  return shuffle(pickedPacks(packs, ids).flatMap((p) => p.questions), rand)
    .filter((q) => !seen.has(triviaKey(q)) && !!seen.add(triviaKey(q)));
}
