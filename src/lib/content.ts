// Built-in packs (bundled JSON, precached for offline play) merged with packs players
// make or edit on the phone (saved in localStorage). An edit of a built-in replaces it in place.
import { load, save } from './storage';

export interface WordDeck { id: string; name: string; emoji: string; blurb: string; words: string[]; custom?: boolean }
export interface Spectrum { left: string; right: string }
export interface SpectrumPack { id: string; name: string; blurb: string; cards: Spectrum[]; custom?: boolean }
export interface GibberishCard { phrase: string; answer: string; hint: string }
export interface GibberishPack { id: string; name: string; blurb: string; cards: GibberishCard[]; custom?: boolean }

const wordFiles = import.meta.glob<WordDeck>('../content/forehead/*.json', { eager: true, import: 'default' });
const gibberishFiles = import.meta.glob<GibberishPack>('../content/gibberish/*.json', { eager: true, import: 'default' });
// A dial file holds one pack, or several under `packs` (the original spectra.json).
const dialFiles = import.meta.glob<SpectrumPack | { packs: SpectrumPack[] }>('../content/dial/*.json', { eager: true, import: 'default' });

const BUILTIN_DECK_ORDER = [
  'movies', 'tv', 'celebs', 'music', 'characters', 'animals', 'food', 'charades',
  'places', 'everyday', 'jobs', 'sports', 'games', 'throwback', 'internet', 'after-dark',
];

function ordered<T extends { id: string }>(items: T[], order: string[]): T[] {
  const rank = (id: string) => { const i = order.indexOf(id); return i < 0 ? order.length : i; };
  return items.slice().sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id));
}

const builtinDecks = ordered(Object.values(wordFiles), BUILTIN_DECK_ORDER);
const builtinGibberish = ordered(Object.values(gibberishFiles), ['classic', 'pop', 'sayings', 'after-dark']);
const builtinSpectra = ordered(Object.values(dialFiles).flatMap((f) => ('packs' in f ? f.packs : [f])), ['classic', 'deep', 'nerdy', 'after-dark']);

/**
 * Packs saved on this phone. A pack whose id matches a built-in is an edit of that built-in:
 * it replaces it everywhere until restored. Any other id is the player's own pack (`custom`).
 */
function customStore<T extends { id: string; custom?: boolean }>(key: string, builtin: T[]) {
  const builtinIds = new Set(builtin.map((b) => b.id));
  // An own pack (custom: true) whose id a later built-in also uses stays the player's own,
  // under a new id, so it is never mistaken for an edit and "restored" away.
  const stored = (): T[] => {
    const items = load<T[]>(key, []);
    if (!items.some((x) => x.custom && builtinIds.has(x.id))) return items;
    const moved = items.map((x) => (x.custom && builtinIds.has(x.id) ? { ...x, id: 'my-' + x.id } : x));
    save(key, moved);
    return moved;
  };
  return {
    /** The player's own packs (not edits of built-ins). */
    all: (): T[] => stored().filter((x) => !builtinIds.has(x.id)),
    /** Everything saved, own packs and edits, for merging over the built-ins. */
    saved: stored,
    put(item: T) {
      const items = stored().filter((x) => x.id !== item.id);
      save(key, [{ ...item, custom: !builtinIds.has(item.id) }, ...items]);
    },
    remove(id: string) {
      save(key, stored().filter((x) => x.id !== id));
    },
    isBuiltin: (id: string) => builtinIds.has(id),
    /** True when a built-in pack has been edited on this phone. */
    isEdited: (id: string) => builtinIds.has(id) && stored().some((x) => x.id === id),
    /** The pack as shipped, for "Restore original". */
    original: (id: string): T | undefined => builtin.find((b) => b.id === id),
    /** Drops this phone's edit of a built-in pack. */
    restore(id: string) {
      if (builtinIds.has(id)) save(key, stored().filter((x) => x.id !== id));
    },
  };
}

function merged<T extends { id: string }>(saved: T[], builtin: T[]): T[] {
  const byId = new Map(saved.map((c) => [c.id, c]));
  const own = saved.filter((c) => !builtin.some((b) => b.id === c.id));
  return [...own, ...builtin.map((b) => byId.get(b.id) ?? b)];
}

export const customDecks = customStore<WordDeck>('custom:decks', builtinDecks);
export const customSpectra = customStore<SpectrumPack>('custom:spectra', builtinSpectra);
export const customGibberish = customStore<GibberishPack>('custom:gibberish', builtinGibberish);

/** Every pack: the player's own first, then built-ins (edited versions where edited), in order. */
export const wordDecks = (): WordDeck[] => merged(customDecks.saved(), builtinDecks);
export const spectrumPacks = (): SpectrumPack[] => merged(customSpectra.saved(), builtinSpectra);
export const gibberishPacks = (): GibberishPack[] => merged(customGibberish.saved(), builtinGibberish);

export function isBuiltin(id: string, kind: 'decks' | 'spectra' | 'gibberish'): boolean {
  return (kind === 'decks' ? customDecks : kind === 'spectra' ? customSpectra : customGibberish).isBuiltin(id);
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'pack';
}

/** Case- and space-insensitive dedupe that keeps the first spelling seen. */
export function dedupe(words: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of words) {
    const t = w.trim().replace(/\s+/g, ' ');
    const k = t.toLowerCase();
    if (t && !seen.has(k)) { seen.add(k); out.push(t); }
  }
  return out;
}
