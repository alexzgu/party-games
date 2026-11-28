// What the host screen and each phone are sent. A phone gets its own hand and nobody else's; the
// table is public: every player's card count, points and whether they passed, the play on the
// table face up, whose turn it is and the recent events. Nobody sees the set-aside cards.
import type { Card } from '../../lib/cards/deck';
import type { Kind } from './combos';
import { sortBig2 } from './order';
import * as L from './logic';

/** A player at the table. */
export type Seat = {
  pid: string; name: string; cards: number;
  /** Penalty points so far. */
  points: number;
  /** Out of the trick in play. */
  passed?: true;
  /** Dealt in, then removed or gone. */
  out?: true;
  /** In the room but not in this deal: dealt in at the next deal (came back) or the next game (joined late). */
  watching?: 'deal' | 'game';
};

export type View = {
  phase: L.Phase; at: number; left: number | null; total: number; paused: boolean;
  /** The deal in play and how many the game has. */
  deal: number; deals: number;
  /** How many deals have been scored. */
  scored: number;
  /** Lobby: the room; play: the table in seat order, then whoever watches; over: the standings. */
  players: Seat[];
  turn?: string;
  /** The play to beat and who made it (absent: the player on turn leads). */
  table?: { by: string; cards: Card[]; kind: Kind };
  /** The card the deal's first play must hold. */
  first?: Card;
  /** Result and over: the last deal. */
  result?: L.Result;
  /** The last few events, oldest first. */
  log: L.Event[];
  // This phone only:
  /** Its own hand, in Big 2 order (3 low, 2 high). */
  hand?: Card[];
};

function seat(g: L.Game, p: L.Player): Seat {
  const s: Seat = { pid: p.pid, name: p.name, cards: L.hand(g, p.pid).length, points: L.total(g, p.pid) };
  if (!L.isActive(g, p.pid)) s.out = true;
  else if (g.phase !== 'lobby' && !g.seats.includes(p.pid)) s.watching = g.roster.includes(p.pid) ? 'deal' : 'game';
  else if (g.phase === 'turn' && g.passed.includes(p.pid)) s.passed = true;
  return s;
}

function table(g: L.Game): L.Player[] {
  if (g.phase === 'lobby') return L.active(g);
  if (g.phase === 'over') return L.standings(g);
  const byPid = (pid: string) => g.players.find((p) => p.pid === pid)!;
  return [...g.roster.map(byPid), ...L.active(g).filter((p) => !g.roster.includes(p.pid))];
}

export function view(g: L.Game, now: number, pid?: string): View {
  const v: View = {
    phase: g.phase, at: g.at, left: L.left(g, now), paused: g.paused !== null,
    total: g.phase === 'turn' ? g.settings.seconds * 1000 : g.phase === 'result' ? L.RESULT_MS : 0,
    deal: g.deal, deals: g.settings.deals, scored: g.scored, players: table(g).map((p) => seat(g, p)), log: g.log,
  };
  if (g.phase === 'turn' && g.turn) v.turn = g.turn;
  if (g.phase === 'turn' && g.table) v.table = { by: g.table.by, cards: g.table.combo.cards, kind: g.table.combo.kind };
  if (g.phase === 'turn' && g.first !== null) v.first = g.first;
  if ((g.phase === 'result' || g.phase === 'over') && g.result) v.result = g.result;
  if (pid && g.phase === 'turn' && L.playing(g, pid)) v.hand = sortBig2(L.hand(g, pid));
  return v;
}
