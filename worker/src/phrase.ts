// Party phrases: what a friend types is normalised, then compared with each phrase in the
// PARTY_PHRASES secret through HMAC digests, never as text.
import { hmac, sameBytes, toBase64url, type Keys } from './crypto';

/** The longest phrase anyone may type; longer input is refused before any work. */
export const MAX_PHRASE_LENGTH = 200;

/** Lowercase, punctuation dropped, runs of spaces made one, ends trimmed. */
export function normalisePhrase(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
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
 * The phrase id when `typed` matches an accepted phrase, else null. Every accepted phrase is
 * compared in full, with no early exit, so the time taken does not hint at which one is close.
 */
export async function matchPhrase(keys: Keys, typed: string, secret: string | undefined): Promise<string | null> {
  const normalised = normalisePhrase(typed);
  const digest = await hmac(keys.phrase, normalised);
  let found: string | null = null;
  for (const phrase of parsePhrases(secret)) {
    const candidate = await hmac(keys.phrase, phrase);
    if (sameBytes(digest, candidate) && normalised) found = toBase64url(candidate.slice(0, 12));
  }
  return found;
}
