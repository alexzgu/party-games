// A pack's icon: one character as a person sees it (a grapheme cluster), so a flag, an emoji with
// a skin tone or a joined emoji like 👩‍🚀 counts as one, as does a letter with its accent.
// Pure, with no imports: the wizard server checks library icons with it too.

/** The icon a pack shows when it has none. */
export const DEFAULT_ICON = '🃏';
/** The longest icon kept, in UTF-16 code units (the longest real emoji sequences are about 15). */
export const ICON_MAX = 32;

/** The first character of `text` (spaces around it ignored), or '' when there is none or it is absurdly long. */
export function oneIcon(text: string): string {
  const t = text.trim();
  if (!t) return '';
  const first = typeof Intl.Segmenter === 'function'
    ? (new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(t)[Symbol.iterator]().next().value?.segment ?? '')
    : (Array.from(t)[0] ?? ''); // no Segmenter: one code point, never more than one character
  return first.length <= ICON_MAX ? first : '';
}

/**
 * The icon after typing in a box that held `prev`: what was typed or pasted after it replaces it
 * (cut to its first character), so a phone keyboard never has to delete first; anything else
 * typed is cut to its first character.
 */
export function nextIcon(prev: string, typed: string): string {
  const added = prev && typed.startsWith(prev) && typed.length > prev.length ? typed.slice(prev.length) : typed;
  return oneIcon(added) || oneIcon(typed);
}

/** True when `x` is exactly one icon, with nothing else around it. */
export const isIcon = (x: unknown): x is string => typeof x === 'string' && x.length <= ICON_MAX && x !== '' && oneIcon(x) === x;
