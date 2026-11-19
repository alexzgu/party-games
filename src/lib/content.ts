// Built-in packs (bundled JSON, precached for offline play) merged with packs players
// make on the phone (saved in localStorage). Custom packs shadow built-ins with the same id.
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

function customStore<T extends { id: string }>(key: string) {
  return {
    all: (): T[] => load<T[]>(key, []),
    put(item: T) {
      const items = load<T[]>(key, []).filter((x) => x.id !== item.id);
      save(key, [{ ...item, custom: true }, ...items]);
    },
    remove(id: string) {
      save(key, load<T[]>(key, []).filter((x) => x.id !== id));
    },
  };
}

function merged<T extends { id: string }>(custom: T[], builtin: T[]): T[] {
  const ids = new Set(custom.map((c) => c.id));
  return [...custom, ...builtin.filter((b) => !ids.has(b.id))];
}

export const customDecks = customStore<WordDeck>('custom:decks');
export const customSpectra = customStore<SpectrumPack>('custom:spectra');
export const customGibberish = customStore<GibberishPack>('custom:gibberish');

export const wordDecks = (): WordDeck[] => merged(customDecks.all(), builtinDecks);
export const spectrumPacks = (): SpectrumPack[] => merged(customSpectra.all(), builtinSpectra);
export const gibberishPacks = (): GibberishPack[] => merged(customGibberish.all(), builtinGibberish);

export function isBuiltin(id: string, kind: 'decks' | 'spectra' | 'gibberish'): boolean {
  const list = kind === 'decks' ? builtinDecks : kind === 'spectra' ? builtinSpectra : builtinGibberish;
  return list.some((x) => x.id === id);
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
