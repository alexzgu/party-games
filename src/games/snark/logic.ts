// Snark Tank's rules as pure functions over the host's game state. The host screen is the only
// place this runs; phones only see what view.ts derives for them. Every function returns a new
// state (or the same object when nothing changed) so the host can save and send after each step.
import { assignPrompts, pairDuels } from './assign';
import { FINAL_VOTES_EACH, halve, scoreDuel, scoreFinal, scoreLines, validFinalBallot, type Result } from './scoring';
import { shuffle } from '../../lib/random';
import { sameName } from '../../lib/room/names';
import type { ToHost } from './protocol';

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 8;
export const ANSWER_MAX = 80;
/** Three-line duels: lines per player and characters per line. */
export const LINES_EACH = 3;
export const LINE_MAX = 40;
/** A three-line duel's lines appear one at a time this far apart before its vote opens. */
export const LINE_STEP_MS = 1500;
/** The player id of the house, the game's own side in a three-line duel (never a phone's id). */
export const HOUSE = '~house';
export const HOUSE_NAME = 'The house';
export const NAME_MAX = 14;
export const NO_ANSWER = '(no answer)';
export const REVEAL_MS = 9000;
export const FINAL_REVEAL_MS = 15000;
export const SCORES_MS = 15000;
/** After a host reload, a running timer gets at least this long so phones can reconnect. */
export const RELOAD_GRACE_MS = 12000;
export const ANSWER_CHOICES = [45, 75, 90, 120] as const;
export const VOTE_CHOICES = [10, 15, 20, 30] as const;
/** The final round: one prompt for everyone with 3 votes each, or three-line duels. */
export type FinalStyle = 'everyone' | 'duels';

export interface Settings {
  /** 2: one head-to-head round, then the final. 3: two head-to-head rounds (the second doubled), then the final. */
  rounds: 2 | 3;
  answerSecs: number;
  voteSecs: number;
  packIds: string[];
  /** Missing in games and settings saved before it existed: 'everyone'. */
  final?: FinalStyle;
}

export const DEFAULT_SETTINGS: Settings = { rounds: 3, answerSecs: 75, voteSecs: 15, packIds: ['classic'], final: 'everyone' };

export interface Player {
  pid: string;
  name: string;
  /** Seat colour, kept when the player leaves and rejoins. */
  color: number;
  score: number;
  /** In the current round. Players who join mid-round watch until the next one starts. */
  active: boolean;
  /** Out of the game: removed by the host, or `left` by their own choice (they may come back). */
  kicked?: boolean;
  left?: boolean;
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
  /** The pack's stock answer for this prompt (cleaned); an answer sent exactly as it is earns half points. */
  safety?: string;
}

/** A three-line duel in the final: two players, or a player and the house, write up to three lines each. */
export interface Lines {
  kind: 'lines';
  prompt: string;
  a: string;
  /** May be HOUSE, whose lines are filled in when the round starts. */
  b: string;
  /** Author → their lines (1–3); null once writing closed without any. Missing while still writing. */
  answers: Record<string, string[] | null>;
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

export type Item = Duel | Finale | Lines;
/** 'show': a three-line duel's lines appear on screen one at a time before its vote opens. */
export type Phase = 'lobby' | 'write' | 'show' | 'vote' | 'reveal' | 'scores' | 'over';

export interface Game {
  code: string;
  /** Which game of this room it is: 0 (or missing), then one more for each Play again. */
  match?: number;
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

/** A dealt prompt: its text, or with its pack's stock answer, or (a final for three-line duels) the house's three lines. */
export type Dealt = string | { prompt: string; safety?: string; house?: readonly string[] };
/** Deals `count` prompts; `kind` 'lines' asks for finals for three-line duels (none when no pack has any). */
export type Draw = (count: number, kind?: 'lines') => Dealt[];

const dealtText = (d: Dealt) => (typeof d === 'string' ? d : d.prompt);

export function newGame(code: string, settings: Settings): Game {
  return { code, settings, players: [], phase: 'lobby', round: 0, items: [], at: 0, deadline: null, paused: null, log: [], recorded: false, nextColor: 0 };
}

export const matchOf = (g: Game) => g.match ?? 0;
export const isFinalRound = (g: Game, round = g.round) => round >= g.settings.rounds;
export const multiplier = (g: Game) => (isFinalRound(g) ? 3 : g.round);
export const present = (g: Game) => g.players.filter((p) => !p.kicked);
/** Players who may still play: present, or gone and free to come back; no two hold names that look the same. */
const inRoom = (g: Game) => g.players.filter((p) => !p.kicked || p.left);
export const player = (g: Game, pid: string) => g.players.find((p) => p.pid === pid);
export const currentItem = (g: Game): Item | undefined => (g.phase === 'show' || g.phase === 'vote' || g.phase === 'reveal' ? g.items[g.at] : undefined);
export const authorsOf = (item: Item) => (item.kind === 'final' ? item.authors : [item.a, item.b]);
/** The answer sent is the prompt's stock answer, untouched (decided here, never by the phone). */
export const isSafety = (item: Item, pid: string) => item.kind === 'duel' && item.safety !== undefined && item.answers[pid] === item.safety;

/** Trims and collapses spaces; empty when nothing usable was typed. */
export const cleanName = (raw: string) => raw.trim().replace(/\s+/g, ' ').slice(0, NAME_MAX);
export const cleanAnswer = (raw: string) => raw.trim().replace(/\s+/g, ' ').slice(0, ANSWER_MAX);
export const cleanLine = (raw: string) => raw.trim().replace(/\s+/g, ' ').slice(0, LINE_MAX);
/** Up to three lines, blanks dropped. */
export const cleanLines = (raw: readonly string[]) => raw.slice(0, LINES_EACH).map(cleanLine).filter(Boolean);
export type JoinResult = { game: Game; pid: string; error?: undefined } | { game: Game; pid?: undefined; error: string };

/**
 * A phone asks to join with the id it keeps in localStorage and a name. A known id rejoins as
 * itself (same score); a known name whose phone is offline is taken over (a phone that lost its
 * storage); a name that looks like one in use by an online phone, or held by a player who left and
 * may come back, is refused. Joining mid-game watches until the next round.
 */
export function join(g: Game, pid: string, rawName: string, online: ReadonlySet<string>): JoinResult {
  if (pid === HOUSE) return { game: g, error: 'This phone cannot join. Reload the page and try again.' };
  const known = player(g, pid);
  if (known?.kicked && !known.left) return { game: g, error: 'The host removed you from this game.' };
  if (known?.left && present(g).length >= MAX_PLAYERS) return { game: g, error: `This game is full (${MAX_PLAYERS} players).` };
  if (known?.left) return { game: { ...g, players: g.players.map((p) => (p.pid === pid ? { ...p, kicked: false, left: false } : p)) }, pid };
  if (known) return { game: g, pid };
  const name = cleanName(rawName);
  if (!name) return { game: g, error: 'Type your name first.' };
  const same = sameName(inRoom(g), name);
  if (same && (same.left || online.has(same.pid))) return { game: g, error: `Someone here is already called ${same.name}. Pick another name.` };
  if (same) return { game: g, pid: same.pid };
  if (present(g).length >= MAX_PLAYERS) return { game: g, error: `This game is full (${MAX_PLAYERS} players).` };
  const p: Player = { pid, name, color: g.nextColor, score: 0, active: g.phase === 'lobby' };
  return { game: { ...g, players: [...g.players, p], nextColor: g.nextColor + 1 }, pid };
}

/** A kicked player stays on the list, marked, so their phone cannot rejoin this game; screens hide them. */
export function kick(g: Game, pid: string): Game {
  return { ...g, players: g.players.map((p) => (p.pid === pid ? { ...p, kicked: true, left: false, active: false } : p)) };
}

/** The player chose "Leave room": out like a removed player (no more prompts or votes), but free to come back. */
export function leave(g: Game, pid: string): Game {
  if (!present(g).some((p) => p.pid === pid)) return g;
  return { ...g, players: g.players.map((p) => (p.pid === pid ? { ...p, kicked: true, left: true } : p)) };
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
  const items = final ? finalItems({ ...g, players }, pids, draw, rand) : duels(pids, draw(pids.length), rand);
  return { ...g, players, round, items, at: 0, phase: 'write', deadline: now + g.settings.answerSecs * 1000, paused: null };
}

function duels(pids: string[], dealt: Dealt[], rand: () => number): Duel[] {
  const safety = new Map(dealt.flatMap((d) => (typeof d !== 'string' && d.safety && cleanAnswer(d.safety) ? [[d.prompt, cleanAnswer(d.safety)]] : [])));
  return assignPrompts(pids, dealt.map(dealtText), rand).map((x) => {
    const stock = safety.get(x.prompt);
    return { kind: 'duel', ...x, answers: {}, ballots: {}, ...(stock ? { safety: stock } : {}) };
  });
}

/** The final's items: three-line duels when chosen and possible, otherwise one prompt for everyone. */
function finalItems(g: Game, pids: string[], draw: Draw, rand: () => number): Item[] {
  const lines = g.settings.final === 'duels' ? lineDuels(g, pids, draw, rand) : null;
  return lines ?? [{ kind: 'final', prompt: dealtText(draw(1)[0]), authors: shuffle(pids, rand), answers: {}, ballots: {} }];
}

/**
 * Random pairs, each with its own final prompt; an odd one out (last place) faces the house.
 * Null when there are no finals to deal, or fewer than 3 players (nobody would be left to vote).
 */
function lineDuels(g: Game, pids: string[], draw: Draw, rand: () => number): Lines[] | null {
  if (pids.length < MIN_PLAYERS) return null;
  const { pairs, alone } = pairDuels(pids, (pid) => player(g, pid)?.score ?? 0, rand);
  const finals = draw(pairs.length + (alone ? 1 : 0), 'lines').flatMap((d) => {
    const house = typeof d === 'string' ? [] : cleanLines(d.house ?? []);
    return house.length ? [{ prompt: dealtText(d), house }] : [];
  });
  if (!finals.length) return null;
  const pick = (i: number) => finals[i % finals.length];
  const items: Lines[] = pairs.map(([a, b], i) => ({ kind: 'lines', prompt: pick(i).prompt, a, b, answers: {}, ballots: {} }));
  if (alone) {
    const f = pick(pairs.length);
    const [a, b] = shuffle([alone, HOUSE], rand);
    items.push({ kind: 'lines', prompt: f.prompt, a, b, answers: { [HOUSE]: f.house }, ballots: {} });
  }
  return shuffle(items, rand);
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
  if (g.phase !== 'write' || !item || item.kind === 'lines' || !text || !authorsOf(item).includes(pid) || pid in item.answers) return g;
  if (player(g, pid)?.kicked) return g;
  return { ...g, items: g.items.map((x, i) => (i === index ? ({ ...x, answers: { ...x.answers, [pid]: text } } as Item) : x)) };
}

/** A player's lines for their three-line duel: at least one non-blank line. */
export function answerLines(g: Game, pid: string, index: number, raw: readonly string[]): Game {
  const item = g.items[index];
  const lines = cleanLines(raw);
  if (g.phase !== 'write' || item?.kind !== 'lines' || !lines.length || !authorsOf(item).includes(pid) || pid in item.answers) return g;
  if (player(g, pid)?.kicked) return g;
  return { ...g, items: g.items.map((x, i) => (i === index ? { ...item, answers: { ...item.answers, [pid]: lines } } : x)) };
}

/** Everyone still in the game who has a prompt has answered it. */
export function writingDone(g: Game): boolean {
  const here = new Set(present(g).map((p) => p.pid));
  return g.items.every((item) => authorsOf(item).every((pid) => !here.has(pid) || pid in item.answers));
}

/** Who may vote on an item: everyone present except its authors (final: everyone with someone else's answer to pick). */
export function votersFor(g: Game, item: Item): string[] {
  const pids = present(g).map((p) => p.pid);
  if (item.kind !== 'final') return pids.filter((pid) => pid !== item.a && pid !== item.b);
  return pids.filter((pid) => votableFinal(item, pid).length > 0);
}

/** Final-round answers a player may vote for: real answers that are not their own. */
export const votableFinal = (item: Finale, pid: string) => item.authors.filter((a) => a !== pid && item.answers[a] != null);

/** A vote for one side of the current head-to-head or three-line duel; never for a side with no answer. */
export function vote(g: Game, pid: string, choice: 'a' | 'b'): Game {
  const item = currentItem(g);
  if (g.phase !== 'vote' || !item || item.kind === 'final' || pid in item.ballots || !votersFor(g, item).includes(pid)) return g;
  if (item.answers[item[choice]] == null) return g;
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

/** An answer or vote from a phone, applied only if it is for the round and prompt now in play. */
export function fromPhone(g: Game, pid: string, msg: ToHost): Game {
  if (msg.t !== 'answer' && msg.t !== 'lines' && msg.t !== 'vote' && msg.t !== 'votes') return g;
  if (msg.r !== g.round || (msg.match ?? matchOf(g)) !== matchOf(g)) return g;
  if (msg.t === 'answer') return answer(g, pid, msg.i, msg.text);
  if (msg.t === 'lines') return answerLines(g, pid, msg.i, msg.lines);
  if (msg.at !== g.at) return g;
  return msg.t === 'vote' ? vote(g, pid, msg.c) : voteFinal(g, pid, msg.v);
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
    ((g.phase === 'write' || g.phase === 'show' || g.phase === 'vote' || g.phase === 'reveal' || g.phase === 'scores') && timeUp(g, now));
  return done ? step(g, now, draw) : g;
}

/** The host's Skip: ends the current step now, whatever is still missing. */
export function step(g: Game, now: number, draw: Draw): Game {
  const live = g.paused !== null ? { ...g, paused: null } : g;
  switch (live.phase) {
    case 'write': return openVote(closeWriting(live), 0, now);
    case 'show': return { ...live, phase: 'vote', deadline: now + voteLength(live, live.items[live.at]) };
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
    return { ...item, answers } as Item;
  });
  return { ...g, items };
}

/**
 * Shows prompt `at` for voting (a three-line duel first shows its lines one at a time); a prompt
 * nobody can vote on goes straight to its reveal.
 */
function openVote(g: Game, at: number, now: number): Game {
  const item = g.items[at];
  const real = authorsOf(item).filter((pid) => item.answers[pid] != null);
  const next = { ...g, at, phase: 'vote' as const, paused: null };
  if (real.length === 0 || votersFor(g, item).length === 0) return closeVote(next, now);
  if (item.kind === 'lines') return { ...next, phase: 'show', deadline: now + showLength(item) };
  return { ...next, deadline: now + voteLength(g, item) };
}

/** Head-to-head votes get the set time; the final's (either kind) twice that. */
const voteLength = (g: Game, item: Item | undefined) => g.settings.voteSecs * 1000 * (item?.kind === 'duel' ? 1 : 2);

/** How many lines (or "(no answer)" placeholders) each side shows. */
export const sideSizes = (item: Lines): [number, number] => [item.a, item.b].map((pid) => Math.max(1, item.answers[pid]?.length ?? 0)) as [number, number];

/** The line-by-line showing: a step for the prompt, one per line, one to read the last line. */
export const showLength = (item: Lines) => (sideSizes(item)[0] + sideSizes(item)[1] + 2) * LINE_STEP_MS;

/** How many lines of each side are on screen `elapsed` ms into the showing: side A's first, then B's. */
export function linesShown(sizes: readonly [number, number], elapsed: number): [number, number] {
  const n = Math.max(0, Math.floor(elapsed / LINE_STEP_MS));
  return [Math.min(n, sizes[0]), Math.min(Math.max(0, n - sizes[0]), sizes[1])];
}

function scoreItem(g: Game, item: Item): Result {
  if (item.kind === 'final') return scoreFinal(item.authors, item.ballots);
  if (item.kind === 'lines') return scoreLines(item.a, item.b, item.ballots, HOUSE);
  const r = scoreDuel(item.a, item.b, item.ballots, multiplier(g));
  return halve(r, [item.a, item.b].filter((pid) => isSafety(item, pid)));
}

function closeVote(g: Game, now: number): Game {
  const item = g.items[g.at];
  const result = scoreItem(g, item);
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
  return `${item.prompt} → “${answerText(item, best)}” (${nameOf(g, best)}, ${result.votes[best]} ${result.votes[best] === 1 ? 'vote' : 'votes'})`;
}

/** An answer as one line of text (three-line answers joined with slashes); NO_ANSWER when none. */
export function answerText(item: Item, pid: string): string {
  const got = item.answers[pid];
  return got == null ? NO_ANSWER : Array.isArray(got) ? got.join(' / ') : got;
}

export const nameOf = (g: Game, pid: string) => (pid === HOUSE ? HOUSE_NAME : player(g, pid)?.name ?? '?');

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

/** Same players, scores back to zero, back in the lobby; the removed stay marked, so they stay out. */
export function rematch(g: Game): Game {
  const players = g.players.filter((p) => !p.left).map((p) => ({ ...p, score: 0, active: !p.kicked }));
  return { ...newGame(g.code, g.settings), match: matchOf(g) + 1, players, nextColor: g.nextColor };
}

/** The full length of the current step's timer (ms), for drawing how much is left. */
export function timerLength(g: Game): number {
  const item = g.items[g.at];
  switch (g.phase) {
    case 'write': return g.settings.answerSecs * 1000;
    case 'show': return item?.kind === 'lines' ? showLength(item) : 0;
    case 'vote': return voteLength(g, item);
    case 'reveal': return item?.kind === 'final' ? FINAL_REVEAL_MS : REVEAL_MS;
    case 'scores': return SCORES_MS;
    default: return 0;
  }
}

/** Time left on the running timer (ms), null when nothing is timed. */
export const timeLeft = (g: Game, now: number) => (g.paused !== null ? g.paused : g.deadline === null ? null : Math.max(0, g.deadline - now));

export { FINAL_VOTES_EACH };
