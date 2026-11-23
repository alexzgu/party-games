// What this phone remembers about Community packs, by game and Community id, on the phone only:
// which of its own packs came from (or were shared as) each one, and which it skips. A leaf module
// (content.ts reaches it through shareLog.svelte.ts). Packs imported before this was kept have no
// Community id and read as not owned.
import { load, save } from './storage';

const KEY = 'community:marks';
interface Marks {
  /** Community pack → the ids of this phone's packs imported from it or shared as it. */
  owned: Record<string, string[]>;
  skipped: Record<string, true>;
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

/** As stored, anything broken left out (the store may have changed in another tab, so each change reads it first). */
function stored(): Marks {
  const raw = load<Record<string, unknown>>(KEY, {});
  const owned = Object.entries(isObj(raw.owned) ? raw.owned : {})
    .flatMap(([k, ids]) => (Array.isArray(ids) ? [[k, ids.filter((x) => typeof x === 'string')] as const] : []));
  const skipped = Object.keys(isObj(raw.skipped) ? raw.skipped : {}).map((k) => [k, true] as const);
  return { owned: Object.fromEntries(owned), skipped: Object.fromEntries(skipped) };
}

let marks = $state.raw<Marks>(stored());

function change(next: (m: Marks) => Marks): void {
  marks = next(stored());
  save(KEY, marks);
}

/** Read again what another tab may have changed. */
export function rereadMarks(): void { marks = stored(); }

const slot = (game: string, id: string) => `${game}:${id}`;

/** The packs on this phone imported from this Community pack, or shared as it (some may be deleted since). */
export const localIdsOf = (game: string, id: string): readonly string[] => marks.owned[slot(game, id)] ?? [];

export function noteOwned(game: string, id: string, localIds: readonly string[]): void {
  const k = slot(game, id);
  change((m) => ({ ...m, owned: { ...m.owned, [k]: [...new Set([...(m.owned[k] ?? []), ...localIds])] } }));
}

/** A pack of `game` got a new id on this phone. */
export function moveOwned(game: string, from: string, to: string): void {
  const move = ([k, ids]: [string, string[]]): [string, string[]] => [k, k.startsWith(`${game}:`) ? ids.map((x) => (x === from ? to : x)) : ids];
  change((m) => ({ ...m, owned: Object.fromEntries(Object.entries(m.owned).map(move)) }));
}

export const isSkipped = (game: string, id: string): boolean => marks.skipped[slot(game, id)] === true;

export function setSkipped(game: string, id: string, on: boolean): void {
  change((m) => {
    const { [slot(game, id)]: _, ...rest } = m.skipped;
    return { ...m, skipped: on ? { ...rest, [slot(game, id)]: true } : rest };
  });
}
