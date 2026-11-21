// Party phrases: what a friend types is normalised and split into guesses, each compared with
// each phrase in the PARTY_PHRASES secret through HMAC digests, never as text.
import { hmac, sameBytes, toBase64url, type Keys } from './crypto';
import { LIMITS } from './limits';

/** The longest phrase anyone may type; longer input is refused before any work. */
export const MAX_PHRASE_LENGTH = 200;

/**
 * Lowercase; apostrophes dropped ("don't" is "dont"); other punctuation and symbols split words
 * ("red,blue" is "red blue"); runs of spaces made one, ends trimmed.
 */
export function normalisePhrase(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/['\u2019]/g, '')
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The guesses in what a friend typed: the whole normalised phrase first when it has two or more
 * words (so a stored phrase of several words still matches), then each distinct word in order;
 * at most `LIMITS.guessesPerSubmission`, the rest ignored. "I aM noT!!!?? drunk." gives
 * "i am not drunk", "i", "am", "not", "drunk". Nothing to check gives none.
 */
export function guessesFrom(typed: string): string[] {
  const whole = normalisePhrase(typed);
  const words = whole ? whole.split(' ') : [];
  const out = new Set<string>(words.length > 1 ? [whole] : []);
  for (const w of words) out.add(w);
  return [...out].slice(0, LIMITS.guessesPerSubmission);
}

/**
 * The accepted phrases from the secret: one per line, or separated by commas or semicolons (a
 * dashboard box may be one line; punctuation is never part of a phrase), normalised, blanks and
 * repeats dropped.
 */
export function parsePhrases(secret: string | undefined): string[] {
  const out = new Set<string>();
  for (const line of (secret ?? '').split(/\r?\n|[,;]/)) {
    const p = normalisePhrase(line);
    if (p) out.add(p);
  }
  return [...out];
}

/** A short id for a normalised phrase: stored in sessions, so removing the phrase ends them. */
export async function phraseId(keys: Keys, normalised: string): Promise<string> {
  return toBase64url((await hmac(keys.phrase, normalised)).slice(0, 12));
}

/** The ids of every phrase currently accepted. */
export async function currentPhraseIds(keys: Keys, secret: string | undefined): Promise<Set<string>> {
  return new Set(await Promise.all(parsePhrases(secret).map((p) => phraseId(keys, p))));
}

/**
 * The id of the accepted phrase that one of `guesses` (normalised, from `guessesFrom`) matches,
 * else null; when several match, the earliest guess wins. Every guess is compared with every
 * accepted phrase in full, with no early exit, so the time taken does not hint at which is close.
 */
export async function matchGuesses(keys: Keys, guesses: string[], secret: string | undefined): Promise<string | null> {
  const digests = await Promise.all(guesses.filter((g) => g).map((g) => hmac(keys.phrase, g)));
  const hits: (string | null)[] = digests.map(() => null);
  for (const phrase of parsePhrases(secret)) {
    const candidate = await hmac(keys.phrase, phrase);
    digests.forEach((d, i) => {
      if (sameBytes(d, candidate)) hits[i] = toBase64url(candidate.slice(0, 12));
    });
  }
  return hits.find((h) => h !== null) ?? null;
}
