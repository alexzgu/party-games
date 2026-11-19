// Snark Tank's rules as pure functions over the host's game state. The host screen is the only
// place this runs; phones only see what view.ts derives for them. Every function returns a new
// state (or the same object when nothing changed) so the host can save and send after each step.
import { assignPrompts } from './assign';
import { FINAL_VOTES_EACH, scoreDuel, scoreFinal, validFinalBallot, type Result } from './scoring';
import { shuffle } from '../../lib/random';

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 8;
export const ANSWER_MAX = 80;
export const NAME_MAX = 14;
export const NO_ANSWER = '(no answer)';
export const REVEAL_MS = 9000;
export const FINAL_REVEAL_MS = 15000;
export const SCORES_MS = 15000;
/** After a host reload, a running timer gets at least this long so phones can reconnect. */
export const RELOAD_GRACE_MS = 12000;
export const ANSWER_CHOICES = [45, 75, 90, 120] as const;
export const VOTE_CHOICES = [10, 15, 20, 30] as const;

export interface Settings {
  /** 2: one head-to-head round, then the final. 3: two head-to-head rounds (the second doubled), then the final. */
  rounds: 2 | 3;
  answerSecs: number;
  voteSecs: number;
  packIds: string[];
}

export const DEFAULT_SETTINGS: Settings = { rounds: 3, answerSecs: 75, voteSecs: 15, packIds: ['classic'] };

export interface Player {
  pid: string;
  name: string;
  /** Seat colour, kept when the player leaves and rejoins. */
  color: number;
  score: number;
  /** In the current round. Players who join mid-round watch until the next one starts. */
  active: boolean;
  kicked?: boolean;
}

/** A head-to-head prompt: two authors, everyone else votes for one answer. */
export interface Duel {
  kind: 'duel';
  prompt: string;
  a: string;
  b: string;
  /** Author → answer; null once writing closed without one. Missing while still writing. */
  answers: Record<string, string | null>;
  /** Voter → the author they picked. */
  ballots: Record<string, string>;
  result?: Result;
}

/** The final prompt: everyone answers, everyone spreads three votes over the others' answers. */
export interface Finale {
  kind: 'final';
  prompt: string;
  /** Authors in the order their answers are shown. */
  authors: string[];
  answers: Record<string, string | null>;
  /** Voter → author → votes given. */
  ballots: Record<string, Record<string, number>>;
  result?: Result;
}

export type Item = Duel | Finale;
export type Phase = 'lobby' | 'write' | 'vote' | 'reveal' | 'scores' | 'over';

export interface Game {
  code: string;
  settings: Settings;
  players: Player[];
  phase: Phase;
  /** 0 in the lobby, then 1 … settings.rounds. */
  round: number;
  /** This round's prompts, in the order they are voted on. */
  items: Item[];
  /** The prompt on screen while voting and revealing. */
  at: number;
  /** When the running timer ends (ms since epoch), null when nothing is timed or paused. */
  deadline: number | null;
  /** Time left on the timer while paused. */
  paused: number | null;
  /** One line per prompt played, for History. */
  log: string[];
  /** History has its entry for this game. */
  recorded: boolean;
  /** Ended by the host before the final. */
  ended?: boolean;
  nextColor: number;
}

export type Draw = (count: number) => string[];

export function newGame(code: string, settings: Settings): Game {
  return { code, settings, players: [], phase: 'lobby', round: 0, items: [], at: 0, deadline: null, paused: null, log: [], recorded: false, nextColor: 0 };
}

export const isFinalRound = (g: Game, round = g.round) => round >= g.settings.rounds;
export const multiplier = (g: Game) => (isFinalRound(g) ? 3 : g.round);
export const present = (g: Game) => g.players.filter((p) => !p.kicked);
export const player = (g: Game, pid: string) => g.players.find((p) => p.pid === pid);
export const currentItem = (g: Game): Item | undefined => (g.phase === 'vote' || g.phase === 'reveal' ? g.items[g.at] : undefined);
export const authorsOf = (item: Item) => (item.kind === 'duel' ? [item.a, item.b] : item.authors);

/** Trims and collapses spaces; empty when nothing usable was typed. */
export const cleanName = (raw: string) => raw.trim().replace(/\s+/g, ' ').slice(0, NAME_MAX);
export const cleanAnswer = (raw: string) => raw.trim().replace(/\s+/g, ' ').slice(0, ANSWER_MAX);

export type JoinResult = { game: Game; pid: string; error?: undefined } | { game: Game; pid?: undefined; error: string };

/**
 * A phone asks to join with the id it keeps in localStorage and a name. A known id rejoins as
 * itself (same score); a known name whose phone is offline is taken over (a phone that lost its
 * storage); a name in use by an online phone is refused. Joining mid-game watches until the next round.
 */
export function join(g: Game, pid: string, rawName: string, online: ReadonlySet<string>): JoinResult {
  const known = player(g, pid);
  if (known?.kicked) return { game: g, error: 'The host removed you from this game.' };
  if (known) return { game: g, pid };
  const name = cleanName(rawName);
  if (!name) return { game: g, error: 'Type your name first.' };
  const same = present(g).find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (same && online.has(same.pid)) return { game: g, error: `Someone here is already called ${same.name}. Pick another name.` };
  if (same) return { game: g, pid: same.pid };
  if (present(g).length >= MAX_PLAYERS) return { game: g, error: `This game is full (${MAX_PLAYERS} players).` };
  const p: Player = { pid, name, color: g.nextColor, score: 0, active: g.phase === 'lobby' };
  return { game: { ...g, players: [...g.players, p], nextColor: g.nextColor + 1 }, pid };
}

/** A kicked player stays on the list, marked, so their phone cannot rejoin this game; screens hide them. */
export function kick(g: Game, pid: string): Game {
  return { ...g, players: g.players.map((p) => (p.pid === pid ? { ...p, kicked: true, active: false } : p)) };
}

export const canStart = (g: Game) => g.phase === 'lobby' && present(g).length >= MIN_PLAYERS;

/** How many prompts the next round needs. */
export const promptsNeeded = (g: Game) => (isFinalRound(g, g.round + 1) ? 1 : present(g).length);

/** Starts the next round: everyone present plays (late joiners included), prompts dealt. */
export function startRound(g: Game, draw: Draw, now: number, rand: () => number = Math.random): Game {
  const round = g.round + 1;
  const players = g.players.map((p) => ({ ...p, active: !p.kicked }));
  const pids = players.filter((p) => p.active).map((p) => p.pid);
  const final = isFinalRound(g, round);
  if (pids.length < (final ? 2 : MIN_PLAYERS)) return finish({ ...g, players });
  const prompts = draw(final ? 1 : pids.length);
  const items: Item[] = final
    ? [{ kind: 'final', prompt: prompts[0], authors: shuffle(pids, rand), answers: {}, ballots: {} }]
    : assignPrompts(pids, prompts, rand).map((x) => ({ kind: 'duel', ...x, answers: {}, ballots: {} }));
  return { ...g, players, round, items, at: 0, phase: 'write', deadline: now + g.settings.answerSecs * 1000, paused: null };
}

/** The prompts a player still has to answer this round (indices into items). */
export function tasksFor(g: Game, pid: string): number[] {
  if (g.phase !== 'write') return [];
  return g.items.flatMap((item, i) => (authorsOf(item).includes(pid) && !(pid in item.answers) ? [i] : []));
}

export const promptCount = (g: Game, pid: string) => g.items.filter((item) => authorsOf(item).includes(pid)).length;

export function answer(g: Game, pid: string, index: number, raw: string): Game {
  const item = g.items[index];
  const text = cleanAnswer(raw);
  if (g.phase !== 'write' || !item || !text || !authorsOf(item).includes(pid) || pid in item.answers) return g;
  if (player(g, pid)?.kicked) return g;
  return { ...g, items: g.items.map((x, i) => (i === index ? { ...x, answers: { ...x.answers, [pid]: text } } : x)) };
}

/** Everyone still in the game who has a prompt has answered it. */
export function writingDone(g: Game): boolean {
  const here = new Set(present(g).map((p) => p.pid));
  return g.items.every((item) => authorsOf(item).every((pid) => !here.has(pid) || pid in item.answers));
}

/** Who may vote on an item: everyone present except its authors (final: everyone with someone else's answer to pick). */
export function votersFor(g: Game, item: Item): string[] {
  const pids = present(g).map((p) => p.pid);
  if (item.kind === 'duel') return pids.filter((pid) => pid !== item.a && pid !== item.b);
  return pids.filter((pid) => votableFinal(item, pid).length > 0);
}

/** Final-round answers a player may vote for: real answers that are not their own. */
export const votableFinal = (item: Finale, pid: string) => item.authors.filter((a) => a !== pid && item.answers[a] != null);

export function vote(g: Game, pid: string, choice: 'a' | 'b'): Game {
  const item = currentItem(g);
  if (g.phase !== 'vote' || item?.kind !== 'duel' || pid in item.ballots || !votersFor(g, item).includes(pid)) return g;
  return withItem(g, { ...item, ballots: { ...item.ballots, [pid]: item[choice] } });
}

/** A final-round ballot from a phone: votes keyed by position in the shown answers. */
export function voteFinal(g: Game, pid: string, byPosition: Record<string, number>): Game {
  const item = currentItem(g);
  if (g.phase !== 'vote' || item?.kind !== 'final' || pid in item.ballots || !votersFor(g, item).includes(pid)) return g;
  const ballot: Record<string, number> = {};
  for (const [pos, n] of Object.entries(byPosition)) {
    const author = item.authors[Number(pos)];
    if (author === undefined || typeof n !== 'number') return g;
    if (n > 0) ballot[author] = (ballot[author] ?? 0) + n;
  }
  if (!validFinalBallot(pid, ballot, new Set(votableFinal(item, pid)))) return g;
  return withItem(g, { ...item, ballots: { ...item.ballots, [pid]: ballot } });
}

/** Every voter whose phone is connected has voted (and at least one has). */
export function votingDone(g: Game, online: ReadonlySet<string>): boolean {
  const item = currentItem(g);
  if (!item) return false;
  const waiting = votersFor(g, item).filter((pid) => online.has(pid));
  return waiting.length > 0 && waiting.every((pid) => pid in item.ballots);
}

/** The timer has run out (never while paused). */
export const timeUp = (g: Game, now: number) => g.deadline !== null && now >= g.deadline;

/**
 * Moves the game on when the current step is complete or its timer has run out. Returns the
 * same object when nothing changed. `draw` supplies prompts when a new round starts.
 */
export function tick(g: Game, now: number, online: ReadonlySet<string>, draw: Draw): Game {
  if (g.paused !== null) return g;
  const done =
    (g.phase === 'write' && writingDone(g)) ||
    (g.phase === 'vote' && votingDone(g, online)) ||
    ((g.phase === 'write' || g.phase === 'vote' || g.phase === 'reveal' || g.phase === 'scores') && timeUp(g, now));
  return done ? step(g, now, draw) : g;
}

/** The host's Skip: ends the current step now, whatever is still missing. */
export function step(g: Game, now: number, draw: Draw): Game {
  const live = g.paused !== null ? { ...g, paused: null } : g;
  switch (live.phase) {
    case 'write': return openVote(closeWriting(live), 0, now);
    case 'vote': return closeVote(live, now);
    case 'reveal':
      if (live.at + 1 < live.items.length) return openVote(live, live.at + 1, now);
      if (isFinalRound(live)) return finish(live);
      return { ...live, phase: 'scores', deadline: now + SCORES_MS };
    case 'scores': return startRound(live, draw, now);
    default: return g;
  }
}

function closeWriting(g: Game): Game {
  const items = g.items.map((item) => {
    const answers = { ...item.answers };
    for (const pid of authorsOf(item)) if (!(pid in answers)) answers[pid] = null;
    return { ...item, answers };
  });
  return { ...g, items };
}

/** Shows prompt `at` for voting; a prompt nobody can vote on goes straight to its reveal. */
function openVote(g: Game, at: number, now: number): Game {
  const item = g.items[at];
  const real = authorsOf(item).filter((pid) => item.answers[pid] != null);
  const next = { ...g, at, phase: 'vote' as const, paused: null };
  if (real.length === 0 || votersFor(g, item).length === 0) return closeVote(next, now);
  const secs = item.kind === 'final' ? g.settings.voteSecs * 2 : g.settings.voteSecs;
  return { ...next, deadline: now + secs * 1000 };
}

function closeVote(g: Game, now: number): Game {
  const item = g.items[g.at];
  const result = item.kind === 'duel' ? scoreDuel(item.a, item.b, item.ballots, multiplier(g)) : scoreFinal(item.authors, item.ballots);
  const players = g.players.map((p) => ({ ...p, score: p.score + (result.points[p.pid] ?? 0) }));
  const next = withItem({ ...g, players }, { ...item, result } as Item);
  const ms = item.kind === 'final' ? FINAL_REVEAL_MS : REVEAL_MS;
  return { ...next, phase: 'reveal', deadline: now + ms, log: [...g.log, logLine(next, item, result)] };
}

function logLine(g: Game, item: Item, result: Result): string {
  const best = authorsOf(item)
    .filter((pid) => item.answers[pid] != null)
    .sort((x, y) => result.votes[y] - result.votes[x])[0];
  if (!best) return `${item.prompt} → nobody answered`;
  return `${item.prompt} → “${item.answers[best]}” (${player(g, best)?.name ?? '?'}, ${result.votes[best]} ${result.votes[best] === 1 ? 'vote' : 'votes'})`;
}

const withItem = (g: Game, item: Item): Game => ({ ...g, items: g.items.map((x, i) => (i === g.at ? item : x)) });

export function finish(g: Game): Game {
  return { ...g, phase: 'over', deadline: null, paused: null };
}

/** The host ends the game before the final. */
export const endEarly = (g: Game): Game => ({ ...finish(g), ended: true });

export function pause(g: Game, now: number): Game {
  if (g.deadline === null || g.paused !== null) return g;
  return { ...g, paused: Math.max(0, g.deadline - now), deadline: null };
}

export function resume(g: Game, now: number): Game {
  if (g.paused === null) return g;
  return { ...g, deadline: now + g.paused, paused: null };
}

/** After the host screen reloads: a timer that ran out (or nearly) while it was gone gets a little time back. */
export function afterReload(g: Game, now: number): Game {
  if (g.deadline === null || (g.phase !== 'write' && g.phase !== 'vote')) return g;
  return g.deadline < now + RELOAD_GRACE_MS ? { ...g, deadline: now + RELOAD_GRACE_MS } : g;
}

/** Same players, scores back to zero, back in the lobby. */
export function rematch(g: Game): Game {
  const players = present(g).map((p) => ({ ...p, score: 0, active: true }));
  return { ...newGame(g.code, g.settings), players, nextColor: g.nextColor };
}

/** The full length of the current step's timer (ms), for drawing how much is left. */
export function timerLength(g: Game): number {
  const item = g.items[g.at];
  switch (g.phase) {
    case 'write': return g.settings.answerSecs * 1000;
    case 'vote': return g.settings.voteSecs * 1000 * (item?.kind === 'final' ? 2 : 1);
    case 'reveal': return item?.kind === 'final' ? FINAL_REVEAL_MS : REVEAL_MS;
    case 'scores': return SCORES_MS;
    default: return 0;
  }
}

/** Time left on the running timer (ms), null when nothing is timed. */
export const timeLeft = (g: Game, now: number) => (g.paused !== null ? g.paused : g.deadline === null ? null : Math.max(0, g.deadline - now));

export { FINAL_VOTES_EACH };
