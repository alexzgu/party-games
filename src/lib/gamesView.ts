// The Games page's choices (pages/Games.svelte): the order, the categories picked, the phone's
// own categories and when each game was last opened. Kept on the phone
// (gamesPage.svelte.ts), never in the address; read defensively, since storage may hold anything.
import { GAME_TAGS, GAMES, type GameId, type GameInfo } from '../app.config';

export type Order = 'default' | 'az' | 'recent';
export const ORDERS: readonly Order[] = ['default', 'az', 'recent'];

/** A category made on this phone. */
export interface OwnCategory { id: string; name: string; games: GameId[] }

/** A chip on the Games page: a default category (from the games' `tags`) or one of the phone's. */
export interface Category { id: string; name: string; games: GameId[]; own: boolean }

export interface GamesState {
  order: Order;
  /** The categories picked; a game shows only when it is in every one. */
  picked: string[];
  own: OwnCategory[];
  /** When each game was last opened from the Games page (ms since 1970). */
  opened: Partial<Record<GameId, number>>;
}

export const MAX_OWN = 20;
export const NAME_MAX = 20;
/** No category may be called "All": it would read like the box with nothing picked ("All categories"). */
const ALL = 'All';
/** Names an own category cannot take: every default category's, and "All". */
const RESERVED: readonly string[] = [...GAME_TAGS, ALL];

export const EMPTY: GamesState = { order: 'default', picked: [], own: [], opened: {} };

const IDS = new Set<string>(GAMES.map((g) => g.id));
const isGame = (x: unknown): x is GameId => typeof x === 'string' && IDS.has(x);
const tagId = (tag: string) => `tag:${tag}`;

/** The default categories that have games, in `GAME_TAGS` order, then the phone's own. */
export function categories(own: readonly OwnCategory[], games: readonly GameInfo[] = GAMES): Category[] {
  const defaults = GAME_TAGS.map((tag) => ({ id: tagId(tag), name: tag, games: games.filter((g) => g.tags.includes(tag)).map((g) => g.id), own: false }));
  return [...defaults.filter((c) => c.games.length), ...own.map((c) => ({ ...c, own: true }))];
}

/**
 * The games to show: in every picked category, in the chosen order. Recent
 * goes by `opened`, by default the stored times (the page passes the ones it opened with).
 */
export function shownGames(s: GamesState, games: readonly GameInfo[] = GAMES, opened = s.opened): GameInfo[] {
  const picked = categories(s.own, games).filter((c) => s.picked.includes(c.id));
  const fit = games.filter((g) => picked.every((c) => c.games.includes(g.id)));
  return sortGames(fit, s.order, opened);
}

/** Default: as listed; A–Z by name; Recent: last opened first, never-opened after in default order. */
export function sortGames(games: readonly GameInfo[], order: Order, opened: GamesState['opened']): GameInfo[] {
  const list = [...games];
  if (order === 'az') return list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  if (order === 'recent') return list.sort((a, b) => (opened[b.id] ?? 0) - (opened[a.id] ?? 0));
  return list;
}

/** Spaces collapsed and trimmed. */
export const tidyName = (name: string): string => name.replace(/\s+/g, ' ').trim();

/** Why a category name cannot be used, or '' when it can; `self` is the category being renamed. */
export function nameProblem(name: string, own: readonly OwnCategory[], self?: string): string {
  const n = tidyName(name);
  if (!n) return 'Give it a name.';
  if ([...n].length > NAME_MAX) return `At most ${NAME_MAX} characters.`;
  const taken = [...RESERVED, ...own.filter((c) => c.id !== self).map((c) => c.name)];
  if (taken.some((t) => same(t, n))) return 'There is already a category with that name.';
  return '';
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
/** Games in app order, each once, known ones only. */
const inOrder = (ids: readonly unknown[]): GameId[] => GAMES.map((g) => g.id).filter((id) => ids.includes(id));

/** An id no own category has yet. */
export function nextId(own: readonly OwnCategory[]): string {
  let i = own.length + 1;
  while (own.some((c) => c.id === `own${i}`)) i++;
  return `own${i}`;
}

/** Saves a new own category, or a changed one (same id); refused when its name cannot be used or there are too many. */
export function putCategory(s: GamesState, c: OwnCategory): GamesState | string {
  const problem = nameProblem(c.name, s.own, c.id);
  if (problem) return problem;
  const tidy = { id: c.id, name: tidyName(c.name), games: inOrder(c.games) };
  const at = s.own.findIndex((x) => x.id === c.id);
  if (at < 0 && s.own.length >= MAX_OWN) return `At most ${MAX_OWN} categories.`;
  return { ...s, own: at < 0 ? [...s.own, tidy] : s.own.map((x, i) => (i === at ? tidy : x)) };
}

export const deleteCategory = (s: GamesState, id: string): GamesState =>
  ({ ...s, own: s.own.filter((c) => c.id !== id), picked: s.picked.filter((p) => p !== id) });

/** Picks a category, or unpicks it when it was picked. */
export const togglePick = (s: GamesState, id: string): GamesState =>
  ({ ...s, picked: s.picked.includes(id) ? s.picked.filter((p) => p !== id) : [...s.picked, id] });

/** No category picked. */
export const clearFilters = (s: GamesState): GamesState => ({ ...s, picked: [] });

/** The closed categories box: "All categories", the one picked, or the first picked "+ N" more (in chip order). */
export function pickedLabel(cats: readonly Category[], picked: readonly string[]): string {
  const on = cats.filter((c) => picked.includes(c.id));
  if (!on.length) return 'All categories';
  return on.length === 1 ? on[0].name : `${on[0].name} + ${on.length - 1}`;
}

export const markOpened = (s: GamesState, id: GameId, at: number): GamesState => ({ ...s, opened: { ...s.opened, [id]: at } });

/** The stored choices, keeping only what still makes sense (known games, names that pass, ids that exist). */
export function readState(raw: unknown): GamesState {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const own = readOwn(r.own);
  const ids = new Set(categories(own).map((c) => c.id));
  const picked = Array.isArray(r.picked) ? [...new Set(r.picked.filter((p): p is string => typeof p === 'string' && ids.has(p)))] : [];
  return { order: ORDERS.includes(r.order as Order) ? (r.order as Order) : 'default', picked, own, opened: readOpened(r.opened) };
}

/**
 * The phone's own categories as stored: a broken one, or one repeating an earlier one's id or name,
 * is dropped; one whose name a default category has since taken keeps its games under a free name.
 */
function readOwn(x: unknown): OwnCategory[] {
  const own: OwnCategory[] = [];
  for (const c of Array.isArray(x) ? x : []) {
    if (own.length >= MAX_OWN || !c || typeof c !== 'object' || typeof c.id !== 'string' || !/^own\d{1,6}$/.test(c.id)) continue;
    const name = typeof c.name === 'string' ? tidyName(c.name) : '';
    if (!name || [...name].length > NAME_MAX || own.some((o) => o.id === c.id || same(o.name, name))) continue;
    own.push({ id: c.id, name, games: inOrder(Array.isArray(c.games) ? c.games : []) });
  }
  return own.map((c) => (RESERVED.some((r) => same(r, c.name)) ? { ...c, name: freeName(c.name, [...RESERVED, ...own.map((o) => o.name)]) } : c));
}

/** `name` with the first number from 2 up that makes it unlike every name in `taken`, cut to fit. */
export function freeName(name: string, taken: readonly string[]): string {
  for (let n = 2; ; n++) {
    const end = ` ${n}`;
    const next = [...name].slice(0, NAME_MAX - end.length).join('').trimEnd() + end;
    if (!taken.some((t) => same(t, next))) return next;
  }
}

function readOpened(x: unknown): GamesState['opened'] {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return {};
  return Object.fromEntries(Object.entries(x).filter(([id, t]) => isGame(id) && typeof t === 'number' && Number.isFinite(t) && t > 0));
}
