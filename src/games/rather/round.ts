// A Would You Rather game: a question, everyone in the game taps a side on their phone (the last
// tap counts), the reveal shows who picked what, and each player on the bigger side scores a point
// (*house*: the folk game keeps no score; a tie scores nobody). Then the next question, or the end.
import {
  REVEAL_MS, active, enter, isActive, newGame, packKey, reconnecting,
  type Game, type Settings, type Side, type Tally,
} from './state';

/**
 * The next `n` questions: the room's unused ones in order, then, once they run out, the freshly
 * shuffled `pool` (none asked twice in one game). Returns what is left for the next game too.
 */
export function deal(queue: readonly string[], pool: readonly string[], n: number): { questions: string[]; queue: string[] } {
  const questions: string[] = [];
  let rest = [...queue];
  let refilled = false;
  while (questions.length < n) {
    if (!rest.length) {
      if (refilled) break;
      refilled = true;
      rest = pool.filter((q) => !questions.includes(q));
      if (!rest.length) break;
    }
    questions.push(rest.shift()!);
  }
  return { questions, queue: rest };
}

/** Starts a game: the room's unused questions for these picks first (Play again carries on), then `pool`, the picks' questions freshly shuffled. */
export function start(g: Game, pool: readonly string[], now: number): Game {
  const key = packKey(g.settings);
  const dealt = deal(g.queueOf === key ? g.queue : [], pool, g.settings.count);
  if (!dealt.questions.length) return g;
  const players = g.players.map((p) => ({ ...p, score: 0 }));
  return ask({ ...g, players, questions: dealt.questions, queue: dealt.queue, queueOf: key, round: null, results: [] }, 1, now);
}

function ask(g: Game, n: number, now: number): Game {
  if (n > g.questions.length || active(g).length < 2) return enter(g, 'over', now);
  const s = g.settings.seconds;
  return enter({ ...g, round: { n, prompt: g.questions[n - 1], votes: {}, tally: null } }, 'vote', now, s ? s * 1000 : undefined);
}

/** A tap on a side: only for the question in play (its phase `at` and number `n`), from a player in the game, before the reveal. */
export function vote(g: Game, pid: string, at: number, n: number, side: Side): Game {
  const r = g.round;
  if (g.phase !== 'vote' || g.at !== at || !r || r.n !== n || !isActive(g, pid) || (side !== 0 && side !== 1) || r.votes[pid] === side) return g;
  return { ...g, round: { ...r, votes: { ...r.votes, [pid]: side } } };
}

/** The votes of players still in the game, in seat order, and the bigger side. */
export function tally(g: Game): Tally {
  const votes = g.round?.votes ?? {};
  const voters: [string[], string[]] = [[], []];
  for (const p of active(g)) {
    const side = votes[p.pid];
    if (side === 0 || side === 1) voters[side].push(p.pid);
  }
  const counts: [number, number] = [voters[0].length, voters[1].length];
  return { counts, voters, winner: counts[0] === counts[1] ? null : counts[0] > counts[1] ? 0 : 1 };
}

function reveal(g: Game, now: number): Game {
  const r = g.round!;
  const t = tally(g);
  const won = t.winner === null ? [] : t.voters[t.winner];
  const players = g.players.map((p) => won.includes(p.pid) ? { ...p, score: p.score + 1 } : p);
  const past = { prompt: r.prompt, counts: t.counts, winner: t.winner };
  return enter({ ...g, players, round: { ...r, tally: t }, results: [...g.results, past] }, 'reveal', now, REVEAL_MS);
}

/** The host's advance: reveal now, or the next question (the end after the last). */
export function step(g: Game, now: number): Game {
  if (g.phase === 'vote' && g.round) return reveal(g, now);
  if (g.phase === 'reveal' && g.round) return ask(g, g.round.n + 1, now);
  return g;
}

/** Moves the game on by itself: the timer, or every connected player in the game has voted. */
export function tick(g: Game, now: number, online: ReadonlySet<string>): Game {
  const r = g.round;
  if (g.paused !== null || !r || (g.phase !== 'vote' && g.phase !== 'reveal')) return g;
  if (g.deadline !== null && g.deadline <= now) return step(g, now);
  if (g.phase !== 'vote' || reconnecting(g, now)) return g;
  const present = active(g).filter((p) => online.has(p.pid));
  return present.length && present.every((p) => Object.hasOwn(r.votes, p.pid)) ? step(g, now) : g;
}

/** Play again: the same room and players, scores at zero, the room's unused questions kept; the removed stay out, whoever left may join anew. */
export function rematch(g: Game, id: string, settings: Settings): Game {
  return {
    ...newGame(id, g.code, settings), at: g.at + 1, players: active(g).map((p) => ({ ...p, score: 0 })),
    kicked: g.kicked.filter((x) => !g.left.includes(x)), queue: g.queue, queueOf: g.queueOf,
  };
}
