// A game of Big 2: deals of 13 cards each; the player holding the lowest card dealt leads the
// first trick with it; play goes round in seat order, each play the same number of cards as the
// lead and beating the play on the table, or a pass that sits the player out until the trick ends
// (*house*). When everyone else has passed, the last to play leads anything. A deal ends when one
// player has no cards; the others score penalty points for the cards they hold. Lowest total wins.
import { deal, shuffledDeck, type Card } from '../../lib/cards/deck';
import { active, isActive } from '../../lib/room/seating';
import { classify } from './combos';
import { fault, lowestSingle, type Need } from './moves';
import { lowest } from './order';
import {
  HAND_SIZE, RESULT_MS, enter, hand, newGame, note, playing, total,
  type Game, type NewEvent, type Result, type Settings,
} from './state';

type Rand = () => number;

/** Penalty points for the cards left at the end of a deal: one each, doubled with 10 or more, tripled with all 13 (*house*). */
export const points = (cards: number): number => cards * (cards >= HAND_SIZE ? 3 : cards >= 10 ? 2 : 1);

/** What the play on turn must meet. */
export const need = (g: Game): Need => ({ table: g.table?.combo ?? null, first: g.first });

const inGame = (g: Game) => g.roster.filter((pid) => isActive(g, pid));

/** The players after `pid` in seat order who are still in the deal, `pid` itself last. */
function around(g: Game, pid: string): string[] {
  const i = g.roster.indexOf(pid);
  const n = g.roster.length;
  return Array.from({ length: n }, (_, k) => g.roster[(i + k + 1) % n]).filter((p) => playing(g, p));
}

function turnOf(g: Game, pid: string, now: number, events: NewEvent[]): Game {
  const s = g.settings.seconds;
  return enter({ ...note(g, events), turn: pid }, 'turn', now, s ? s * 1000 : undefined);
}

/** A new trick: the table is cleared and `pid` leads anything. */
const lead = (g: Game, pid: string, now: number, events: NewEvent[]): Game =>
  turnOf({ ...g, table: null, passed: [] }, pid, now, [...events, { k: 'lead', by: pid }]);

/** After `pid` played or passed: the next player still in the trick, or the last to play leads a new one. */
function advance(g: Game, pid: string, now: number, events: NewEvent[]): Game {
  for (const p of around(g, pid)) {
    if (g.table && p === g.table.by) return lead(g, p, now, events);
    if (!g.passed.includes(p)) return turnOf(g, p, now, events);
  }
  return lead(g, around(g, pid)[0], now, events);
}

const finish = (g: Game, now: number, events: NewEvent[] = []): Game => enter({ ...note(g, events), turn: null }, 'over', now);

/** The deal is over (`out` has no cards; null: too few were left to play on): points, then the next deal or the end. */
function score(g: Game, out: string | null, now: number, events: NewEvent[]): Game {
  const dealt = g.roster.filter((p) => g.seats.includes(p) || p in g.gone);
  const rows = dealt.map((pid) => {
    const cards = g.seats.includes(pid) ? hand(g, pid).length : g.gone[pid];
    return { pid, cards, points: points(cards) };
  });
  const totals = { ...g.totals };
  for (const r of rows) totals[r.pid] = total(g, r.pid) + r.points;
  const result: Result = { out: out ?? '', rows };
  const next = { ...g, totals, result, table: null, passed: [], scored: g.scored + 1 };
  if (g.deal >= g.settings.deals || inGame(g).length < 2) return finish(next, now, events);
  return enter({ ...note(next, events), turn: null }, 'result', now, RESULT_MS);
}

/**
 * Deals 13 cards each to the game's players still in it, the rest set aside unseen. `leader`, the
 * last deal's winner, leads with anything; without one, whoever holds the lowest card dealt leads
 * and their first play must hold it.
 */
function dealOut(g: Game, now: number, rand: Rand, leader: string | null): Game {
  const seats = inGame(g);
  if (seats.length < 2) return finish(g, now);
  const dealt = deal(shuffledDeck(rand), seats.length, HAND_SIZE);
  const hands = Object.fromEntries(seats.map((p, i) => [p, dealt.hands[i]]));
  const low = lowest(dealt.hands.flat());
  const holder = seats[dealt.hands.findIndex((h) => h.includes(low))];
  const winner = leader && seats.includes(leader) ? leader : null;
  const next: Game = { ...g, seats, hands, gone: {}, deal: g.deal + 1, table: null, passed: [], first: winner ? null : low };
  return lead(next, winner ?? holder, now, [{ k: 'deal', deal: next.deal }]);
}

/** Deals the first deal to everyone in the room; their seat order is the game's. */
export function start(g: Game, now: number, rand: Rand = Math.random): Game {
  const roster = active(g).map((p) => p.pid);
  const game: Game = { ...g, roster, totals: Object.fromEntries(roster.map((p) => [p, 0])), deal: 0, result: null, scored: 0, log: [], count: 0 };
  return dealOut(game, now, rand, null);
}

/** Whether it is `pid`'s turn to act now. */
const onTurn = (g: Game, pid: string, at: number) =>
  g.phase === 'turn' && g.paused === null && g.at === at && g.turn === pid && playing(g, pid);

/** A play from the phone of `pid` for the turn in play (`at`); anything not legal changes nothing. */
export function play(g: Game, pid: string, at: number, cards: readonly Card[], now: number): Game {
  if (!onTurn(g, pid, at)) return g;
  const held = hand(g, pid);
  if (new Set(cards).size !== cards.length || !cards.every((c) => held.includes(c)) || fault(cards, need(g))) return g;
  const rest = held.filter((c) => !cards.includes(c));
  const events: NewEvent[] = [{ k: 'play', by: pid, cards: [...classify(cards)!.cards] }];
  const next: Game = { ...g, hands: { ...g.hands, [pid]: rest }, table: { by: pid, combo: classify(cards)! }, first: null };
  if (!rest.length) return score(next, pid, now, [...events, { k: 'done', by: pid }]);
  return advance(next, pid, now, events);
}

/** A pass from the phone of `pid`; the player leading a trick cannot pass. */
export function pass(g: Game, pid: string, at: number, now: number): Game {
  if (!onTurn(g, pid, at) || !g.table) return g;
  return advance({ ...g, passed: [...g.passed, pid] }, pid, now, [{ k: 'pass', by: pid }]);
}

/** For the player on turn (the timer ran out, or the host moved on): a pass, or leading, their lowest legal single. */
export function anyMove(g: Game, now: number): Game {
  const pid = g.turn;
  if (g.phase !== 'turn' || !pid) return g;
  const free = { ...g, paused: null };
  if (g.table) return pass(free, pid, g.at, now);
  const card = lowestSingle(hand(g, pid), need(g));
  return card === null ? g : play(free, pid, g.at, [card], now);
}

/** The host's advance: play for the player on turn, or the next deal after a result. */
export function step(g: Game, now: number, rand: Rand = Math.random): Game {
  if (g.phase === 'turn') return anyMove(g, now);
  if (g.phase === 'result') return dealOut(g, now, rand, g.result?.out || null);
  return g;
}

/** Moves the game on by itself when the timer runs out (never while paused). */
export function tick(g: Game, now: number, rand: Rand = Math.random): Game {
  if (g.paused !== null || (g.phase !== 'turn' && g.phase !== 'result')) return g;
  return g.deadline !== null && g.deadline <= now ? step(g, now, rand) : g;
}

/**
 * A player out of the game (removed, or left): their cards are set aside (they score them if the
 * deal is scored) and they sit out the rest of the deal. Their turn passes on; a trick they made
 * the last play of goes to the next player still in it, to lead. Fewer than two players left in
 * the game ends it; fewer than two in the deal ends the deal.
 */
export function out(g: Game, pid: string, now: number): Game {
  if (g.phase !== 'turn' && g.phase !== 'result') return g;
  if (inGame(g).length < 2) return finish(g, now, g.seats.includes(pid) ? [{ k: 'gone', by: pid }] : []);
  if (g.phase !== 'turn' || !g.seats.includes(pid)) return g;
  const events: NewEvent[] = [{ k: 'gone', by: pid }];
  const next: Game = {
    ...g, seats: g.seats.filter((p) => p !== pid), hands: { ...g.hands, [pid]: [] },
    gone: { ...g.gone, [pid]: hand(g, pid).length }, first: g.turn === pid ? null : g.first,
  };
  if (next.seats.length < 2) return score(next, null, now, events);
  if (g.table?.by === pid) {
    const still = around(next, pid);
    return lead(next, still.find((p) => !g.passed.includes(p)) ?? still[0], now, events);
  }
  if (g.turn === pid) return g.table ? advance(next, pid, now, events) : lead(next, around(next, pid)[0], now, events);
  return { ...note(next, events) };
}

/** Lobby: the same room and players for a fresh game; the removed stay out, whoever left may join anew. */
export function rematch(g: Game, id: string, settings: Settings): Game {
  return { ...newGame(id, g.code, settings), at: g.at + 1, players: active(g), kicked: g.kicked.filter((x) => !g.left.includes(x)) };
}
