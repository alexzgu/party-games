// History entries for a game: a finished one (who beat whom), or one ended before anyone won
// (the scores as they stood). Both list one line per round.
import type { HistoryEntry } from '../../lib/history';
import { other, scoresBefore, type Game, type RoundLog } from './state';

export type GameSummary = Omit<HistoryEntry, 'id' | 'at'>;

function roundLine(g: Game, r: RoundLog, n: number): string {
  const clue = r.clue ? ` · “${r.clue}”` : '';
  const pts = `${r.points} pt${r.points === 1 ? '' : 's'}`;
  const steal = r.steal ? ` · ${g.teams[other(r.team)].name} stole 1` : '';
  return `${n}. ${g.teams[r.team].name} · ${r.left} ↔ ${r.right}${clue} · ${pts}${steal}`;
}

/** Rounds the players have seen the result of: the round on the reveal screen counts once it has played. */
export function revealedLog(g: Game): RoundLog[] {
  return g.phase === 'reveal' && g.round && !g.round.revealed ? g.log.slice(0, -1) : g.log;
}

export function summarize(g: Game, packNames: string[]): GameSummary {
  const w = g.winner ?? (g.teams[0].score >= g.teams[1].score ? 0 : 1);
  const l = other(w);
  const [win, lose] = [g.teams[w], g.teams[l]];
  return {
    game: 'dial',
    title: `${win.name} beat ${lose.name} ${win.score}–${lose.score}`,
    scores: [{ name: win.name, score: win.score }, { name: lose.name, score: lose.score }],
    packs: packNames,
    details: g.log.map((r, i) => roundLine(g, r, i + 1)),
    finished: true,
  };
}

/** The entry for a game ended before anyone won, leader first; null when no round result was shown yet. */
export function summarizeEarly(g: Game, packNames: string[]): GameSummary | null {
  const log = revealedLog(g);
  if (g.phase === 'win' || log.length === 0) return null;
  const s = scoresBefore(g);
  const [a, b] = (s[1] > s[0] ? [1, 0] : [0, 1]).map((i) => ({ name: g.teams[i].name, score: s[i] }));
  return {
    game: 'dial',
    title: `${a.name} ${a.score} – ${b.name} ${b.score}`,
    scores: [a, b],
    packs: packNames,
    details: log.map((r, i) => roundLine(g, r, i + 1)),
    finished: false,
  };
}
