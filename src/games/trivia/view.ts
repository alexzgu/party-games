// What the host screen and each phone are sent. Before the reveal nobody learns which answer is
// right, and nobody's answer is sent to anyone but its own phone: the host screen and the others
// learn only who has answered.
import * as L from './logic';

export type View = {
  phase: L.Phase; at: number; left: number | null; total: number; paused: boolean;
  /** Extra time after a host reload (`L.Game.extra`): the timer shows those seconds alone, and an answer in them scores no speed points. */
  extra?: boolean;
  /** The question in play (from 1) and how many this game has (at the end: how many it asked). */
  n: number; count: number;
  /** The reveal: the next step ends the game. */
  last?: boolean;
  players: L.Player[];
  /** From the category on: the question's category; from the answer phase on: the question and its four answers as shown. */
  category?: string;
  question?: string;
  answers?: L.Asked['answers'];
  /** Answering: who has answered (never what). */
  answered?: string[];
  /** The reveal: the right answer, how many picked each, and who was right with their points. */
  result?: L.Result & { right: L.Choice };
  results?: L.Past[];
  /** This phone only: its own answer to the question in play. */
  mine?: L.Choice;
};

function own(g: L.Game, pid: string): Partial<View> {
  const a = g.round?.answers[pid];
  return L.isActive(g, pid) && (g.phase === 'answer' || g.phase === 'reveal') && a ? { mine: a.choice } : {};
}

export function view(g: L.Game, now: number, pid?: string): View {
  const r = g.round;
  const v: View = {
    phase: g.phase, at: g.at, left: L.left(g, now), paused: g.paused !== null, total: g.extra ? L.EXTRA_MS : L.phaseMs(g.phase, g.settings),
    n: r?.n ?? 0, count: g.phase === 'lobby' ? g.settings.count : g.phase === 'over' ? g.results.length : g.questions.length,
    players: g.phase === 'over' ? L.standings(g) : L.active(g),
  };
  if (r && (g.phase === 'category' || g.phase === 'answer' || g.phase === 'reveal')) v.category = r.q.category;
  if (r && (g.phase === 'answer' || g.phase === 'reveal')) Object.assign(v, { question: r.q.question, answers: r.q.answers });
  if (r && g.phase === 'answer') v.answered = L.active(g).filter((p) => Object.hasOwn(r.answers, p.pid)).map((p) => p.pid);
  if (r?.result && g.phase === 'reveal') Object.assign(v, { result: { ...r.result, right: r.q.right }, last: L.lastStep(g) });
  if (g.extra) v.extra = true;
  if (g.phase === 'over') v.results = g.results;
  return pid ? { ...v, ...own(g, pid) } : v;
}
