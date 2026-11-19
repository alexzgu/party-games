// Standings and the History entry. History lives on the host screen's device only.
import type { HistoryEntry } from '../../lib/history';
import { present, type Game, type Player } from './logic';

export type Summary = Omit<HistoryEntry, 'id' | 'at'>;

/** Highest score first; ties keep join order. */
export function standings(g: Game): Player[] {
  return present(g)
    .map((p, i) => ({ p, i }))
    .sort((x, y) => y.p.score - x.p.score || x.i - y.i)
    .map((x) => x.p);
}

/** Shared places for ties: 1, 1, 3. */
export const place = (g: Game, score: number) => 1 + present(g).filter((p) => p.score > score).length;

/** Everyone on the top score, or nobody when nobody scored. */
export function leaders(g: Game): Player[] {
  const rows = standings(g);
  const best = rows[0]?.score ?? 0;
  return best > 0 ? rows.filter((p) => p.score === best) : [];
}

export const anyScored = (g: Game) => g.players.some((p) => p.score > 0);

export const pts = (n: number) => n.toLocaleString('en-US');

const listed = (names: string[]) => (names.length < 3 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

/** The entry for a game that reached its winner screen, or was ended early with something scored; null otherwise. */
export function gameRecord(g: Game, packs: string[]): Summary | null {
  if (!anyScored(g)) return null;
  const finished = g.phase === 'over' && !g.ended;
  const top = leaders(g).map((p) => p.name);
  const verb = finished ? 'won' : 'led';
  const head = top.length === 1 ? `${top[0]} ${verb}` : `${listed(top)} tied`;
  const rows = standings(g);
  return {
    game: 'snark',
    title: `${head} ${rows.map((p) => pts(p.score)).join('–')}`,
    scores: rows.map((p) => ({ name: p.name, score: p.score })),
    packs,
    details: g.log,
    finished,
  };
}
