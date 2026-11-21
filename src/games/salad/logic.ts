import { asPhrase, draftFor, random, redeal, sentence, shuffled, type Draft } from './deal';
import { matches, normalise } from './match';
import { GUESS_MAX, NAME_MAX, type ToHost } from './protocol';
import { followups, opening, type Secret } from './words';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
export const PICK_MS = 20_000;
export const PREPARE_MS = 30_000;
export const PRESENT_MS = 75_000;
/** How long a presenter's turn waits, clock stopped, for their phone to come back. */
export const AWAY_MS = 60_000;
const REVEAL_MS = 9_000;
const SCORES_MS = 15_000;

export type Phase = 'lobby' | 'pick' | 'prepare' | 'present' | 'reveal' | 'scores' | 'over';
export interface Player {
  pid: string;
  name: string;
  seat: number;
  score: number;
  roundPoints: number;
  /** Out of the game: removed by the host, or `left` by their own choice (they may come back). */
  kicked: boolean;
  left?: boolean;
}
interface Turn {
  pid: string;
  offers: Secret[];
  secret: Secret | null;
  reshuffled: boolean;
  draft: Draft | null;
  first: string | null;
}
export interface Guess { id: number; pid: string; text: string; request: string }
export interface Result {
  answer: string;
  winner: string | null;
  winningGuess: string | null;
  points: Record<string, number>;
  assistPoints: Record<string, number>;
  reason: 'solved' | 'timeout' | 'offline' | 'skipped';
}
export interface Game {
  code: string;
  phase: Phase;
  round: number;
  at: number;
  serial: number;
  deadline: number | null;
  paused: number | null;
  /** When the presenter's phone dropped: their turn is on hold, its clock stopped, until they return or AWAY_MS passes. */
  offlineSince: number | null;
  players: Player[];
  order: string[];
  turns: Turn[];
  packIds: string[];
  pool: Secret[];
  used: string[];
  seed: number;
  sentences: string[];
  guesses: Guess[];
  assists: number[];
  result: Result | null;
  solved: number;
  total: number;
  log: string[];
  recorded: boolean;
}

export function newGame(code: string, packIds = ['classic'], pool: Secret[] = [], seed = 1): Game {
  return {
    code, packIds, pool, seed, phase: 'lobby', round: 0, at: 0, serial: 0,
    deadline: null, paused: null, offlineSince: null, players: [], order: [], turns: [],
    used: [], sentences: [], guesses: [], assists: [], result: null, solved: 0, total: 0,
    log: [], recorded: false,
  };
}

export const present = (g: Game) => g.players.filter((p) => !p.kicked);
export const canStart = (g: Game) => g.phase === 'lobby' && present(g).length >= MIN_PLAYERS && g.pool.length > 0;
export const currentTurn = (g: Game) => g.turns[g.at];
export const timerLength = (g: Game) =>
  ({ lobby: 0, pick: PICK_MS, prepare: PREPARE_MS, present: PRESENT_MS, reveal: REVEAL_MS, scores: SCORES_MS, over: 0 })[g.phase];
export const timeLeft = (g: Game, now: number) =>
  g.paused ?? (g.deadline === null ? null : Math.max(0, g.deadline - (g.offlineSince ?? now)));
/** The presenter's phone is away, so their turn waits. */
export const held = (g: Game) => g.phase === 'present' && g.offlineSince !== null;

type Join = { game: Game; pid: string; error?: undefined } | { game: Game; error: string; pid?: undefined };
export function join(g: Game, pid: string, rawName: string, online: ReadonlySet<string>): Join {
  const known = g.players.find((p) => p.pid === pid);
  if (known?.kicked && !known.left) return { game: g, error: 'The host removed you from this game.' };
  if (known?.left) return present(g).length >= MAX_PLAYERS ? { game: g, error: 'This room is full.' } : { game: back(g, pid), pid };
  if (known) return { game: g, pid };
  const name = rawName.trim().replace(/\s+/g, ' ').slice(0, NAME_MAX);
  if (!name) return { game: g, error: 'Type your name first.' };
  const same = present(g).find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (same && online.has(same.pid)) return { game: g, error: 'That name is already in use.' };
  if (same) return { game: g, pid: same.pid };
  if (present(g).length >= MAX_PLAYERS) return { game: g, error: 'This room is full.' };
  const player = { pid, name, seat: g.players.length, score: 0, roundPoints: 0, kicked: false };
  return { game: { ...g, players: [...g.players, player] }, pid };
}

export function kick(g: Game, pid: string): Game {
  return { ...g, players: g.players.map((p) => p.pid === pid ? { ...p, kicked: true, left: false } : p) };
}

/** The player chose "Leave room": out like a removed player (no more turns), but free to come back. */
export function leave(g: Game, pid: string): Game {
  if (!g.players.some((p) => p.pid === pid && !p.kicked)) return g;
  return { ...g, players: g.players.map((p) => p.pid === pid ? { ...p, kicked: true, left: true } : p) };
}

const back = (g: Game, pid: string): Game =>
  ({ ...g, players: g.players.map((p) => p.pid === pid ? { ...p, kicked: false, left: false } : p) });

function advance(g: Game, phase: Phase, now: number): Game {
  const next = { ...g, phase, serial: g.serial + 1, paused: null, offlineSince: null };
  const span = timerLength(next);
  return { ...next, deadline: span ? now + span : null };
}

function offer(g: Game, others: Turn[], prior: Secret[], rand: () => number): Secret[] {
  const taken = new Set([...g.used, ...others.flatMap((t) => t.secret ? [t.secret.answer] : t.offers.map((s) => s.answer))]);
  const previous = new Set(prior.map((s) => s.answer));
  const available = shuffled(g.pool, rand).filter((s) => !taken.has(s.answer));
  const ranked = [...available.filter((s) => !previous.has(s.answer)), ...available.filter((s) => previous.has(s.answer))];
  const easy = ranked.find((s) => s.level === 'easy');
  const harder = ranked.filter((s) => s.level !== 'easy');
  const second = harder.find((s) => s.category !== easy?.category) ?? harder[0];
  const third = harder.find((s) => s !== second && s.category !== second?.category && s.category !== easy?.category)
    ?? harder.find((s) => s !== second && s.category !== second?.category)
    ?? harder.find((s) => s !== second);
  const choices = [easy, second, third].filter((s): s is Secret => !!s);
  // Small custom packs can exhaust a difficulty or category before a round is fully dealt.
  const fallback = [...ranked, ...g.pool];
  for (const secret of fallback) {
    if (choices.length === 3) break;
    if (!choices.includes(secret)) choices.push(secret);
  }
  return choices;
}

export function startRound(g: Game, now: number): Game {
  const order = present(g).map((p) => p.pid);
  if (!order.length || !g.pool.length || g.round >= 2) return advance(g, 'over', now);
  const turns: Turn[] = [];
  const rand = random(g.seed + g.round);
  for (const pid of order) {
    turns.push({ pid, offers: offer(g, turns, [], rand), secret: null, reshuffled: false, first: null, draft: null });
  }
  return advance({
    ...g, round: g.round + 1, at: 0, order, turns, result: null, guesses: [], sentences: [], assists: [],
    players: g.players.map((p) => ({ ...p, roundPoints: 0 })),
  }, 'pick', now);
}

function updateTurn(g: Game, turn: Turn): Game {
  return { ...g, turns: g.turns.map((t) => t.pid === turn.pid ? turn : t) };
}

function prepare(g: Game, now: number): Game {
  const rand = random(g.seed + g.serial);
  const turns = g.turns.map((turn) => {
    const secret = turn.secret ?? turn.offers[0];
    return { ...turn, secret, draft: draftFor(secret, opening[secret.category], 0, rand) };
  });
  return advance({ ...g, turns, used: [...g.used, ...turns.map((turn) => turn.secret.answer)] }, 'prepare', now);
}

const openingText = (draft: Draft) =>
  sentence(draft.frame, draft.values.map((value, slot) => value ?? draft.choices[slot][0]));

function nextDraft(g: Game, turn: Turn, index: number): Draft {
  const secret = turn.secret!;
  const frames = followups[secret.category];
  let next = index;
  // Comparison frames need an actual guess before they can be filled.
  while (!g.guesses.length && frames[next % frames.length].slots.includes('guess')) next++;
  return draftFor(secret, frames[next % frames.length], next, random(g.seed + g.serial * 1009 + next));
}

function beginTurn(g: Game, at: number, now: number, online?: ReadonlySet<string>): Game {
  if (at >= g.turns.length) return advance({ ...g, at }, 'scores', now);
  const turn = g.turns[at];
  const next = advance({
    ...g, at, result: null, sentences: [turn.first!], guesses: [], assists: [],
  }, 'present', now);
  if (!present(g).some((p) => p.pid === turn.pid) || (online && !online.has(turn.pid))) {
    return reveal(next, now, 'offline');
  }
  return updateTurn(next, { ...turn, draft: nextDraft(next, turn, 0) });
}

function reveal(g: Game, now: number, reason: Result['reason'], winner: string | null = null): Game {
  const turn = currentTurn(g);
  const secret = turn.secret!;
  const points = Object.create(null) as Record<string, number>;
  const assistPoints = Object.create(null) as Record<string, number>;
  if (winner !== null) {
    const remaining = timeLeft(g, now)! / PRESENT_MS;
    const payout = Math.round((200 + 800 * remaining) * g.round * (secret.level === 'easy' ? 0.5 : 1));
    points[turn.pid] = payout;
    points[winner] = payout;
    for (const id of g.assists) {
      const author = g.guesses[id].pid;
      assistPoints[author] = (assistPoints[author] ?? 0) + 100;
      points[author] = (points[author] ?? 0) + 100;
    }
  }
  const solved = winner !== null;
  return advance({
    ...g, result: {
      answer: secret.answer, winner, winningGuess: solved ? g.guesses.at(-1)!.text : null,
      points, assistPoints, reason,
    },
    solved: g.solved + Number(solved), total: g.total + 1,
    log: [...g.log, `${secret.answer} · ${solved ? 'Solved' : 'Unsolved'}`],
    players: g.players.map((p) => ({
      ...p, score: p.score + (points[p.pid] ?? 0), roundPoints: p.roundPoints + (points[p.pid] ?? 0),
    })),
  }, 'reveal', now);
}

export function step(g: Game, now: number, online?: ReadonlySet<string>, manual = true): Game {
  switch (g.phase) {
    case 'pick': return prepare(g, now);
    case 'prepare': return beginTurn({
      ...g, turns: g.turns.map((t) => ({ ...t, first: t.first ?? openingText(t.draft!) })),
    }, 0, now, online);
    case 'present': return reveal(g, now, manual ? 'skipped' : 'timeout');
    case 'reveal': return beginTurn(g, g.at + 1, now, online);
    case 'scores': return g.round === 2 ? advance(g, 'over', now) : startRound(g, now);
    default: return g;
  }
}

function ready(g: Game): boolean {
  if (g.phase !== 'pick' && g.phase !== 'prepare') return false;
  const active = new Set(present(g).map((p) => p.pid));
  return g.turns.every((turn) => !active.has(turn.pid) || (g.phase === 'pick' ? turn.secret : turn.first));
}

export function tick(g: Game, now: number, online: ReadonlySet<string>): Game {
  if (g.paused !== null) return g;
  const presenter = g.phase === 'present' ? currentTurn(g).pid : null;
  if (presenter !== null && !present(g).some((p) => p.pid === presenter)) return reveal(g, now, 'offline');
  if (presenter !== null && !online.has(presenter)) return hold(g, now);
  if (g.offlineSince !== null) return carryOn(g, now);
  if (ready(g) || (g.deadline !== null && now >= g.deadline)) return step(g, now, online, false);
  return g;
}

/** The presenter is away: their turn waits, clock stopped, then is given up after AWAY_MS. */
function hold(g: Game, now: number): Game {
  if (g.offlineSince === null) return { ...g, offlineSince: now };
  return now - g.offlineSince >= AWAY_MS ? reveal(g, now, 'offline') : g;
}

/** The presenter is back: the clock carries on from where it stopped. */
function carryOn(g: Game, now: number): Game {
  const away = now - g.offlineSince!;
  return { ...g, offlineSince: null, deadline: g.deadline === null ? null : g.deadline + away };
}

export function choicesFor(g: Game, draft: Draft): string[][] {
  return draft.choices.map((choices, slot) =>
    draft.frame.slots[slot] === 'guess' ? g.guesses.map((guess) => String(guess.id)) : choices);
}

type Compose = Extract<ToHost, { t: 'word' | 'more' | 'publish' | 'skipFrame' }>;
function compose(g: Game, turn: Turn, msg: Compose): Game {
  const draft = turn.draft!;
  if (msg.frame !== draft.index) return g;
  if (msg.t === 'word') {
    if (!choicesFor(g, draft)[msg.slot]?.includes(msg.value)) return g;
    const values = draft.values.map((value, slot) => slot === msg.slot ? msg.value : value);
    return updateTurn(g, { ...turn, draft: { ...draft, values } });
  }
  if (msg.t === 'more') {
    const rand = random(g.seed + g.serial * 1009 + draft.index * 31 + draft.redeals);
    const next = redeal(turn.secret!, draft, msg.slot, rand);
    return next === draft ? g : updateTurn(g, { ...turn, draft: next });
  }
  if (msg.t === 'skipFrame') {
    return g.phase === 'present' ? updateTurn(g, { ...turn, draft: nextDraft(g, turn, draft.index + 1) }) : g;
  }
  if (draft.values.some((value) => value === null)) return g;
  if (g.phase === 'prepare') return updateTurn(g, { ...turn, first: openingText(draft) });
  const used = draft.values.flatMap((value, i) => draft.frame.slots[i] === 'guess' ? [Number(value)] : []);
  const words = draft.values.map((value, i) => draft.frame.slots[i] === 'guess' ? asPhrase(g.guesses[Number(value)].text) : value!);
  return updateTurn({
    ...g, sentences: [...g.sentences, sentence(draft.frame, words)], assists: [...new Set([...g.assists, ...used])],
  }, { ...turn, draft: nextDraft(g, turn, draft.index + 1) });
}

function guess(g: Game, pid: string, msg: Extract<ToHost, { t: 'guess' }>, now: number): Game {
  const turn = currentTurn(g);
  if (pid === turn.pid || g.guesses.some((a) => a.pid === pid && a.request === msg.id)) return g;
  const text = msg.text.trim().replace(/\s+/g, ' ').slice(0, GUESS_MAX);
  if (!normalise(text)) return g;
  const next = { ...g, guesses: [...g.guesses, { id: g.guesses.length, pid, text, request: msg.id }] };
  return matches(text, turn.secret!) ? reveal(next, now, 'solved', pid) : next;
}

export function fromPhone(g: Game, pid: string, msg: ToHost, now: number): Game {
  if (g.serial !== msg.serial || g.paused !== null || held(g) || !present(g).some((p) => p.pid === pid)
    || (g.deadline !== null && now >= g.deadline)) return g;
  if (msg.t === 'guess') return g.phase === 'present' ? guess(g, pid, msg, now) : g;
  const turn = g.turns.find((t) => t.pid === pid);
  if (!turn) return g;
  if (g.phase === 'pick' && !turn.secret) {
    if (msg.t === 'pick' && turn.offers[msg.index] && msg.reshuffled === turn.reshuffled) {
      return updateTurn(g, { ...turn, secret: turn.offers[msg.index] });
    }
    if (msg.t === 'reshuffle' && !turn.reshuffled) {
      const offers = offer(g, g.turns.filter((t) => t !== turn), turn.offers, random(g.seed + g.serial + g.order.indexOf(pid)));
      return updateTurn(g, { ...turn, offers, reshuffled: true });
    }
  }
  if (msg.t === 'pick' || msg.t === 'reshuffle') return g;
  const canCompose = (g.phase === 'prepare' && !turn.first) || (g.phase === 'present' && currentTurn(g) === turn);
  return canCompose && turn.draft ? compose(g, turn, msg) : g;
}

export function pause(g: Game, now: number): Game {
  return g.paused === null && g.deadline !== null ? { ...g, paused: timeLeft(g, now), deadline: null } : g;
}
export function resume(g: Game, now: number): Game {
  return g.paused === null ? g : { ...g, deadline: now + g.paused, paused: null, offlineSince: null };
}
export function afterReload(g: Game, now: number): Game {
  const h = g.offlineSince !== null ? carryOn(g, now) : g;
  return {
    ...h, offlineSince: null,
    deadline: h.deadline !== null && h.deadline <= now ? now + 12_000 : h.deadline,
  };
}
export function rematch(g: Game): Game {
  return {
    ...newGame(g.code, g.packIds, g.pool, g.seed + 2), serial: g.serial + 1,
    players: g.players.map((p) => ({ ...p, score: 0, roundPoints: 0 })),
  };
}
