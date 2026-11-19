// Pure game rules for Earworm: every step takes a state and returns the next one, so the
// screens stay thin and each step can be saved and unit-tested. Audio lives in audio.ts.
import type { Song } from '../../lib/content';
import type { HistoryEntry } from '../../lib/history';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 12;
/** Clip lengths in seconds: Play gives the first, each "Longer" the next. */
export const CLIPS = [2, 5, 10] as const;
/** Points for naming the song at each clip length. */
export const POINTS = [3, 2, 1] as const;

export interface Player { name: string; score: number }

/** ready: Play button · listen: clip playing, host taps who got it · reveal: the answer · scores · win */
export type Phase = 'ready' | 'listen' | 'reveal' | 'scores' | 'win';

export type Outcome = { kind: 'point'; scorer: number; points: number } | { kind: 'nobody' };

/** A song played to the end (skipped ones are not): who got it (-1 nobody) and for how many points. */
export interface PlayedSong { title: string; artist: string; by: number; points: number }

/** Saved-game format. 1 was the YouTube version; those saves cannot carry on (see retiredRecord). */
export const VERSION = 2;

export interface GameState {
  v: typeof VERSION;
  players: Player[];
  target: number;
  packIds: string[];
  phase: Phase;
  /** The song on the ready, listen and reveal screens. */
  song: Song | null;
  /** The song after this one, chosen at the reveal so its preview can load early. */
  upcoming: Song | null;
  /** Clip length index into CLIPS. */
  step: number;
  outcome: Outcome | null;
  songsPlayed: number;
  /** Songs used this game (played or skipped, by songKey), so none comes up twice. */
  dealt: string[];
  /** Songs Apple had no preview for, for the history entry. */
  skipped: string[];
  log: PlayedSong[];
}

export interface GameOptions { target: number; packIds: string[] }

export function newGame(names: string[], opts: GameOptions, first: Song | null): GameState {
  if (names.length < MIN_PLAYERS) throw new Error(`Need at least ${MIN_PLAYERS} players`);
  return {
    v: VERSION,
    players: names.map((name) => ({ name, score: 0 })),
    target: opts.target,
    packIds: opts.packIds,
    phase: 'ready',
    song: first,
    upcoming: null,
    step: 0,
    outcome: null,
    songsPlayed: 0,
    dealt: first ? [songKey(first)] : [],
    skipped: [],
    log: [],
  };
}

/** A song's identity for dealing: its Apple track id. */
export const songKey = (s: Pick<Song, 'apple'>) => String(s.apple);

const withDealt = (dealt: string[], song: Song | null) => (song && !dealt.includes(songKey(song)) ? [...dealt, songKey(song)] : dealt);

/** Play was tapped: the room hears the shortest clip. */
export function listen(s: GameState): GameState {
  if (s.phase !== 'ready' || !s.song) return s;
  return { ...s, phase: 'listen', step: 0, outcome: null };
}

/** "Longer": the next clip length, worth fewer points. */
export function longer(s: GameState): GameState {
  if (s.phase !== 'listen' || s.step >= CLIPS.length - 1) return s;
  return { ...s, step: s.step + 1 };
}

export const clipSeconds = (s: Pick<GameState, 'step'>) => CLIPS[Math.min(s.step, CLIPS.length - 1)];
export const pointsNow = (s: Pick<GameState, 'step'>) => POINTS[Math.min(s.step, POINTS.length - 1)];

/** Someone named it: points by how long the clip was. */
export function award(s: GameState, scorer: number): GameState {
  if (s.phase !== 'listen' || !s.players[scorer]) return s;
  const points = pointsNow(s);
  const players = s.players.map((p, i) => (i === scorer ? { ...p, score: p.score + points } : p));
  return { ...s, players, phase: 'reveal', outcome: { kind: 'point', scorer, points }, songsPlayed: s.songsPlayed + 1, log: logged(s, scorer, points) };
}

export function nobody(s: GameState): GameState {
  if (s.phase !== 'listen') return s;
  return { ...s, phase: 'reveal', outcome: { kind: 'nobody' }, songsPlayed: s.songsPlayed + 1, log: logged(s, -1, 0) };
}

const logged = (s: GameState, by: number, points: number): PlayedSong[] =>
  [...s.log, { title: s.song?.title ?? '', artist: s.song?.artist ?? '', by, points }];

/** Wrong name tapped: take the points back and return to the same clip. */
export function undo(s: GameState): GameState {
  if (s.phase !== 'reveal' || !s.outcome) return s;
  const o = s.outcome;
  const players = o.kind === 'point' ? s.players.map((p, i) => (i === o.scorer ? { ...p, score: p.score - o.points } : p)) : s.players;
  return { ...s, players, phase: 'listen', outcome: null, songsPlayed: s.songsPlayed - 1, log: s.log.slice(0, -1) };
}

/** The song after this one is chosen (at the reveal), so its preview loads while the room cheers. */
export function setUpcoming(s: GameState, song: Song | null): GameState {
  return { ...s, upcoming: song, dealt: withDealt(s.dealt, song) };
}

/**
 * Swap the current song for another without a penalty: the host skipped it, or its preview
 * would not play (`broken`, kept for the history entry). Back to the shortest clip.
 */
export function replaceSong(s: GameState, song: Song | null, broken = false): GameState {
  const skipped = broken && s.song ? [...s.skipped, `${s.song.title} — ${s.song.artist}`] : s.skipped;
  return { ...s, song, step: 0, skipped, dealt: withDealt(s.dealt, song) };
}

/** The upcoming song could not load: pick another before the room gets to it. */
export function replaceUpcoming(s: GameState, song: Song | null): GameState {
  const skipped = s.upcoming ? [...s.skipped, `${s.upcoming.title} — ${s.upcoming.artist}`] : s.skipped;
  return { ...s, upcoming: song, skipped, dealt: withDealt(s.dealt, song) };
}

/** Index of the player who reached the target, or -1. Ties at the top go to the higher score. */
export function winner(s: GameState): number {
  const top = standings(s)[0];
  return top && top.player.score >= s.target ? top.index : -1;
}

/** reveal → scores (or the win screen); scores → ready with the upcoming song. */
export function next(s: GameState): GameState {
  if (s.phase === 'reveal') return winner(s) >= 0 ? { ...s, phase: 'win' } : { ...s, phase: 'scores' };
  if (s.phase === 'scores') return { ...s, phase: 'ready', song: s.upcoming, upcoming: null, step: 0, outcome: null };
  return s;
}

/** Same players and packs, scores back to zero. */
export function rematch(s: GameState): GameState {
  return {
    ...s,
    players: s.players.map((p) => ({ ...p, score: 0 })),
    phase: 'ready', song: s.upcoming, upcoming: null, step: 0, outcome: null, songsPlayed: 0, skipped: [], log: [],
  };
}

/** Players ordered for the scoreboard: highest score first, ties keep seating order. */
export function standings(s: Pick<GameState, 'players'>): { player: Player; index: number }[] {
  return s.players.map((player, index) => ({ player, index })).sort((a, b) => b.player.score - a.player.score || a.index - b.index);
}

/** The history entry for a finished game: "Sam won 10–7–3", every score, one line per song. */
export function gameRecord(s: GameState, packs: string[]): Omit<HistoryEntry, 'id' | 'at'> {
  const rows = standings(s);
  return { ...entry(s, packs, `${rows[0]?.player.name ?? 'Nobody'} won ${line(rows)}`), finished: true };
}

/** The entry for a game thrown away before a winner, or null when no song was played. */
export function endedRecord(s: GameState, packs: string[]): Omit<HistoryEntry, 'id' | 'at'> | null {
  if (s.phase === 'win' || s.songsPlayed === 0) return null;
  if (winner(s) >= 0) return gameRecord(s, packs);
  const rows = standings(s);
  const best = rows[0].player.score;
  const leaders = rows.filter((r) => r.player.score === best).map((r) => r.player.name);
  const lead = best === 0 ? 'Nobody scored' : leaders.length === 1 ? `${leaders[0]} led` : leaders.length === 2 ? `${leaders.join(' and ')} tied` : `${leaders.length}-way tie`;
  return { ...entry(s, packs, `${lead} ${line(rows)}`), finished: false };
}

const line = (rows: { player: Player }[]) => rows.map((r) => r.player.score).join('–');

function entry(s: GameState, packs: string[], title: string): Omit<HistoryEntry, 'id' | 'at'> {
  const played = s.log.map((x) => `${x.title} — ${x.artist}: ${x.by >= 0 ? `${s.players[x.by]?.name ?? '?'} +${x.points}` : 'nobody'}`);
  const skipped = s.skipped.map((x) => `Skipped (its preview would not play): ${x}`);
  return {
    game: 'song',
    title,
    scores: standings(s).map((r) => ({ name: r.player.name, score: r.player.score })),
    packs,
    details: [...played, ...skipped],
  };
}

/** Cleans a typed name and reports why it cannot be added, if it cannot. */
export function checkName(raw: string, existing: string[]): { name: string; error: string } {
  const name = raw.trim().replace(/\s+/g, ' ').slice(0, 18);
  if (!name) return { name, error: 'Type a name first.' };
  if (existing.some((n) => n.toLowerCase() === name.toLowerCase())) return { name, error: `${name} is already playing.` };
  if (existing.length >= MAX_PLAYERS) return { name, error: `${MAX_PLAYERS} players is the most.` };
  return { name, error: '' };
}

const num = (x: unknown, min: number, max = Infinity): x is number => typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;
const strings = (x: unknown): x is string[] => Array.isArray(x) && x.every((v) => typeof v === 'string');
export const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
/** The latest start a pack may set: the 10-second clip must end inside a 30-second preview. */
export const MAX_START = 19.5;
export const isSong = (x: unknown): x is Song => {
  const k = x as Song | null;
  return !!k && typeof k.title === 'string' && k.title !== '' && typeof k.artist === 'string'
    && Number.isInteger(k.apple) && k.apple > 0
    && (k.start === undefined || num(k.start, 0, MAX_START))
    && (k.youtube === undefined || (typeof k.youtube === 'string' && YOUTUBE_ID.test(k.youtube)));
};
const isPlayed = (x: unknown): x is PlayedSong => {
  const k = x as PlayedSong | null;
  return !!k && typeof k.title === 'string' && typeof k.artist === 'string' && Number.isInteger(k.by) && num(k.points, 0);
};

/** A saved game, or null if missing or damaged, so a bad save falls back to setup. */
export function validGame(x: unknown): GameState | null {
  const s = x as GameState | null;
  if (!s || typeof s !== 'object' || s.v !== VERSION || !Array.isArray(s.players) || s.players.length < MIN_PLAYERS) return null;
  if (!s.players.every((p) => typeof p?.name === 'string' && num(p.score, 0))) return null;
  if (!['ready', 'listen', 'reveal', 'scores', 'win'].includes(s.phase)) return null;
  if (!num(s.target, 1) || !num(s.songsPlayed, 0) || !Number.isInteger(s.step) || !num(s.step, 0, CLIPS.length - 1)) return null;
  if (!strings(s.packIds)) return null;
  const song = isSong(s.song) ? s.song : null;
  if ((s.phase === 'listen' || s.phase === 'reveal') && !song) return null;
  if (s.phase === 'reveal') {
    const o = s.outcome;
    if (!o || !['point', 'nobody'].includes(o.kind)) return null;
    if (o.kind === 'point' && !(Number.isInteger(o.scorer) && o.scorer >= 0 && o.scorer < s.players.length && num(o.points, 0))) return null;
  }
  return {
    ...s,
    song,
    upcoming: isSong(s.upcoming) ? s.upcoming : null,
    outcome: s.phase === 'reveal' ? s.outcome : null,
    dealt: strings(s.dealt) ? s.dealt : [],
    skipped: strings(s.skipped) ? s.skipped : [],
    log: Array.isArray(s.log) ? s.log.filter(isPlayed) : [],
  };
}

/**
 * A game saved by the YouTube version (format 1) cannot carry on. Its History entry, as if it
 * had been ended early (null when nothing was played or it was already won), so no score is lost.
 */
export function retiredRecord(x: unknown, packs: string[]): Omit<HistoryEntry, 'id' | 'at'> | null {
  const s = x as GameState | null;
  if (!s || typeof s !== 'object' || (s.v as number) !== 1 || !Array.isArray(s.players) || s.players.length < MIN_PLAYERS) return null;
  if (!s.players.every((p) => typeof p?.name === 'string' && num(p.score, 0)) || !num(s.songsPlayed, 0) || !num(s.target, 1)) return null;
  const old: GameState = {
    ...s, v: VERSION, phase: s.phase === 'win' ? 'win' : 'scores', song: null, upcoming: null, step: 0, outcome: null, dealt: [],
    skipped: strings(s.skipped) ? s.skipped : [], log: Array.isArray(s.log) ? s.log.filter(isPlayed) : [],
  };
  return endedRecord(old, packs);
}

export interface SetupPrefs { packIds: string[] | null; target: number }
export const DEFAULT_SETUP: SetupPrefs = { packIds: null, target: 10 };
export const TARGET_RANGE = [3, 30] as const;

export function validSetup(x: unknown): SetupPrefs {
  const p = (x && typeof x === 'object' ? x : {}) as Partial<SetupPrefs>;
  return {
    packIds: strings(p.packIds) ? p.packIds : DEFAULT_SETUP.packIds,
    target: Number.isInteger(p.target) && num(p.target, TARGET_RANGE[0], TARGET_RANGE[1]) ? (p.target as number) : DEFAULT_SETUP.target,
  };
}
