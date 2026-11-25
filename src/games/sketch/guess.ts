// Draw & guess (skribbl.io's rules): each round everyone draws once in seat order while the
// others type guesses; faster guesses earn more, and the drawer earns the guessers' average.
import { GUESS_MAX, active, enter, isActive, left, nextItems, settling, type Game, type Guessing } from './core';
import { OFFER } from './room';
import { hintPlaces, hintsDue } from './hint';
import { isClose, isMatch } from './match';

export const PICK_SECS = 15;
export const REVEAL_SECS = 5;
export const SCORES_SECS = 8;
/** A drawer offline this long ends their turn. */
export const AWAY_MS = 10000;
const FEED_MAX = 40;

export const round5 = (x: number) => Math.round(x / 5) * 5;
/** A correct guess: 50 plus 450 × the share of the draw time left, rounded to 5. */
export const guessPoints = (left: number, total: number) => round5(50 + 450 * Math.max(0, Math.min(1, total ? left / total : 0)));
/** The drawer: the average over all guessers of what they earned (non-guessers count as 0), rounded to 5. */
export const drawerPoints = (earned: number[], guessers: number) => guessers ? round5(earned.reduce((a, b) => a + b, 0) / guessers) : 0;

const blank = (): Omit<Guessing, 'round' | 'order' | 'pool'> => ({
  turn: -1, drawer: '', offer: [], word: '', hints: [], shown: 0, got: [], feed: [], close: {}, away: null, points: [],
});

/** Starts a game of Draw & guess; `pool` is every word it may deal, in order (see room.dealItems). */
export function startGuess(g: Game, pool: string[], now: number): Game {
  return startRound({ ...g, tel: undefined, dg: { ...blank(), round: 0, order: [], pool } }, now);
}

function startRound(g: Game, now: number): Game {
  const dg = g.dg!;
  return nextTurn({ ...g, dg: { ...dg, ...blank(), round: dg.round + 1, order: active(g).map((p) => p.pid), points: dg.points } }, now);
}

/** The next drawer still in the room picks a word; after the last, the scores or the end. */
function nextTurn(g: Game, now: number): Game {
  const dg = g.dg!;
  let turn = dg.turn + 1;
  while (turn < dg.order.length && !isActive(g, dg.order[turn])) turn++;
  if (turn >= dg.order.length) return dg.round < g.settings.rounds ? enter(g, 'scores', now, SCORES_SECS) : enter(g, 'over', now);
  // Once the room's words are all offered, its own words come round again, least recently offered first.
  const { items: offer, pool, dealt } = nextItems(dg.pool, dg.dealt ?? [], OFFER);
  return enter({ ...g, dg: { ...dg, ...blank(), points: dg.points, turn, drawer: dg.order[turn], offer, pool, dealt } }, 'pick', now, PICK_SECS);
}

function draw(g: Game, word: string, now: number, rand: () => number): Game {
  // The away clock keeps running from the pick: a drawer gone while picking is not given a fresh 10 s.
  return enter({ ...g, dg: { ...g.dg!, word, hints: hintPlaces(word, rand), shown: 0 } }, 'guess', now, g.settings.guessSecs);
}

/** The drawer picks offer[i]. */
export function pick(g: Game, pid: string, at: number, i: number, now: number, rand: () => number = Math.random): Game {
  const dg = g.dg;
  if (g.phase !== 'pick' || g.at !== at || !dg || dg.drawer !== pid || !dg.offer[i] || g.frozen !== null) return g;
  return draw(g, dg.offer[i], now, rand);
}

/** Who may guess now: in the room, not drawing, not yet right. */
export const canGuess = (g: Game, pid: string) => g.phase === 'guess' && !!g.dg && g.dg.drawer !== pid &&
  isActive(g, pid) && !g.dg.got.some((x) => x.pid === pid);

export function guess(g: Game, pid: string, at: number, text: string, now: number): Game {
  const dg = g.dg!;
  const line = text.trim().replace(/\s+/g, ' ').slice(0, GUESS_MAX);
  if (g.at !== at || !line || !canGuess(g, pid) || g.frozen !== null) return g;
  const name = g.players.find((p) => p.pid === pid)!.name;
  if (isMatch(line, dg.word)) {
    const points = guessPoints(left(g, now) ?? 0, g.total);
    return { ...g, dg: { ...dg, got: [...dg.got, { pid, points }], feed: [...dg.feed, { pid, name, got: true }].slice(-FEED_MAX) } };
  }
  const { [pid]: _, ...others } = dg.close;
  const close = isClose(line, dg.word) ? { ...others, [pid]: line } : others;
  return { ...g, dg: { ...dg, close, feed: [...dg.feed, { pid, name, text: line }].slice(-FEED_MAX) } };
}

/** Everyone who counts as a guesser this turn: all who got it, and the rest of the room online now. */
export function guessers(g: Game, online: ReadonlySet<string>): string[] {
  const dg = g.dg!;
  const got = dg.got.map((x) => x.pid);
  return [...got, ...active(g).filter((p) => p.pid !== dg.drawer && !got.includes(p.pid) && online.has(p.pid)).map((p) => p.pid)];
}

/** Reveals the word and pays the turn: the guessers' points, and the drawer's average (not to a drawer no longer in the room). */
export function endTurn(g: Game, now: number, online: ReadonlySet<string>): Game {
  const dg = g.dg!;
  const drawer = isActive(g, dg.drawer) ? drawerPoints(dg.got.map((x) => x.points), guessers(g, online).length) : 0;
  const points = [...dg.got, { pid: dg.drawer, points: drawer }];
  const players = g.players.map((p) => ({ ...p, score: p.score + (points.find((x) => x.pid === p.pid)?.points ?? 0) }));
  return enter({ ...g, players, dg: { ...dg, points } }, 'reveal', now, REVEAL_SECS);
}

/** The host's skip: a turn still at its word choice is passed over; otherwise the phase ends now. */
export function skip(g: Game, now: number, online: ReadonlySet<string>): Game {
  return g.phase === 'pick' ? nextTurn(g, now) : advance(g, now, online, Math.random);
}

/** The phase's timer ran out (or the host moved on). */
export function advance(g: Game, now: number, online: ReadonlySet<string>, rand: () => number = Math.random): Game {
  switch (g.phase) {
    case 'pick': return draw(g, g.dg!.offer[0], now, rand);
    case 'guess': return endTurn(g, now, online);
    case 'reveal': return nextTurn(g, now);
    case 'scores': return startRound(g, now);
    default: return g;
  }
}

/** Ends the turn when the drawer left the room or has been offline for AWAY_MS; notes when they went offline. */
function watchDrawer(g: Game, now: number, online: ReadonlySet<string>): Game {
  const dg = g.dg!;
  const end = () => g.phase === 'pick' ? nextTurn(g, now) : endTurn(g, now, online);
  if (!isActive(g, dg.drawer)) return end();
  if (online.has(dg.drawer)) return dg.away === null ? g : { ...g, dg: { ...dg, away: null } };
  if (dg.away === null) return { ...g, dg: { ...dg, away: now } };
  return now - dg.away >= AWAY_MS ? end() : g;
}

/** The clock: timers, the drawer's absence, hints falling due, and everyone having guessed it. */
export function tickGuess(g: Game, now: number, online: ReadonlySet<string>, rand: () => number = Math.random): Game {
  if (g.frozen !== null || g.deadline === null || !g.dg) return g;
  if (g.deadline <= now) return advance(g, now, online, rand);
  if (g.phase !== 'pick' && g.phase !== 'guess') return g;
  // Phones still reconnecting: nobody is away and nobody is missing yet; hints still fall due.
  const watched = settling(g, now) && isActive(g, g.dg.drawer) ? g : watchDrawer(g, now, online);
  if (watched.at !== g.at || g.phase === 'pick') return watched;
  const dg = watched.dg!;
  const shown = Math.min(dg.hints.length, hintsDue(left(g, now) ?? 0, g.total));
  const next = shown > dg.shown ? { ...watched, dg: { ...dg, shown } } : watched;
  const here = active(g).filter((p) => p.pid !== dg.drawer && online.has(p.pid));
  const all = !settling(g, now) && here.length > 0 && here.every((p) => dg.got.some((x) => x.pid === p.pid));
  return all ? endTurn(next, now, online) : next;
}
