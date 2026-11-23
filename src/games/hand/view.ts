// What the host screen and each phone are sent. A phone gets only its own hand; answers carry no
// author until the reveal, and a phone learns only which one is its own.
import { picks } from './cards';
import * as L from './logic';

/** An answer card in a hand; `text` '' is a blank card. */
export type Card = { id: number; text: string };
/** A played answer as shown; `by` (a player id or the house) only at the reveal. */
export type Answer = { texts: string[]; by?: string };

export type View = {
  phase: L.Phase; at: number; left: number | null; total: number; paused: boolean;
  round: number; target: number; players: L.Player[];
  /** The house's points, when the house plays. */
  house: number | null;
  judge?: string; prompt?: string; picks?: number;
  /** Who answers this prompt (answering), and who has played or voted. */
  answering?: string[]; progress?: string[];
  answers?: Answer[]; spotlight?: number | null; winner?: number | null;
  /** The room voted because the judge was missing; at the reveal, each answer's votes. */
  voted?: boolean; votes?: number[];
  /** Judging, the judge's phone gone: ms until the room votes instead. */
  away?: number | null;
  results?: L.Win[];
  // This phone only:
  hand?: Card[]; played?: string[]; mine?: number; canVote?: boolean; hasVoted?: boolean;
  /** Trade a point is on and allowed now. */
  trade?: boolean; traded?: number;
};

const totals: Partial<Record<L.Phase, number>> = { vote: L.VOTE_MS, reveal: L.REVEAL_MS };

function shown(g: L.Game, r: L.Round): Pick<View, 'answers' | 'spotlight' | 'winner' | 'voted' | 'votes'> {
  const reveal = g.phase === 'reveal' || g.phase === 'over';
  const answers = r.order.map((pid) => ({ texts: r.plays[pid]?.texts ?? [], ...(reveal ? { by: pid } : {}) }));
  const votes = reveal && r.voted ? r.order.map((_, i) => Object.values(r.votes).filter((v) => v === i).length) : undefined;
  return { answers, spotlight: r.spotlight, winner: r.winner, voted: r.voted, ...(votes ? { votes } : {}) };
}

function own(g: L.Game, r: L.Round | null, pid: string): Partial<View> {
  if (!L.isActive(g, pid)) return {};
  const v: Partial<View> = { hand: (g.hands[pid] ?? []).map((id) => ({ id, text: g.cards[id] })), traded: g.traded[pid] ?? 0 };
  if (L.canTrade(g, pid)) v.trade = true;
  if (!r) return v;
  if (r.plays[pid]) v.played = r.plays[pid].texts;
  if (r.order.includes(pid)) v.mine = r.order.indexOf(pid);
  if (g.phase === 'vote') {
    v.canVote = L.voters(g).includes(pid);
    v.hasVoted = Object.hasOwn(r.votes, pid);
  }
  return v;
}

export function view(g: L.Game, now: number, pid?: string): View {
  const r = g.round;
  const playing = g.phase !== 'lobby' && g.phase !== 'over';
  const v: View = {
    phase: g.phase, at: g.at, left: L.left(g, now), paused: g.paused !== null,
    total: g.phase === 'answer' ? g.settings.seconds * 1000 : totals[g.phase] ?? 0,
    round: r?.n ?? 0, target: g.settings.target, players: g.phase === 'over' ? L.standings(g) : L.active(g),
    house: g.settings.house ? g.house : null,
  };
  if (r && playing) {
    Object.assign(v, { judge: r.judge, prompt: r.prompt, picks: picks(r.prompt) });
    if (g.phase === 'answer') Object.assign(v, { answering: r.players, progress: Object.keys(r.plays) });
    else Object.assign(v, shown(g, r));
    if (g.phase === 'vote') v.progress = Object.keys(r.votes);
    if (g.phase === 'judge') v.away = r.away === null ? null : Math.max(0, L.JUDGE_AWAY_MS - (now - r.away));
  }
  if (g.phase === 'over') v.results = g.results;
  return pid ? { ...v, ...own(g, playing ? r : null, pid) } : v;
}
