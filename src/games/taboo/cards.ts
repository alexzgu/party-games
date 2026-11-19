// What makes a Don't Say It card valid, shared by the content gate, the pack editor and pasting:
// a word of 1–3 words and exactly five different banned words of 1–3 words, none of which
// contains the word or sits inside it ("Pizza" cannot ban "Pizzas" or "Pizza slice").
import type { TabooCard } from '../../lib/content';
import { pastedLines, tableCells } from '../../lib/paste';

export const BANNED_COUNT = 5;
export const MAX_WORDS = 3;

/** Lower case, spaces collapsed: how two words are compared. */
export const key = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ');
export const clean = (s: string): string => s.trim().replace(/\s+/g, ' ');
const wordCount = (s: string): number => clean(s).split(' ').filter(Boolean).length;

export const cardId = (c: TabooCard): string => key(c.word);

/** Every reason this card cannot be used, in plain words; empty when it is fine. */
export function cardProblems(c: TabooCard): string[] {
  const problems: string[] = [];
  const word = key(c.word ?? '');
  if (!word) problems.push('The word is empty.');
  else if (wordCount(word) > MAX_WORDS) problems.push(`"${clean(c.word)}" is over ${MAX_WORDS} words.`);
  const banned = Array.isArray(c.banned) ? c.banned : [];
  if (banned.length !== BANNED_COUNT) problems.push(`Needs exactly ${BANNED_COUNT} banned words (has ${banned.length}).`);
  const seen = new Set<string>();
  for (const b of banned) {
    const k = key(b ?? '');
    if (!k) { problems.push('A banned word is empty.'); continue; }
    if (wordCount(k) > MAX_WORDS) problems.push(`Banned "${clean(b)}" is over ${MAX_WORDS} words.`);
    if (word && (k.includes(word) || word.includes(k))) problems.push(`Banned "${clean(b)}" overlaps the word itself.`);
    if (seen.has(k)) problems.push(`Banned "${clean(b)}" is there twice.`);
    seen.add(k);
  }
  return problems;
}

/** A card with every field trimmed. */
export const tidy = (c: TabooCard): TabooCard => ({ word: clean(c.word), banned: c.banned.map(clean) });

/**
 * Cards from a pasted list, one per line: `Word: one, two, three, four, five` (a dash or
 * colon after the word), or a table row `| Word | one | two | three | four | five |`.
 * Lines that do not make a valid card come back in `bad`, with the reason.
 */
export function parseCards(text: string): { cards: TabooCard[]; bad: { line: string; why: string }[] } {
  const cards: TabooCard[] = [];
  const bad: { line: string; why: string }[] = [];
  for (const line of pastedLines(text)) {
    const plain = line.replace(/^(?:[-*•]|\d+[.)])\s+/, '').replace(/\*\*/g, '');
    let parts: string[];
    if (plain.includes('|')) parts = tableCells(plain);
    else {
      const m = plain.match(/^(.+?)\s*(?::|\s[-–—]\s)\s*(.+)$/);
      parts = m ? [m[1], ...m[2].split(',')] : [plain];
    }
    const card = tidy({ word: parts[0] ?? '', banned: parts.slice(1).filter((p) => p.trim()) });
    const problems = cardProblems(card);
    if (problems.length) bad.push({ line, why: problems[0] });
    else cards.push(card);
  }
  return { cards, bad };
}
