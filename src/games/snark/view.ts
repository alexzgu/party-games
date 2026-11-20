// What each phone is sent: only what that player needs, never who wrote which answer before
// the reveal. Phones render this and nothing else, so a reconnecting phone is up to date at once.
// A phone with nothing to do (done writing, voted, its own prompt, the reveal, the scores) is
// also sent what the host screen shows, so a group can play without a shared screen. The fields
// that carry it are optional: a phone that is busy writing or voting never gets them, which
// keeps those messages small.
import { NO_ANSWER, authorsOf, currentItem, isFinalRound, player, present, promptCount, tasksFor, timeLeft, timerLength, votableFinal, votersFor, type Duel, type Finale, type Game } from './logic';
import { leaders, place, standings } from './record';

/** A player as the phones show them. */
export interface Face { name: string; color: number }
/** A voter or a writer, and whether they are done. */
export interface Tick extends Face { done: boolean }
/** One line of the scoreboard; `gain` is what this round added. */
export interface Row extends Face { place: number; score: number; gain: number }
/** A head-to-head answer at the reveal: who wrote it, who voted for it, what it earned. */
export interface Side { text: string; empty: boolean; by: Face; votes: number; points: number; backers: Face[]; sweep: boolean }
/** A final-round answer at the reveal. */
export interface Card { text: string; by: Face; votes: number; points: number }
/** The revealed prompt as the host screen shows it (final answers most votes first). */
export type Shown = { kind: 'duel'; prompt: string; sides: Side[] } | { kind: 'final'; prompt: string; cards: Card[] };

export type Screen =
  | { k: 'lobby'; players: number; who?: Face[] }
  /** Joined mid-round: plays from the next round. `writers` while the others write. */
  | { k: 'late'; writers?: Tick[] }
  /** Prompts still to answer; empty when this player is done, and then `writers` says who is still writing. */
  | { k: 'write'; tasks: { i: number; prompt: string }[]; total: number; writers?: Tick[] }
  /**
   * `empty`: that author sent no answer, so it cannot be voted for. Once this phone has voted,
   * or the prompt is its own: `voters` (who has voted) and, on its own prompt, `mine` (its side).
   */
  | { k: 'vote'; at: number; prompt: string; choices: { id: 'a' | 'b'; text: string; empty: boolean }[]; own: boolean; voted: 'a' | 'b' | null; mine?: 'a' | 'b'; voters?: Tick[] }
  /** Once this phone has sent its votes, or has none to give: every answer (`mine`: its own, by position) and `voters`. */
  | { k: 'vote3'; at: number; prompt: string; choices: { id: number; text: string }[]; own: boolean; sent: boolean; answers?: string[]; mine?: number; voters?: Tick[] }
  | { k: 'reveal'; gain: number | null; show?: Shown }
  | { k: 'scores'; place: number; rows?: Row[] }
  | { k: 'over'; place: number; winners: string[]; rows?: Row[] }
  | { k: 'kicked' };

export interface PlayerView {
  code: string;
  round: number;
  rounds: number;
  final: boolean;
  me: { name: string; color: number; score: number };
  screen: Screen;
  /** Time left on the timer when the view was sent (ms); null when untimed. */
  left: number | null;
  /** The timer's full length (ms). */
  span: number;
  paused: boolean;
}

export function playerView(g: Game, pid: string, now: number): PlayerView | null {
  const p = player(g, pid);
  if (!p) return null;
  return {
    code: g.code,
    round: g.round,
    rounds: g.settings.rounds,
    final: g.round > 0 && isFinalRound(g),
    me: { name: p.name, color: p.color, score: p.score },
    screen: p.kicked ? { k: 'kicked' } : screenFor(g, pid),
    left: timeLeft(g, now),
    span: timerLength(g),
    paused: g.paused !== null,
  };
}

function screenFor(g: Game, pid: string): Screen {
  const me = player(g, pid)!;
  const item = currentItem(g);
  switch (g.phase) {
    case 'lobby': return { k: 'lobby', players: present(g).length, who: present(g).map(face) };
    case 'write': {
      if (!me.active) return { k: 'late', writers: writers(g) };
      const tasks = tasksFor(g, pid).map((i) => ({ i, prompt: g.items[i].prompt }));
      return { k: 'write', tasks, total: promptCount(g, pid), ...(tasks.length ? {} : { writers: writers(g) }) };
    }
    case 'vote':
      if (!item) return { k: 'late' };
      return item.kind === 'duel' ? duelVote(g, item, pid) : finalVote(g, item, pid);
    case 'reveal': {
      const r = item?.result;
      return { k: 'reveal', gain: r && pid in r.points ? r.points[pid] : null, ...(item && r ? { show: shown(g, item) } : {}) };
    }
    case 'scores': return { k: 'scores', place: place(g, me.score), rows: rows(g) };
    case 'over': return { k: 'over', place: place(g, me.score), winners: leaders(g).map((x) => x.name), rows: rows(g) };
  }
}

function duelVote(g: Game, item: Duel, pid: string): Screen {
  const ballot = item.ballots[pid];
  const voted = ballot === undefined ? null : ballot === item.a ? 'a' : 'b';
  // Everyone present who is not a voter wrote one of the two answers.
  const own = !votersFor(g, item).includes(pid);
  return {
    k: 'vote',
    at: g.at,
    prompt: item.prompt,
    choices: (['a', 'b'] as const).map((id) => {
      const text = item.answers[item[id]];
      return { id, text: text ?? NO_ANSWER, empty: text == null };
    }),
    own,
    voted,
    ...(own ? { mine: pid === item.a ? ('a' as const) : ('b' as const) } : {}),
    ...(own || voted ? { voters: voters(g, item) } : {}),
  };
}

function finalVote(g: Game, item: Finale, pid: string): Screen {
  const choices = votableFinal(item, pid).map((a) => ({ id: item.authors.indexOf(a), text: item.answers[a]! }));
  const sent = pid in item.ballots;
  const real = item.authors.filter((a) => item.answers[a] != null);
  const watch = sent || !choices.length;
  return {
    k: 'vote3',
    at: g.at,
    prompt: item.prompt,
    choices,
    own: authorsOf(item).includes(pid),
    sent,
    ...(watch ? { answers: real.map((a) => item.answers[a]!), voters: voters(g, item) } : {}),
    ...(watch && real.includes(pid) ? { mine: real.indexOf(pid) } : {}),
  };
}

const face = (p: Face): Face => ({ name: p.name, color: p.color });
const faceOf = (g: Game, pid: string): Face => face(player(g, pid) ?? { name: '?', color: 0 });

/** Who is writing this round, and who has answered everything. */
export const writers = (g: Game): Tick[] => present(g).filter((p) => p.active).map((p) => ({ ...face(p), done: tasksFor(g, p.pid).length === 0 }));

/** Who may vote on the prompt on screen, and who has. */
export const voters = (g: Game, item: Duel | Finale): Tick[] => votersFor(g, item).map((pid) => ({ ...faceOf(g, pid), done: pid in item.ballots }));

/** The scoreboard: highest first, shared places for ties, this round's points beside each. */
export function rows(g: Game): Row[] {
  const gain = (pid: string) => g.items.reduce((n, it) => n + (it.result?.points[pid] ?? 0), 0);
  return standings(g).map((p) => ({ ...face(p), place: place(g, p.score), score: p.score, gain: gain(p.pid) }));
}

/** A revealed prompt: each answer's author, voters and points. */
export function shown(g: Game, item: Duel | Finale): Shown {
  const r = item.result!;
  if (item.kind === 'duel') {
    const sides = [item.a, item.b].map((pid) => ({
      text: item.answers[pid] ?? NO_ANSWER,
      empty: item.answers[pid] == null,
      by: faceOf(g, pid),
      votes: r.votes[pid] ?? 0,
      points: r.points[pid] ?? 0,
      backers: Object.keys(item.ballots).filter((v) => item.ballots[v] === pid).map((v) => faceOf(g, v)),
      sweep: r.sweep === pid,
    }));
    return { kind: 'duel', prompt: item.prompt, sides };
  }
  const cards = item.authors
    .filter((pid) => item.answers[pid] != null)
    .map((pid) => ({ text: item.answers[pid]!, by: faceOf(g, pid), votes: r.votes[pid] ?? 0, points: r.points[pid] ?? 0 }))
    .sort((x, y) => y.votes - x.votes);
  return { kind: 'final', prompt: item.prompt, cards };
}
