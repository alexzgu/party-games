// What each phone is sent: only what that player needs, never who wrote which answer before
// the reveal. Phones render this and nothing else, so a reconnecting phone is up to date at once.
// A phone with nothing to do (done writing, voted, its own prompt, the reveal, the scores) is
// also sent what the host screen shows, so a group can play without a shared screen. The fields
// that carry it are optional: a phone that is busy writing or voting never gets them, which
// keeps those messages small.
import { HOUSE, HOUSE_NAME, NO_ANSWER, authorsOf, currentItem, isFinalRound, isSafety, player, present, promptCount, tasksFor, timeLeft, timerLength, votableFinal, votersFor, type Duel, type Game, type Item, type Lines } from './logic';
import { leaders, place, standings } from './record';

/** A player as the phones show them. */
export interface Face { name: string; color: number }
/** A voter or a writer, and whether they are done. */
export interface Tick extends Face { done: boolean }
/** One line of the scoreboard; `gain` is what this round added. */
export interface Row extends Face { place: number; score: number; gain: number }
/**
 * A head-to-head answer at the reveal: who wrote it, who voted for it, what it earned.
 * `safety`: the prompt's stock answer, sent untouched (half points). Three-line duels: `lines`,
 * and `house` when the game wrote it.
 */
export interface Side { text: string; empty: boolean; by: Face; votes: number; points: number; backers: Face[]; sweep: boolean; safety?: boolean; lines?: string[]; house?: boolean }
/** One side of a head-to-head or three-line duel before the reveal (no author). `lines`: three-line duels only. */
export interface Choice { id: 'a' | 'b'; text: string; empty: boolean; lines?: string[] }
/** A final-round answer at the reveal. */
export interface Card { text: string; by: Face; votes: number; points: number }
/** The revealed prompt as the host screen shows it (final answers most votes first). */
export type Shown = { kind: 'duel' | 'lines'; prompt: string; sides: Side[] } | { kind: 'final'; prompt: string; cards: Card[] };

export type Screen =
  | { k: 'lobby'; players: number; who?: Face[] }
  /** Joined mid-round: plays from the next round. `writers` while the others write. */
  | { k: 'late'; writers?: Tick[] }
  /**
   * Prompts still to answer; empty when this player is done, and then `writers` says who is still
   * writing. `safety`: the prompt's stock answer for "Give me one". `lines`: a three-line duel.
   */
  | { k: 'write'; tasks: { i: number; prompt: string; safety?: string }[]; total: number; writers?: Tick[]; lines?: boolean }
  /** A three-line duel's lines appearing one at a time before its vote (every phone, nobody busy). */
  | { k: 'show'; at: number; prompt: string; sides: Choice[] }
  /**
   * `empty`: that author sent no answer, so it cannot be voted for. Once this phone has voted,
   * or the prompt is its own: `voters` (who has voted) and, on its own prompt, `mine` (its side).
   */
  | { k: 'vote'; at: number; prompt: string; choices: Choice[]; own: boolean; voted: 'a' | 'b' | null; mine?: 'a' | 'b'; voters?: Tick[] }
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
  /** The final is three-line duels (sent only when chosen). */
  duels?: boolean;
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
    ...(g.settings.final === 'duels' ? { duels: true } : {}),
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
      const tasks = tasksFor(g, pid).map((i) => task(g.items[i], i));
      const lines = g.items[0]?.kind === 'lines' ? { lines: true } : {};
      return { k: 'write', tasks, total: promptCount(g, pid), ...lines, ...(tasks.length ? {} : { writers: writers(g) }) };
    }
    case 'show':
      if (item?.kind !== 'lines') return { k: 'late' };
      return { k: 'show', at: g.at, prompt: item.prompt, sides: [choice(item, 'a'), choice(item, 'b')] };
    case 'vote':
      if (!item) return { k: 'late' };
      return item.kind === 'final' ? finalVote(g, item, pid) : duelVote(g, item, pid);
    case 'reveal': {
      const r = item?.result;
      return { k: 'reveal', gain: r && pid in r.points ? r.points[pid] : null, ...(item && r ? { show: shown(g, item) } : {}) };
    }
    case 'scores': return { k: 'scores', place: place(g, me.score), rows: rows(g) };
    case 'over': return { k: 'over', place: place(g, me.score), winners: leaders(g).map((x) => x.name), rows: rows(g) };
  }
}

const task = (item: Item, i: number) => (item.kind === 'duel' && item.safety ? { i, prompt: item.prompt, safety: item.safety } : { i, prompt: item.prompt });

/** One side without its author: a head-to-head answer, or a three-line duel's lines. */
function choice(item: Duel | Lines, id: 'a' | 'b'): Choice {
  if (item.kind === 'duel') {
    const text = item.answers[item[id]];
    return { id, text: text ?? NO_ANSWER, empty: text == null };
  }
  const lines = item.answers[item[id]];
  return { id, text: lines ? lines.join(' / ') : NO_ANSWER, empty: lines == null, lines: lines ?? [NO_ANSWER] };
}

function duelVote(g: Game, item: Duel | Lines, pid: string): Screen {
  const ballot = item.ballots[pid];
  const voted = ballot === undefined ? null : ballot === item.a ? 'a' : 'b';
  // Everyone present who is not a voter wrote one of the two answers.
  const own = !votersFor(g, item).includes(pid);
  return {
    k: 'vote',
    at: g.at,
    prompt: item.prompt,
    choices: [choice(item, 'a'), choice(item, 'b')],
    own,
    voted,
    ...(own ? { mine: pid === item.a ? ('a' as const) : ('b' as const) } : {}),
    ...(own || voted ? { voters: voters(g, item) } : {}),
  };
}

function finalVote(g: Game, item: Extract<Item, { kind: 'final' }>, pid: string): Screen {
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
export const voters = (g: Game, item: Item): Tick[] => votersFor(g, item).map((pid) => ({ ...faceOf(g, pid), done: pid in item.ballots }));

/** The scoreboard: highest first, shared places for ties, this round's points beside each. */
export function rows(g: Game): Row[] {
  const gain = (pid: string) => g.items.reduce((n, it) => n + (it.result?.points[pid] ?? 0), 0);
  return standings(g).map((p) => ({ ...face(p), place: place(g, p.score), score: p.score, gain: gain(p.pid) }));
}

/** A revealed prompt: each answer's author, voters and points. */
export function shown(g: Game, item: Item): Shown {
  const r = item.result!;
  if (item.kind !== 'final') {
    const sides = (['a', 'b'] as const).map((id): Side => {
      const pid = item[id];
      const { text, empty, lines } = choice(item, id);
      return {
        text, empty,
        by: pid === HOUSE ? { name: HOUSE_NAME, color: 0 } : faceOf(g, pid),
        votes: r.votes[pid] ?? 0,
        points: r.points[pid] ?? 0,
        backers: Object.keys(item.ballots).filter((v) => item.ballots[v] === pid).map((v) => faceOf(g, v)),
        sweep: r.sweep === pid,
        ...(isSafety(item, pid) ? { safety: true } : {}),
        ...(lines ? { lines } : {}),
        ...(pid === HOUSE ? { house: true } : {}),
      };
    });
    return { kind: item.kind, prompt: item.prompt, sides };
  }
  const cards = item.authors
    .filter((pid) => item.answers[pid] != null)
    .map((pid) => ({ text: item.answers[pid]!, by: faceOf(g, pid), votes: r.votes[pid] ?? 0, points: r.points[pid] ?? 0 }))
    .sort((x, y) => y.votes - x.votes);
  return { kind: 'final', prompt: item.prompt, cards };
}
