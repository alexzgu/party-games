// What the host screen and each phone are sent. A phone gets its own hand and nobody else's; the
// table is public: every player's card count and books, the pool's count (never its order), whose
// turn it is and the recent events, as at a real table.
import type { Card, Rank } from '../../lib/cards/deck';
import * as L from './logic';

/** A player at the table: how many cards they hold and the books they laid down. */
export type Seat = {
  pid: string; name: string; cards: number; books: Rank[];
  /** Dealt in, then removed or gone: their books stay down under their name. */
  out?: true;
  /** Joined after the deal: dealt in at the next one. */
  watching?: true;
};

export type View = {
  phase: L.Phase; at: number; left: number | null; total: number; paused: boolean;
  /** Lobby: the room; play: the table in seat order, then whoever watches; over: the standings. */
  players: Seat[];
  pool: number;
  /** Whose turn it is (turn), or who asked (show). */
  turn?: string;
  /** Show: who plays next. */
  next?: string;
  /** Show: the outcome of the ask in play. */
  shown?: L.Event[];
  /** The last few events, oldest first. */
  log: L.Event[];
  // This phone only:
  hand?: Card[];
  /** Show: the card this phone's player just drew. */
  drew?: Card;
};

function seat(g: L.Game, p: L.Player): Seat {
  const s: Seat = { pid: p.pid, name: p.name, cards: L.hand(g, p.pid).length, books: g.books[p.pid] ?? [] };
  if (!L.isActive(g, p.pid)) s.out = true;
  else if (g.phase !== 'lobby' && !g.seats.includes(p.pid)) s.watching = true;
  return s;
}

function table(g: L.Game): L.Player[] {
  if (g.phase === 'lobby') return L.active(g);
  if (g.phase === 'over') return L.standings(g);
  const dealt = g.seats.map((pid) => g.players.find((p) => p.pid === pid)!);
  return [...dealt, ...L.active(g).filter((p) => !g.seats.includes(p.pid))];
}

function own(g: L.Game, pid: string): Partial<View> {
  if (!L.isActive(g, pid) || !g.seats.includes(pid) || g.phase === 'lobby') return {};
  const v: Partial<View> = { hand: L.hand(g, pid) };
  if (g.phase === 'show' && g.turn === pid && g.drew !== null) v.drew = g.drew;
  return v;
}

export function view(g: L.Game, now: number, pid?: string): View {
  const v: View = {
    phase: g.phase, at: g.at, left: L.left(g, now), paused: g.paused !== null,
    total: g.phase === 'turn' ? g.settings.seconds * 1000 : g.phase === 'show' ? L.SHOW_MS : 0,
    players: table(g).map((p) => seat(g, p)), pool: g.pool.length, log: g.log,
  };
  if (g.turn && (g.phase === 'turn' || g.phase === 'show')) v.turn = g.turn;
  if (g.phase === 'show') Object.assign(v, { shown: g.shown, ...(g.next ? { next: g.next } : {}) });
  return pid ? { ...v, ...own(g, pid) } : v;
}
