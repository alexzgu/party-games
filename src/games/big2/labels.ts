// Plays, events and the phone's selection in words.
import { cardName, rankOf, rankPlural, rankWord, suitOf, type Card } from '../../lib/cards/deck';
import { classify, type Kind } from './combos';
import { fault, type Need } from './moves';
import { sortBig2 } from './order';
import type { Event } from './state';
import type { View } from './view';

/** A player's name in a view. */
export const nameIn = (v: View) => (pid: string) => v.players.find((p) => p.pid === pid)?.name ?? 'A player who left';

/** The rank most cards share (a full house's triple, four of a kind's four). */
function main(cards: readonly Card[]): number {
  const n = (r: number) => cards.filter((c) => rankOf(c) === r).length;
  return [...cards].map(rankOf).sort((a, b) => n(b) - n(a))[0];
}

/** A play as a sentence's object: "the 7 of hearts", "a pair of kings", "a straight to the ace". */
export function playName(kind: Kind, list: readonly Card[]): string {
  const cards = sortBig2(list);
  const top = cards[cards.length - 1];
  switch (kind) {
    case 'single': return `the ${cardName(top)}`;
    case 'pair': return `a pair of ${rankPlural(rankOf(top))}`;
    case 'triple': return `three ${rankPlural(rankOf(top))}`;
    case 'straight': return `a straight to the ${rankWord(rankOf(top))}`;
    case 'flush': return `a flush in ${suitOf(top)}`;
    case 'full': return `a full house of ${rankPlural(main(cards))}`;
    case 'four': return `four ${rankPlural(main(cards))}`;
    case 'sflush': return `a straight flush to the ${rankWord(rankOf(top))}`;
  }
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** A play as a heading: "7 of hearts", "Pair of kings". */
export const playTitle = (kind: Kind, cards: readonly Card[]) => capital(playName(kind, cards).replace(/^(the|a) /, ''));

const SIZE: Record<number, string> = { 1: 'a single card', 2: 'a pair', 3: 'three of a kind', 5: 'five cards' };

/** What the phone's selection is, or why it cannot be played: "Pair of kings", "Not a hand", "Doesn't beat it". */
export function selectionLine(selection: readonly Card[], need: Need): string {
  const why = fault(selection, need);
  const combo = classify(selection);
  if (why === 'empty') return need.table ? `Tap cards to beat it, or Pass` : 'Tap cards to lead';
  if (why === 'not a hand' || !combo) return 'Not a hand';
  if (why === 'needs first') return `Must include the ${cardName(need.first!)}`;
  if (why === 'wrong size') return `Needs ${SIZE[need.table!.cards.length]}`;
  const title = playTitle(combo.kind, combo.cards);
  return why === 'too low' ? `${title}: doesn't beat it` : title;
}

/** An event as the table says it: "Maya played a pair of kings.", "Sam passed.", "Maya leads." */
export function said(e: Event, name: (pid: string) => string): string {
  switch (e.k) {
    case 'play': return `${name(e.by)} played ${playName(classify(e.cards)!.kind, e.cards)}.`;
    case 'pass': return `${name(e.by)} passed.`;
    case 'lead': return `${name(e.by)} leads.`;
    case 'done': return `${name(e.by)} is out of cards!`;
    case 'gone': return `${name(e.by)} is out. Their cards were set aside.`;
    case 'deal': return `Deal ${e.deal}.`;
  }
}

/** Where a player stands, in words (never colour alone). */
export function seatStatus(v: View, pid: string, online?: ReadonlySet<string>): string {
  const s = v.players.find((p) => p.pid === pid);
  if (s?.out) return 'Out';
  if (s?.watching) return s.watching === 'deal' ? 'Next deal' : 'Next game';
  if (online && !online.has(pid)) return 'Away';
  if (v.phase === 'turn' && v.turn === pid) return v.table ? 'Playing' : 'Leading';
  if (s?.passed) return 'Passed';
  return '';
}
