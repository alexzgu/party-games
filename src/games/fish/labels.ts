import { rankPlural, rankWord } from '../../lib/cards/deck';
import type { Event } from './state';
import type { View } from './view';

/** A player's name in a view. */
export const nameIn = (v: View) => (pid: string) => v.players.find((p) => p.pid === pid)?.name ?? 'A player who left';

const article = (word: string) => (/^[aeiou]/.test(word) ? 'an' : 'a');

/** An event as the table says it: "Maya asked Sam for sevens. Sam gave 2." */
export function said(e: Event, name: (pid: string) => string): string {
  const by = name(e.by);
  switch (e.k) {
    case 'asked': return `${by} asked ${name(e.from)} for ${rankPlural(e.rank)}. ${e.got ? `${name(e.from)} gave ${e.got}.` : 'Go fish!'}`;
    case 'drew':
      if (e.rank) return `${by} fished ${article(rankWord(e.rank))} ${rankWord(e.rank)}!`;
      return e.why === 'empty' ? `${by} had no cards and drew one.` : e.why === 'nobody' ? `Nobody else has cards: ${by} drew one.` : `${by} drew a card.`;
    case 'dry': return 'The pool is empty.';
    case 'book': return `${by} laid down the ${rankPlural(e.rank)}.`;
    case 'skip': return `${by} has no cards and the pool is empty: skipped.`;
    case 'gone': return `${by} is out. Their cards went back into the pool.`;
  }
}

/** Where a player stands, in words (never colour alone). */
export function seatStatus(v: View, pid: string, online?: ReadonlySet<string>): string {
  const s = v.players.find((p) => p.pid === pid);
  if (s?.out) return 'Out';
  if (s?.watching) return 'Next deal';
  if (online && !online.has(pid)) return 'Away';
  if (v.phase === 'turn' && v.turn === pid) return 'Asking';
  return '';
}

/** After an outcome: who plays next, as the game will really decide it; nothing when the game ends. */
export function nextLine(v: View, name: (pid: string) => string): string {
  if (v.phase !== 'show' || !v.next) return '';
  return v.next === v.turn ? `${name(v.next)} goes again.` : `Next: ${name(v.next)}.`;
}
