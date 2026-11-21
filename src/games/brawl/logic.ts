export const DRAW_DELIVERY_MS = 1000;
export const DRAW_TIMES = [60, 90, 120, 180] as const;
export type Settings = { seconds: number; packs: string[] };
export const DEFAULT_SETTINGS: Settings = { seconds: 90, packs: ['classic'] };
export type Phase = 'lobby' | 'draw' | 'challenge' | 'title' | 'vote' | 'payout' | 'tag' | 'scores' | 'over';
export type Side = 0 | 1;
export type Pair<T> = [T, T];
export type Player = { pid: string; name: string; score: number };
export type Fighter = { id: string; name: string };
export type Bout = { title: string; artists: Pair<string>; fighters: Pair<Fighter | null>; surprise: string };
export type Result = {
  title: string; fighters: Pair<Fighter | null>; artists: Pair<string>;
  votes: Pair<number>; points: Pair<number>; winner: Side | null; rematch: boolean;
};
export type Game = {
  id: string; code: string; settings: Settings; phase: Phase; round: number; at: number;
  players: Player[]; kicked: string[]; titles: string[]; bouts: Bout[]; index: number;
  votes: Record<string, Side>; tags: Record<string, string>; shown: Record<string, Fighter[]>;
  rematch: boolean; results: Result[]; deadline: number | null; frozen: number | null;
  /** Players out by their own choice ("Leave room"), among `kicked` until they come back. */
  left?: string[];
};

export const newGame = (id: string, code: string, settings: Settings): Game => ({
  id, code, settings, phase: 'lobby', round: 0, at: 0, players: [], kicked: [], titles: [],
  bouts: [], index: 0, votes: {}, tags: {}, shown: {}, rematch: false, results: [], deadline: null, frozen: null,
});

export const active = (g: Game) => g.players.filter((p) => !g.kicked.includes(p.pid));
export const standings = (g: Game) => [...g.players].sort((a, b) => b.score - a.score);
export const current = (g: Game) => g.bouts[g.index];
export const left = (g: Game, now: number) => g.frozen ?? (g.deadline === null ? null : Math.max(0, g.deadline - now));
export const canStart = (g: Game) => g.phase === 'lobby' && active(g).length >= 3;
export const pause = (g: Game, now: number): Game => ({ ...g, frozen: left(g, now) });
export const resume = (g: Game, now: number): Game => g.frozen === null ? g : { ...g, deadline: now + g.frozen, frozen: null };
export const afterReload = (g: Game, now: number): Game => g.deadline !== null && g.deadline <= now ?
  { ...g, deadline: now + 12000 } : g;

export function join(g: Game, pid: string, name: string, online: ReadonlySet<string>) {
  name = name.trim().slice(0, 20);
  if (!pid || Object.hasOwn(Object.prototype, pid) || !name) return { error: 'Enter a player name to join.' };
  const gone = g.left ?? [];
  if (gone.includes(pid)) {
    if (active(g).length >= 8) return { error: 'This room is full.' };
    return { pid, game: { ...g, kicked: g.kicked.filter((x) => x !== pid), left: gone.filter((x) => x !== pid) } };
  }
  if (g.kicked.includes(pid)) return { error: 'The host removed you from this room.' };
  const own = g.players.find((p) => p.pid === pid);
  if (own) return { pid, game: g };
  const match = active(g).find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (match) return online.has(match.pid) ? { error: 'That name is already in use.' } : { pid: match.pid, game: g };
  if (active(g).length >= 8) return { error: 'This room is full.' };
  return { pid, game: { ...g, players: [...g.players, { pid, name, score: 0 }] } };
}

export function kick(g: Game, pid: string): Game {
  return { ...g, kicked: [...g.kicked, pid], left: (g.left ?? []).filter((x) => x !== pid),
    players: g.phase === 'lobby' ? g.players.filter((p) => p.pid !== pid) : g.players };
}

/** The player chose "Leave room": in the lobby they are simply gone; mid-game out like a removed player, but free to come back. */
export function leave(g: Game, pid: string): Game {
  if (!active(g).some((p) => p.pid === pid)) return g;
  if (g.phase === 'lobby') return { ...g, players: g.players.filter((p) => p.pid !== pid) };
  return { ...g, kicked: [...g.kicked, pid], left: [...(g.left ?? []), pid] };
}

function enter(g: Game, phase: Phase, now: number, seconds?: number): Game {
  return { ...g, phase, at: g.at + 1, deadline: seconds === undefined ? null : now + seconds * 1000, frozen: null };
}

export function startRound(g: Game, ring: string[], now: number): Game {
  if (ring.length < 2) return enter(g, 'over', now);
  const titles = [...g.titles];
  const round = g.round + 1;
  const bouts = ring.map((pid, i): Bout => ({
    title: titles.shift()!, artists: [pid, ring[(i + 1) % ring.length]], fighters: [null, null],
    surprise: round === 2 ? titles.shift()! : '',
  }));
  return enter({ ...g, round, titles, bouts, index: 0, rematch: false }, 'draw', now, g.settings.seconds);
}

export function task(g: Game, pid: string) {
  if (g.phase !== 'draw' && g.phase !== 'challenge') return null;
  const side = g.phase === 'draw' ? 0 : 1;
  const index = g.bouts.findIndex((b) => b.artists[side] === pid);
  if (index < 0) return null;
  const b = g.bouts[index];
  return { index, side, fighter: b.fighters[side], opponent: side === 1 ? b.fighters[0] : null,
    title: side === 0 ? b.title : null, id: `${g.id}/${g.at}/${index}` } as const;
}

export function submit(g: Game, pid: string, at: number, name: string): Game {
  const t = task(g, pid);
  if (at !== g.at || !t || t.fighter || g.kicked.includes(pid)) return g;
  const bouts = g.bouts.map((b, i) => {
    if (i !== t.index) return b;
    const fighters: Bout['fighters'] = [...b.fighters];
    fighters[t.side] = { id: t.id, name: name.trim().slice(0, 30) || 'Nameless' };
    return { ...b, fighters };
  });
  return { ...g, bouts };
}

export const tagOptions = (g: Game, pid: string) => {
  const b = current(g);
  const side = b.artists.indexOf(pid);
  return side < 0 ? [] : (g.shown[pid] ?? []).filter((f) => f.id !== b.fighters[side]?.id);
};

export function tag(g: Game, pid: string, at: number, id: string): Game {
  if (g.phase !== 'tag' || g.at !== at || !current(g).artists.includes(pid) || g.kicked.includes(pid) ||
    Object.hasOwn(g.tags, pid) || (id && !tagOptions(g, pid).some((f) => f.id === id))) return g;
  return { ...g, tags: { ...g.tags, [pid]: id } };
}

export function canVote(g: Game, pid: string): boolean {
  return g.phase === 'vote' && !current(g).artists.includes(pid) && active(g).some((p) => p.pid === pid);
}

export function vote(g: Game, pid: string, at: number, side: Side): Game {
  return g.at === at && canVote(g, pid) && !Object.hasOwn(g.votes, pid)
    ? { ...g, votes: { ...g.votes, [pid]: side } } : g;
}

export function fighters(g: Game): Bout['fighters'] {
  const b = current(g);
  if (!g.rematch || g.phase === 'tag') return b.fighters;
  const pick = (side: Side) => {
    const pid = b.artists[side];
    return g.shown[pid]?.find((f) => f.id === g.tags[pid]) ?? b.fighters[side];
  };
  return [pick(0), pick(1)];
}

export function payout(purse: number, votes: Pair<number>, present: Pair<boolean>): Pair<number> {
  if (!present[0] || !present[1]) return [present[0] ? purse : 0, present[1] ? purse : 0];
  const total = votes[0] + votes[1];
  const a = total ? Math.round(purse * votes[0] / total) : purse / 2;
  return [a, purse - a + Math.round((purse - a) / 10)];
}

function settle(g: Game, now: number): Game {
  const b = current(g);
  const cards = fighters(g);
  const votes: Pair<number> = [0, 0];
  for (const side of Object.values(g.votes)) votes[side]++;
  const points = payout(g.round === 1 ? 1000 : 2000, votes, [!!cards[0], !!cards[1]]);
  const winner = points[0] === points[1] ? null : points[0] > points[1] ? 0 : 1;
  if (g.rematch && winner !== null && !g.tags[b.artists[winner]]) points[winner] += 500;
  const result: Result = { title: g.rematch ? b.surprise : b.title, artists: b.artists, fighters: cards,
    votes, points, winner, rematch: g.rematch };
  const players = g.players.map((p) => ({ ...p, score: p.score + (points[b.artists.indexOf(p.pid)] ?? 0) }));
  return enter({ ...g, players, results: [...g.results, result] }, 'payout', now, 8);
}

function nextBout(g: Game, now: number): Game {
  if (g.index >= g.bouts.length) return enter(g, g.round === 1 ? 'scores' : 'over', now, g.round === 1 ? 15 : undefined);
  const b = current(g);
  const reset = { ...g, votes: {}, tags: {}, rematch: false };
  if (b.fighters.some(Boolean)) return enter(reset, 'title', now, 3);
  if (g.round === 2 && b.artists.some((pid) => g.shown[pid]?.length)) {
    return enter({ ...reset, rematch: true }, 'tag', now, 15);
  }
  return nextBout({ ...reset, index: g.index + 1 }, now);
}

function show(g: Game, now: number): Game {
  const b = current(g);
  const cards = fighters(g);
  const shown = { ...g.shown };
  cards.forEach((card, side) => {
    const pid = b.artists[side];
    if (card && !shown[pid]?.some((f) => f.id === card.id)) shown[pid] = [...(shown[pid] ?? []), card];
  });
  const next = enter({ ...g, shown }, 'vote', now, 15);
  return cards.every(Boolean) ? next : settle(next, now);
}

export function step(g: Game, now: number, ring: () => string[]): Game {
  switch (g.phase) {
    case 'draw': return enter(g, 'challenge', now, g.settings.seconds);
    case 'challenge': return nextBout(g, now);
    case 'title': return show(g, now);
    case 'vote': return settle(g, now);
    case 'payout': return g.round === 2 && !g.rematch
      ? enter({ ...g, rematch: true, votes: {} }, 'tag', now, 15)
      : nextBout({ ...g, index: g.index + 1 }, now);
    case 'tag': {
      const next = { ...g, phase: 'title' } as const;
      return fighters(next).some(Boolean) ? show(next, now) : nextBout({ ...next, index: g.index + 1 }, now);
    }
    case 'scores': return startRound(g, ring(), now);
    default: return g;
  }
}

export function tick(g: Game, now: number, online: ReadonlySet<string>, ring: () => string[]): Game {
  if (g.frozen !== null || g.deadline === null) return g;
  const drawing = g.phase === 'draw' || g.phase === 'challenge';
  // The phone sends its last draft at zero. Leave one second for it to reach the host.
  if (g.deadline + (drawing ? DRAW_DELIVERY_MS : 0) <= now) return step(g, now, ring);
  const here = active(g).filter((p) => online.has(p.pid));
  const done = drawing
    ? here.every((p) => { const t = task(g, p.pid); return !t || !!t.fighter; })
    : g.phase === 'vote' ? here.every((p) => !canVote(g, p.pid) || Object.hasOwn(g.votes, p.pid))
    : g.phase === 'tag' && current(g).artists.every((pid) => !online.has(pid) || Object.hasOwn(g.tags, pid));
  return here.length && done ? step(g, now, ring) : g;
}
