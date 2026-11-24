// A Would You Rather game: a question, everyone in the game taps a side on their phone (the last
// tap counts), the reveal shows who picked what, and each player on the bigger side scores a point
// (*house*: the folk game keeps no score; a tie scores nobody). Then the next question, or the end.
import { ratherKey } from './rules';
import {
  REVEAL_MS, active, enter, isActive, newGame, reconnecting,
  type Game, type Settings, type Side, type Tally,
} from './state';

/**
 * A game's questions from `pool` (the picked packs' questions as they are now, shuffled): ones
 * this room has not asked yet; when fewer are left than the game needs, the room forgets what it
 * asked and carries on with the rest of the picks (*house*). None twice in one game, by key; as
 * many as the picks hold, up to `count`. Returns the asked keys still in the picks (none, after
 * forgetting), so the list never outgrows the picks.
 */
export function deal(pool: readonly string[], asked: readonly string[], count: number): { questions: string[]; asked: string[] } {
  const byKey = new Map<string, string>();
  for (const q of pool) if (!byKey.has(ratherKey(q))) byKey.set(ratherKey(q), q);
  const before = asked.filter((k) => byKey.has(k));
  const fresh = [...byKey.keys()].filter((k) => !before.includes(k)).slice(0, count);
  const forget = fresh.length < count;
  const rest = forget ? [...byKey.keys()].filter((k) => !fresh.includes(k)).slice(0, count - fresh.length) : [];
  return { questions: [...fresh, ...rest].map((k) => byKey.get(k)!), asked: forget ? [] : before };
}

/** Starts a game from `pool`, the picked packs' questions as they are now, shuffled (pack.ts). */
export function start(g: Game, pool: readonly string[], now: number): Game {
  const dealt = deal(pool, g.asked, g.settings.count);
  if (!dealt.questions.length) return g;
  const players = g.players.map((p) => ({ ...p, score: 0 }));
  return ask({ ...g, players, questions: dealt.questions, asked: dealt.asked, round: null, results: [] }, 1, now);
}

/** Whether question `n` would end the game instead: past the last, or fewer than two players left. */
const ends = (g: Game, n: number) => n > g.questions.length || active(g).length < 2;

/** In the reveal: whether the next step is the end. */
export const lastStep = (g: Game) => g.phase === 'reveal' && !!g.round && ends(g, g.round.n + 1);

function ask(g: Game, n: number, now: number): Game {
  if (ends(g, n)) return enter(g, 'over', now);
  const s = g.settings.seconds;
  const prompt = g.questions[n - 1];
  return enter({ ...g, asked: [...g.asked, ratherKey(prompt)], round: { n, prompt, votes: {}, tally: null } }, 'vote', now, s ? s * 1000 : undefined);
}

/** A tap on a side: only for the question in play (its phase `at` and number `n`), from a player in the game, before the reveal. */
export function vote(g: Game, pid: string, at: number, n: number, side: Side): Game {
  const r = g.round;
  if (g.phase !== 'vote' || g.at !== at || !r || r.n !== n || !isActive(g, pid) || (side !== 0 && side !== 1) || r.votes[pid] === side) return g;
  return { ...g, round: { ...r, votes: { ...r.votes, [pid]: side } } };
}

/** A phone's tap as the host takes it: the game after it, and whether to tell the phone it did not count (a repeat of a counted tap did). */
export function tap(g: Game, pid: string, at: number, n: number, side: Side): { game: Game; refused: boolean } {
  const game = vote(g, pid, at, n, side);
  const r = g.round;
  const counted = g.phase === 'vote' && g.at === at && r?.n === n && isActive(g, pid) && r.votes[pid] === side;
  return { game, refused: game === g && !counted };
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

/** Play again: the same room and players, scores at zero, the questions the room asked remembered; the removed stay out, whoever left may join anew. */
export function rematch(g: Game, id: string, settings: Settings): Game {
  return {
    ...newGame(id, g.code, settings), at: g.at + 1, players: active(g).map((p) => ({ ...p, score: 0 })),
    kicked: g.kicked.filter((x) => !g.left.includes(x)), asked: g.asked,
  };
}
