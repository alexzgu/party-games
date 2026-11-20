// Built-in packs (bundled JSON, precached for offline play) merged with packs players
// make or edit on the phone (saved in localStorage). An edit of a built-in replaces it in place.
import { load, save } from './storage';

export interface WordDeck { id: string; name: string; emoji: string; blurb: string; words: string[]; custom?: boolean; /** When the pack was made (ISO date or time); built-ins without one count as the oldest. */ added?: string }
export interface Spectrum { left: string; right: string }
export interface SpectrumPack { id: string; name: string; blurb: string; cards: Spectrum[]; custom?: boolean; /** When the pack was made (ISO date or time); built-ins without one count as the oldest. */ added?: string }
export interface GibberishCard { phrase: string; answer: string; hint: string }
export interface GibberishPack { id: string; name: string; blurb: string; cards: GibberishCard[]; custom?: boolean; /** When the pack was made (ISO date or time); built-ins without one count as the oldest. */ added?: string }
export interface QuizClue { clue: string; answer: string }
/** One column of a Big Board: its clues run easiest (top row) to hardest. */
export interface QuizCategory { name: string; clues: QuizClue[] }
export interface QuizBoard { id: string; name: string; blurb: string; categories: QuizCategory[]; custom?: boolean; /** When the pack was made (ISO date or time); built-ins without one count as the oldest. */ added?: string }

const wordFiles = import.meta.glob<WordDeck>('../content/forehead/*.json', { eager: true, import: 'default' });
const gibberishFiles = import.meta.glob<GibberishPack>('../content/gibberish/*.json', { eager: true, import: 'default' });
const quizFiles = import.meta.glob<QuizBoard>('../content/quiz/*.json', { eager: true, import: 'default' });
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
const builtinQuiz = ordered(Object.values(quizFiles), ['pop-culture-mix', 'totally-random-trivia', 'throwback-2000s-2010s']);
const builtinSpectra = ordered(Object.values(dialFiles).flatMap((f) => ('packs' in f ? f.packs : [f])), ['classic', 'deep', 'nerdy', 'after-dark']);

/**
 * Packs saved on this phone. A pack whose id matches a built-in is an edit of that built-in:
 * it replaces it everywhere until restored. Any other id is the player's own pack (`custom`).
 */
function customStore<T extends { id: string; custom?: boolean; /** When the pack was made (ISO date or time); built-ins without one count as the oldest. */ added?: string }>(key: string, builtin: T[]) {
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
      const own = !builtinIds.has(item.id);
      const added = item.added ?? (own ? new Date().toISOString() : undefined);
      save(key, [{ ...item, custom: own, ...(added ? { added } : {}) }, ...items]);
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
export const customQuiz = customStore<QuizBoard>('custom:quiz', builtinQuiz);

/** Every pack: the player's own first, then built-ins (edited versions where edited), in order. */
export const wordDecks = (): WordDeck[] => merged(customDecks.saved(), builtinDecks);
export const spectrumPacks = (): SpectrumPack[] => merged(customSpectra.saved(), builtinSpectra);
export const gibberishPacks = (): GibberishPack[] => merged(customGibberish.saved(), builtinGibberish);
export const quizBoards = (): QuizBoard[] => merged(customQuiz.saved(), builtinQuiz);

const stores = { decks: customDecks, spectra: customSpectra, gibberish: customGibberish, quiz: customQuiz };

export function isBuiltin(id: string, kind: keyof typeof stores): boolean {
  return stores[kind].isBuiltin(id);
}

/** Age for sorting packs by Newest/Oldest: ms since epoch, 0 when unknown. */
export const packAge = (p: { added?: string }): number => (p.added ? Date.parse(p.added) || 0 : 0);

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

// Don't Say It (taboo): each card is a word to describe and the five words the describer may not say.
export interface TabooCard { word: string; banned: string[] }
export interface TabooPack { id: string; name: string; blurb: string; cards: TabooCard[]; custom?: boolean; /** When the pack was made (ISO date or time); built-ins without one count as the oldest. */ added?: string }
const tabooFiles = import.meta.glob<TabooPack>('../content/taboo/*.json', { eager: true, import: 'default' });
const builtinTaboo = ordered(Object.values(tabooFiles), ['classic', 'pop-culture', 'after-dark']);
export const customTaboo = customStore<TabooPack>('custom:taboo', builtinTaboo);
export const tabooPacks = (): TabooPack[] => merged(customTaboo.saved(), builtinTaboo);

// Brain Freeze: "Name 3 …" prompts, stored without the lead-in ("things you'd find in a fridge").
export interface QuickPack { id: string; name: string; blurb: string; prompts: string[]; custom?: boolean; /** When the pack was made (ISO date or time); built-ins without one count as the oldest. */ added?: string }
const quickFiles = import.meta.glob<QuickPack>('../content/quick/*.json', { eager: true, import: 'default' });
const builtinQuick = ordered(Object.values(quickFiles), ['classic', 'pop-culture', 'after-dark']);
export const customQuick = customStore<QuickPack>('custom:quick', builtinQuick);
export const quickPacks = (): QuickPack[] => merged(customQuick.saved(), builtinQuick);

// Earworm (song): clips of Apple Music's 30-second previews, played on the host phone; a pack
// holds only titles, artists, Apple track ids and, optionally, a clip start and a YouTube video.
export interface Song {
  title: string;
  artist: string;
  /** Apple Music track id: its 30-second preview is what the room hears. */
  apple: number;
  /** Seconds into the preview where the clip starts; without it the game picks the moment itself. */
  start?: number;
  /** 11-character YouTube video id, shown (never hidden) at the reveal only. */
  youtube?: string;
}
export interface SongPack { id: string; name: string; blurb: string; songs: Song[]; custom?: boolean; /** When the pack was made (ISO date or time); built-ins without one count as the oldest. */ added?: string }
const songFiles = import.meta.glob<SongPack>('../content/song/*.json', { eager: true, import: 'default' });
const builtinSongs = ordered(Object.values(songFiles), ['2000s-bangers', '2010s-hits', 'throwbacks']);
export const customSongs = customStore<SongPack>('custom:songs', builtinSongs);
export const songPacks = (): SongPack[] => merged(customSongs.saved(), builtinSongs);

// Snark Tank: prompts players write funny answers to ("The worst thing to hear from your pilot").
export interface SnarkPack { id: string; name: string; blurb: string; prompts: string[]; custom?: boolean; /** When the pack was made (ISO date or time); built-ins without one count as the oldest. */ added?: string }
const snarkFiles = import.meta.glob<SnarkPack>('../content/snark/*.json', { eager: true, import: 'default' });
const builtinSnark = ordered(Object.values(snarkFiles), ['classic', 'after-dark']);
export const customSnark = customStore<SnarkPack>('custom:snark', builtinSnark);
export const snarkPacks = (): SnarkPack[] => merged(customSnark.saved(), builtinSnark);

// Drop-in games share the pack metadata and keep their cards in separate stores.
export interface WarmCard { answer: string; clues: string[] }
export type RoomCard =
  | { type: 'side'; a: string; b: string }
  | { type: 'proof' | 'together'; text: string }
  | { type: 'foley'; lines: string[] };
export interface DropInPack<T> {
  id: string;
  name: string;
  blurb: string;
  added?: string;
  custom?: boolean;
  cards: T[];
}
const warmFiles = import.meta.glob<DropInPack<WarmCard>>('../content/warm/*.json', { eager: true, import: 'default' });
const roomFiles = import.meta.glob<DropInPack<RoomCard>>('../content/room/*.json', { eager: true, import: 'default' });
const builtinWarm = ordered(Object.values(warmFiles), ['everyday-things', 'pop-culture', 'food-drink']);
const builtinRoom = ordered(Object.values(roomFiles), ['house-party', 'after-dark', 'deep-cuts']);
export const customWarm = customStore('custom:warm', builtinWarm);
export const customRoom = customStore('custom:room', builtinRoom);
export const warmPacks = () => merged(customWarm.saved(), builtinWarm);
export const roomPacks = () => merged(customRoom.saved(), builtinRoom);
