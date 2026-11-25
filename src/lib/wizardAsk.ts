// What a player asks Fizzwick for, in every game: a request in their own words (never a title),
// carried whole into the prompt, and the short name he suggests for the pack in the same reply,
// on a marked first line ("Name: …") that is lifted out of the stream and never shown as an item.
// When he sends no name, or a bad one, the pack is named from the request's first few words.

/** The most characters a request may have. */
export const REQUEST_MAX = 300;
/** The most characters a pack's name may have (every pack editor's limit). */
export const NAME_MAX = 40;
/** The most words a suggested name may have. */
export const NAME_WORDS = 4;
/** The most characters a wizard pack's description may have (the board editor's limit). */
export const BLURB_MAX = 80;
const BLURB_START = 'Conjured by Fizzwick';

/** A request as sent: trimmed, at most `REQUEST_MAX` characters. */
export const cleanRequest = (request: string): string => request.trim().slice(0, REQUEST_MAX).trim();

/** The prompt's opening line: the whole request, or `fallback` when there is none. */
export const askedFor = (request: string, fallback: string): string => `The player asks for: ${cleanRequest(request) || fallback}`;

/**
 * What the prompt adds when a name is wanted: one marked first line, said to be the only exception
 * to the game's output rules ("Output only the cards…"), so the model never sees two rules at odds.
 */
export const NAME_ASK = `Start your reply with one line: "Name: " and a short name for this pack, 1 to ${NAME_WORDS} words in Title Case. That first line is the only exception to the output rules above; after it, write everything else exactly as described.`;

/** The prompt's parts with the name ask after them, when `wanted`. */
export const withNameAsk = (parts: string[], wanted: boolean): string[] => (wanted ? [...parts, NAME_ASK] : parts);

/** "Name: …" or "Pack name: …", with a colon only: "Name-Brand Snacks" or "Name-Dropping" is never one. */
const NAME_LINE = /^\s*(?:[-*•#>]+\s*)?(?:pack\s+)?name\s*[:：]\s*(.*)$/i;

/** The text after a "Name:" marker (markdown and list markers ignored), or null when the line is not one. */
export function nameIn(line: string): string | null {
  const m = NAME_LINE.exec(line.replace(/\*\*|__|`/g, ''));
  return m ? m[1].trim() : null;
}

/**
 * Wraps a stream's line handler: only the reply's first line can be the name, and only when it is
 * a "Name:" line carrying a good name (`cleanName`), which goes to `onName` and is never an item.
 * Anything else, that first line included, goes to `onLine` untouched, whatever it looks like, so
 * a real item ("Name-Brand Snacks | 1 | …", a card for the word "Name") is never swallowed.
 */
export function liftName(onLine: (line: string) => void, onName: (name: string) => void): (line: string) => void {
  let first = true;
  return (line) => {
    if (first) {
      first = false;
      const raw = nameIn(line);
      const name = raw === null ? null : cleanName(raw);
      if (name) return onName(name);
    }
    onLine(line);
  };
}

const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'or', 'the', 'to', 'with']);

/** Title Case: each word's first letter capital, small words lower inside; capitals already there stay. */
export function titled(s: string): string {
  const words = s.split(' ').filter(Boolean);
  return words.map((w, i) => (i > 0 && i < words.length - 1 && SMALL.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
}

const squeeze = (s: string) => s.replace(/\s+/g, ' ').trim();

/** A name Fizzwick suggested, tidied, or null when it breaks the rules (empty, over 4 words or 40 characters, no letter, a list's commas or bars). */
export function cleanName(raw: string): string | null {
  const t = squeeze(raw.replace(/\*\*|__|`/g, '')).replace(/^["“'‘]+|["”'’]+$/g, '').replace(/[.!?,;:…]+$/, '').trim();
  const n = titled(t);
  const words = n.split(' ').filter(Boolean).length;
  if (!n || words > NAME_WORDS || n.length > NAME_MAX || !/\p{L}/u.test(n) || /[,|]/.test(n)) return null;
  return n;
}

/** The start of `text` up to `max` characters, cut at a word's end. */
function wholeWords(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  const at = cut.lastIndexOf(' ');
  return (at > 0 ? cut.slice(0, at) : text.slice(0, max)).trim();
}

/** Openings that say nothing about the pack ("Make me a pack about", "I want", "Cards about"). */
const NOUN = '(?:pack|deck|board|list|set|bunch|word|card|prompt|question|title|scale|clue|phrase|drawing|item)s?';
const VERB = String.raw`(?:(?:please|pls)\s+)?(?:(?:can|could)\s+you\s+)?(?:(?:i|we)(?:'d|\s+would)?\s+(?:want|like|need|love)|make|give|write|create|generate)`;
const OPENINGS = [
  new RegExp(String.raw`^${VERB}(?:\s+(?:me|us))?(?:\s+(?:a|an|some))?(?:\s+new)?(?:\s+${NOUN})?(?:\s+(?:of|about|on|with|for))?\s+`, 'i'),
  new RegExp(String.raw`^(?:(?:a|an|some)\s+)?(?:new\s+)?${NOUN}\s+(?:of|about|on|with|for)\s+`, 'i'),
];
/** Words that start a clause narrowing the request ("…you'd find in a bakery", "…for game night"). */
const NARROWING = new Set(['you', "you'd", "you're", 'your', 'that', 'which', 'who', 'where', 'when', 'we', 'i', 'for', 'from', 'like', 'but', 'so', 'please', 'e.g', 'eg', 'with']);
/** Words a name never ends on. */
const DANGLING = /\s+(?:a|an|and|as|at|but|by|for|from|in|into|of|on|or|the|to|with|you|your|that|which|who|is|are|e\.g)$/i;

/**
 * A short name made from the request's first few words, for when Fizzwick suggests none: its
 * first clause, an empty opening dropped, at most 4 words and 40 characters, Title Case.
 */
export function nameFrom(request: string, empty: string): string {
  const first = squeeze(request.split(/[\n,.;:!?()—–]|\s-\s/)[0] ?? '');
  const body = (OPENINGS.reduce((s, re) => s.replace(re, ''), first).trim() || first).split(' ');
  // "French pastries you'd find in…" is named "French Pastries": a clause that only narrows it is left out.
  const cut = body.findIndex((w, i) => i >= 2 && NARROWING.has(w.toLowerCase().replace(/[’]/g, "'")));
  let words = wholeWords(body.slice(0, cut < 0 ? NAME_WORDS : Math.min(cut, NAME_WORDS)).join(' '), NAME_MAX).replace(/["“”]/g, '');
  while (DANGLING.test(words)) words = words.replace(DANGLING, '');
  return titled(words.trim()) || empty;
}

/** A wizard pack's description: "Conjured by Fizzwick: " and as much of the request as fits, cut at a word. */
export function wizardBlurb(request: string): string {
  const text = squeeze(cleanRequest(request));
  if (!text) return BLURB_START;
  const room = BLURB_MAX - BLURB_START.length - 2;
  if (text.length <= room) return `${BLURB_START}: ${text}`;
  return `${BLURB_START}: ${wholeWords(text, room - 1).replace(/[\s,;:.!?—–-]+$/, '')}…`;
}
