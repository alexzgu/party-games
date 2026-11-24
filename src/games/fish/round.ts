// A game of Go Fish, as the common published rules play it: the player whose turn it is asks
// another for a rank they hold; all those cards move to the asker, who goes again, or "Go fish!":
// the asker draws from the pool and goes again only if it is the rank asked for (*house*: the
// other common variant gives the turn to the player asked), else the turn passes on in seat order.
// Four of a rank are laid down at once as a book. The game ends when all 13 books are down.
import { pick, shuffle } from '../../lib/random';
import { deal, isRank, rankOf, shuffledDeck, type Card, type Rank } from '../../lib/cards/deck';
import {
  SHOW_MS, active, allDown, enter, hand, holds, isActive, newGame, note, playing,
  type Game, type NewEvent, type Settings,
} from './state';

type Rand = () => number;

/** Cards each with this many players: 7 with 2 or 3, 5 with 4 to 6. */
export const handSize = (players: number) => (players <= 3 ? 7 : 5);

/** The next player after `pid` in seat order who is still in the game. */
export function after(g: Game, pid: string): string | null {
  const i = g.seats.indexOf(pid);
  for (let k = 1; k <= g.seats.length; k++) {
    const p = g.seats[(i + k + g.seats.length) % g.seats.length];
    if (isActive(g, p)) return p;
  }
  return null;
}

/** Players `pid` may ask: dealt in, still in the game, holding a card. */
export const askable = (g: Game, pid: string) => g.seats.filter((p) => p !== pid && playing(g, p) && hand(g, p).length > 0);

const inPlay = (g: Game) => g.seats.filter((p) => isActive(g, p));

/** The top card of the pool into `pid`'s hand. */
function take(g: Game, pid: string): { game: Game; card: Card } {
  const [card, ...pool] = g.pool;
  return { game: { ...g, pool, hands: { ...g.hands, [pid]: [...hand(g, pid), card] } }, card };
}

/** Lays down every rank `pid` holds all four of. */
function lay(g: Game, pid: string): { game: Game; events: NewEvent[] } {
  const ranks = [...new Set(hand(g, pid).map(rankOf))].filter((r) => hand(g, pid).filter((c) => rankOf(c) === r).length === 4).sort((a, b) => a - b);
  if (!ranks.length) return { game: g, events: [] };
  const rest = hand(g, pid).filter((c) => !ranks.includes(rankOf(c)));
  return {
    game: { ...g, hands: { ...g.hands, [pid]: rest }, books: { ...g.books, [pid]: [...(g.books[pid] ?? []), ...ranks] } },
    events: ranks.map((rank) => ({ k: 'book', by: pid, rank })),
  };
}

const finish = (g: Game, now: number): Game => enter({ ...g, turn: null, next: null, shown: [], drew: null }, 'over', now);

/**
 * Starts `pid`'s turn, or the first one after it that can play: an empty hand draws a card first
 * (with the pool empty that player is skipped), and a player nobody can be asked by draws one and
 * passes. The end once every book is down, fewer than two players are left, or nobody can play.
 */
export function begin(g: Game, pid: string | null, now: number, events: NewEvent[] = []): Game {
  let who = pid;
  let skips = 0;
  for (let guard = 0; who && guard < 200; guard++) {
    if (allDown(g) || inPlay(g).length < 2) break;
    if (!playing(g, who)) { who = after(g, who); continue; }
    if (!hand(g, who).length) {
      if (!g.pool.length) {
        events.push({ k: 'skip', by: who });
        if (++skips >= inPlay(g).length) break;
        who = after(g, who);
        continue;
      }
      g = take(g, who).game;
      events.push({ k: 'drew', by: who, why: 'empty' });
    }
    skips = 0;
    if (!askable(g, who).length) {
      if (g.pool.length) {
        g = take(g, who).game;
        events.push({ k: 'drew', by: who, why: 'nobody' });
        const laid = lay(g, who);
        g = laid.game;
        events.push(...laid.events);
      }
      who = after(g, who);
      continue;
    }
    const s = g.settings.seconds;
    const game = note(g, events).game;
    return enter({ ...game, turn: who, next: null, shown: [], drew: null }, 'turn', now, s ? s * 1000 : undefined);
  }
  return finish(note(g, events).game, now);
}

/** Deals a new game to everyone in the room (7 cards each with 2 or 3 players, else 5); books in a dealt hand go down at once; a random player starts. */
export function start(g: Game, now: number, rand: Rand = Math.random): Game {
  const seats = active(g).map((p) => p.pid);
  const dealt = deal(shuffledDeck(rand), seats.length, handSize(seats.length));
  let game: Game = {
    ...g, seats, pool: dealt.rest, hands: Object.fromEntries(seats.map((p, i) => [p, dealt.hands[i]])),
    books: Object.fromEntries(seats.map((p) => [p, []])), turn: null, next: null, shown: [], log: [], count: 0, drew: null,
  };
  const events: NewEvent[] = [];
  for (const p of seats) {
    const laid = lay(game, p);
    game = laid.game;
    events.push(...laid.events);
  }
  return begin(game, pick(seats, rand), now, events);
}

/** Whether `pid` may ask `to` for `rank` now: their turn, another player in the game who holds a card, a rank they hold. */
export const legal = (g: Game, pid: string, to: string, rank: Rank): boolean =>
  g.phase === 'turn' && g.paused === null && g.turn === pid && playing(g, pid) && to !== pid
  && askable(g, pid).includes(to) && isRank(rank) && holds(g, pid, rank);

/** An ask from the phone of `pid`, for the turn in play (`at`); anything not legal changes nothing. */
export function ask(g: Game, pid: string, at: number, to: string, rank: Rank, now: number): Game {
  if (g.at !== at || !legal(g, pid, to, rank)) return g;
  const given = hand(g, to).filter((c) => rankOf(c) === rank);
  const events: NewEvent[] = [{ k: 'asked', by: pid, from: to, rank, got: given.length }];
  let drew: Card | null = null;
  let again = true;
  if (given.length) {
    g = { ...g, hands: { ...g.hands, [to]: hand(g, to).filter((c) => rankOf(c) !== rank), [pid]: [...hand(g, pid), ...given] } };
  } else if (!g.pool.length) {
    events.push({ k: 'dry', by: pid });
    again = false;
  } else {
    const took = take(g, pid);
    g = took.game;
    drew = took.card;
    again = rankOf(drew) === rank;
    events.push(again ? { k: 'drew', by: pid, why: 'fish', rank } : { k: 'drew', by: pid, why: 'fish' });
  }
  const laid = lay(g, pid);
  const { game, added } = note(laid.game, [...events, ...laid.events]);
  return enter({ ...game, turn: pid, next: again ? pid : after(game, pid), shown: added, drew }, 'show', now, SHOW_MS);
}

/** A random legal ask for the player whose turn it is (the timer ran out, or the host moved on). */
export function anyAsk(g: Game, now: number, rand: Rand = Math.random): Game {
  const pid = g.turn;
  if (g.phase !== 'turn' || !pid) return g;
  const targets = askable(g, pid);
  const ranks = [...new Set(hand(g, pid).map(rankOf))];
  if (!targets.length || !ranks.length) return begin(g, after(g, pid), now);
  return ask({ ...g, paused: null }, pid, g.at, pick(targets, rand), pick(ranks, rand), now);
}

/** The host's advance: ask for the player whose turn it is, or the next turn after an outcome. */
export function step(g: Game, now: number, rand: Rand = Math.random): Game {
  if (g.phase === 'turn') return anyAsk(g, now, rand);
  if (g.phase === 'show') return begin(g, g.next ?? after(g, g.turn ?? ''), now);
  return g;
}

/** Moves the game on by itself when the timer runs out (never while paused). */
export function tick(g: Game, now: number, rand: Rand = Math.random): Game {
  if (g.paused !== null || (g.phase !== 'turn' && g.phase !== 'show')) return g;
  return g.deadline !== null && g.deadline <= now ? step(g, now, rand) : g;
}

/**
 * A player out of the game (removed, or left): their hand is shuffled back into the pool and their
 * books stay down. Their turn passes on; fewer than two players left ends the game.
 */
export function out(g: Game, pid: string, now: number, rand: Rand = Math.random): Game {
  if (g.phase !== 'turn' && g.phase !== 'show') return g;
  if (!g.seats.includes(pid)) return g;
  const cards = hand(g, pid);
  g = note({ ...g, pool: shuffle([...g.pool, ...cards], rand), hands: { ...g.hands, [pid]: [] } }, [{ k: 'gone', by: pid }]).game;
  if (inPlay(g).length < 2) return finish(g, now);
  if (g.phase === 'turn' && g.turn === pid) return begin(g, after(g, pid), now);
  return g;
}

/** Lobby: the same room and players for a fresh deal; the removed stay out, whoever left may join anew. */
export function rematch(g: Game, id: string, settings: Settings): Game {
  return { ...newGame(id, g.code, settings), at: g.at + 1, players: active(g), kicked: g.kicked.filter((x) => !g.left.includes(x)) };
}
