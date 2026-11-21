// History entries for a game: a finished one (who beat whom), or one ended before anyone won
// (the scores as they stood, the turn in play included). Both list one line per turn.
import type { HistoryEntry } from '../../lib/history';
import { other, roundNo, scores, turnScore, type Game, type Mark, type Turn } from './state';

export type GameSummary = Omit<HistoryEntry, 'id' | 'at'>;

/** A score as players read it: a real minus sign, so "3–−1" never reads as a range. */
const num = (n: number): string => (n < 0 ? `−${-n}` : String(n));

const ICON: Record<Mark, string> = { got: '✓', skip: '↷', buzz: '✗', time: '⏱' };

function turnLine(g: Game, t: Turn, n: number): string {
  const pts = turnScore(t, g.skipCost);
  const cards = t.cards.map((c) => `${ICON[c.mark]} ${c.word}`).join(', ') || 'no cards';
  return `${n}. ${g.names[t.team]} ${pts > 0 ? '+' : ''}${num(pts)} · ${cards}`;
}

const lines = (g: Game) => g.turns.map((t, i) => turnLine(g, t, i + 1));

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The win screen's line: "2 rounds · 7 words guessed · first to 10". */
export function winLine(g: Game): string {
  const got = g.turns.reduce((n, t) => n + t.cards.filter((c) => c.mark === 'got').length, 0);
  return `${count(roundNo(g), 'round', 'rounds')} · ${count(got, 'word', 'words')} guessed · ${g.mode === 'score' ? `first to ${g.goal}` : `${g.rounds}-round game`}`;
}

export function summarize(g: Game, packNames: string[]): GameSummary {
  const s = scores(g);
  const w = g.winner ?? (s[0] >= s[1] ? 0 : 1);
  const l = other(w);
  return {
    game: 'taboo',
    title: `${g.names[w]} beat ${g.names[l]} ${num(s[w])}–${num(s[l])}`,
    scores: [{ name: g.names[w], score: s[w] }, { name: g.names[l], score: s[l] }],
    packs: packNames,
    details: lines(g),
    finished: true,
  };
}

/** The entry for a game thrown away before a winner; null when no card has been marked yet. */
export function summarizeEarly(g: Game, packNames: string[]): GameSummary | null {
  if (g.phase === 'win' || !g.turns.some((t) => t.cards.length > 0)) return null;
  const s = scores(g);
  const [a, b] = (s[1] > s[0] ? [1, 0] : [0, 1]).map((i) => ({ name: g.names[i], score: s[i] }));
  return { game: 'taboo', title: `${a.name} ${num(a.score)} – ${b.name} ${num(b.score)}`, scores: [a, b], packs: packNames, details: lines(g), finished: false };
}
