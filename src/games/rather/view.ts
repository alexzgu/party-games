// What the host screen and each phone are sent. Before the reveal nobody's side is sent to anyone
// but its own phone: the host screen and the others learn only who has voted.
import * as L from './logic';

export type View = {
  phase: L.Phase; at: number; left: number | null; total: number; paused: boolean;
  /** The question in play (from 1) and how many this game has. */
  n: number; count: number;
  players: L.Player[];
  prompt?: string;
  /** Voting: who has voted (never which way). */
  voted?: string[];
  /** The reveal: the counts, who picked which side, the bigger side. */
  tally?: L.Tally;
  results?: L.Past[];
  /** This phone only: its own latest tap on the question in play. */
  mine?: L.Side;
};

function own(g: L.Game, pid: string): Partial<View> {
  const side = g.round?.votes[pid];
  return L.isActive(g, pid) && (g.phase === 'vote' || g.phase === 'reveal') && side !== undefined ? { mine: side } : {};
}

export function view(g: L.Game, now: number, pid?: string): View {
  const r = g.round;
  const playing = g.phase === 'vote' || g.phase === 'reveal';
  const v: View = {
    phase: g.phase, at: g.at, left: L.left(g, now), paused: g.paused !== null,
    total: g.phase === 'vote' ? g.settings.seconds * 1000 : g.phase === 'reveal' ? L.REVEAL_MS : 0,
    n: r?.n ?? 0, count: g.phase === 'lobby' ? g.settings.count : g.questions.length,
    players: g.phase === 'over' ? L.standings(g) : L.active(g),
  };
  if (r && playing) v.prompt = r.prompt;
  if (r && g.phase === 'vote') v.voted = L.active(g).filter((p) => Object.hasOwn(r.votes, p.pid)).map((p) => p.pid);
  if (r?.tally && g.phase === 'reveal') v.tally = r.tally;
  if (g.phase === 'over') v.results = g.results;
  return pid ? { ...v, ...own(g, pid) } : v;
}
