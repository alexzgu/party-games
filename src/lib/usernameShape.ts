// What a username may be, as pure functions: the phone tidies what is typed with these
// (username.ts), and the wizard server checks every username it is sent with them
// (worker/src/library.ts), so both keep exactly the same names. No imports, so the worker can share it.

/** Characters (UTF-16 units, as a text box's maxlength counts them) in a username, at most. */
export const USERNAME_MAX = 24;

/**
 * Invisible characters that could hide or disguise a name: control characters, the soft hyphen,
 * zero-width spaces and joiners-that-are-not-emoji, and direction overrides. The zero-width
 * joiner and non-joiner stay, so a joined emoji (👩‍🚀) or a Persian name is kept whole.
 */
const HIDDEN = /[\p{Cc}­؜᠎​‎‏‪-‮⁠-⁤⁦-⁯﻿]/gu;

/**
 * Characters that draw nothing even though they count as letters or symbols: every default-ignorable
 * one (joiners, selectors, Hangul fillers) and the blank Braille pattern. A name needs something else.
 */
const BLANK = /[\p{Default_Ignorable_Code_Point}\u2800]/gu;

/** Whether a reader can see something: a letter, digit, punctuation mark, symbol or emoji once blanks are set aside. */
const visible = (name: string): boolean => /[\p{L}\p{N}\p{P}\p{S}]/u.test(name.replace(BLANK, ''));

/** `text` cut to at most `max` UTF-16 units without splitting a character in two, end spaces trimmed. */
export function cutName(text: string, max: number): string {
  let out = '';
  for (const ch of text) {
    if (out.length + ch.length > max) break;
    out += ch;
  }
  return out.trim();
}

/** What was typed, tidied: invisible characters out, spaces collapsed and trimmed, cut to the limit. '' when nothing is left. */
export function normaliseUsername(typed: string): string {
  const name = cutName(typed.replace(HIDDEN, '').replace(/\s+/g, ' ').trim(), USERNAME_MAX);
  return visible(name) ? name : '';
}

/**
 * A username exactly as kept and sent: tidied the same way, and 1 to `USERNAME_MAX` characters
 * once tidied, with at least one visible character (never cut: anything longer is not a username). Anything else is null.
 */
export function cleanUsername(x: unknown): string | null {
  if (typeof x !== 'string' || x.length > USERNAME_MAX * 8) return null;
  const t = x.replace(HIDDEN, '').replace(/\s+/g, ' ').trim();
  return t.length >= 1 && t.length <= USERNAME_MAX && visible(t) ? t : null;
}
