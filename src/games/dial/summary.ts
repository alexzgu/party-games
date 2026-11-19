// The history entry for a finished game: who beat whom, both scores, and one line per round.
import type { HistoryEntry } from '../../lib/history';
import { other, type Game, type RoundLog } from './state';

export type GameSummary = Omit<HistoryEntry, 'id' | 'at'>;

function roundLine(g: Game, r: RoundLog, n: number): string {
  const clue = r.clue ? ` · “${r.clue}”` : '';
  const pts = `${r.points} pt${r.points === 1 ? '' : 's'}`;
  const steal = r.steal ? ` · ${g.teams[other(r.team)].name} stole 1` : '';
  return `${n}. ${g.teams[r.team].name} · ${r.left} ↔ ${r.right}${clue} · ${pts}${steal}`;
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
  };
}
