// A Smarty Pants game: each question shows its category, then the question and four answers;
// everyone in the game taps one on their phone (the first tap is final), and the reveal shows the
// right one, how many picked each, and who scored. A right answer scores 500 plus up to 500 for
// speed (questions.ts). Then the next question, or the end.
import { deal, points, toAsk } from './questions';
import { questionKey } from './rules';
import {
  active, enter, isActive, left as timeLeft, newGame, phaseMs, reconnecting,
  type Choice, type Game, type Result, type Settings,
} from './state';

/** Starts a game from `pool`, the picked packs' lines as they are now, shuffled (pack.ts); `rand` shuffles each question's answers. */
export function start(g: Game, pool: readonly string[], now: number, rand: () => number = Math.random): Game {
  const dealt = deal(pool, g.asked, g.settings.count);
  if (!dealt.questions.length) return g;
  const players = g.players.map((p) => ({ ...p, score: 0 }));
  const questions = dealt.questions.map((line) => toAsk(line, rand));
  return ask({ ...g, players, questions, asked: dealt.asked, round: null, results: [] }, 1, now);
}

/** Whether question `n` would end the game instead: past the last, or fewer than two players left. */
const ends = (g: Game, n: number) => n > g.questions.length || active(g).length < 2;

/** In the reveal: whether the next step is the end. */
export const lastStep = (g: Game) => g.phase === 'reveal' && !!g.round && ends(g, g.round.n + 1);

function ask(g: Game, n: number, now: number): Game {
  if (ends(g, n)) return enter(g, 'over', now);
  const q = g.questions[n - 1];
  return enter({ ...g, asked: [...g.asked, questionKey(q.question)], round: { n, q, answers: {}, result: null } }, 'category', now);
}

/** A tap on an answer: only for the question in play (its phase `at` and number `n`), from a player in the game who has not answered, before the reveal. */
export function answer(g: Game, pid: string, at: number, n: number, choice: Choice, now: number): Game {
  const r = g.round;
  if (g.phase !== 'answer' || g.at !== at || !r || r.n !== n || !isActive(g, pid) || ![0, 1, 2, 3].includes(choice) || Object.hasOwn(r.answers, pid)) return g;
  return { ...g, round: { ...r, answers: { ...r.answers, [pid]: { choice, left: timeLeft(g, now) ?? 0 } } } };
}

/** A phone's tap as the host takes it: the game after it, and whether to tell the phone it did not count (a repeat of its counted tap did). */
export function tap(g: Game, pid: string, at: number, n: number, choice: Choice, now: number): { game: Game; refused: boolean } {
  const game = answer(g, pid, at, n, choice, now);
  const r = g.round;
  const counted = g.phase === 'answer' && g.at === at && r?.n === n && isActive(g, pid) && r.answers[pid]?.choice === choice;
  return { game, refused: game === g && !counted };
}

/** The answers of players still in the game: counts per answer, and who was right with the points each gained. */
export function result(g: Game): Result {
  const r = g.round!;
  const total = g.settings.seconds * 1000;
  const counts: Result['counts'] = [0, 0, 0, 0];
  const gains: Result['gains'] = [];
  for (const p of active(g)) {
    const a = r.answers[p.pid];
    if (!a) continue;
    counts[a.choice]++;
    if (a.choice === r.q.right) gains.push({ pid: p.pid, points: points(true, a.left, total) });
  }
  return { counts, gains: gains.sort((a, b) => b.points - a.points) };
}

function reveal(g: Game, now: number): Game {
  const r = g.round!;
  const res = result(g);
  const players = g.players.map((p) => ({ ...p, score: p.score + (res.gains.find((x) => x.pid === p.pid)?.points ?? 0) }));
  const past = { category: r.q.category, question: r.q.question, right: r.q.answers[r.q.right], correct: res.gains.length, of: res.counts.reduce((a, b) => a + b, 0) };
  return enter({ ...g, players, round: { ...r, result: res }, results: [...g.results, past] }, 'reveal', now);
}

/** The host's advance: the question now, the reveal now, or the next question (the end after the last). */
export function step(g: Game, now: number): Game {
  if (!g.round) return g;
  if (g.phase === 'category') return enter(g, 'answer', now);
  if (g.phase === 'answer') return reveal(g, now);
  if (g.phase === 'reveal') return ask(g, g.round.n + 1, now);
  return g;
}

/** Moves the game on by itself: the timer, or every connected player in the game has answered. */
export function tick(g: Game, now: number, online: ReadonlySet<string>): Game {
  const r = g.round;
  if (g.paused !== null || !r || !phaseMs(g.phase, g.settings)) return g;
  if (g.deadline !== null && g.deadline <= now) return step(g, now);
  if (g.phase !== 'answer' || reconnecting(g, now)) return g;
  const present = active(g).filter((p) => online.has(p.pid));
  return present.length && present.every((p) => Object.hasOwn(r.answers, p.pid)) ? step(g, now) : g;
}

/** Play again: the same room and players, scores at zero, the questions the room asked remembered; the removed stay out, whoever left may join anew. */
export function rematch(g: Game, id: string, settings: Settings): Game {
  return {
    ...newGame(id, g.code, settings), at: g.at + 1, players: active(g).map((p) => ({ ...p, score: 0 })),
    kicked: g.kicked.filter((x) => !g.left.includes(x)), asked: g.asked,
  };
}
