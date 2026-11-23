// Built-in packs (bundled JSON, precached for offline play) merged with packs players
// make or edit on the phone (saved in localStorage). An edit of a built-in replaces it in place.
import { load, save, trySave } from './storage';
import { forgetShared, moveShared } from './shareLog.svelte';
import type { Secret } from '../games/salad/words';

/** What a pack saved on this phone carries beside its content; pack files never carry it. */
export interface PackMeta {
  /** The player's own pack, not an edit of a built-in. */
  custom?: boolean;
  /** When the pack was made (ISO date or time); built-ins without one count as the oldest. */
  added?: string;
  /** Shared to the Community library: by the wizard (src/lib/library.ts `afterRun`) or with Share. */
  shared?: boolean;
  /** Imported from the Community library, so it is someone else's shared pack and never shared again from here. */
  fromLibrary?: boolean;
  /** The Community pack it was imported from (packs imported before this was kept have none). */
  communityId?: string;
}

export interface WordDeck extends PackMeta { id: string; name: string; emoji: string; blurb: string; words: string[] }
export interface Spectrum { left: string; right: string }
export interface SpectrumPack extends PackMeta { id: string; name: string; blurb: string; cards: Spectrum[] }
export interface GibberishCard { phrase: string; answer: string; hint: string }
export interface GibberishPack extends PackMeta { id: string; name: string; blurb: string; cards: GibberishCard[] }
export interface QuizClue { clue: string; answer: string }
/** One column of a Big Board: its clues run easiest (top row) to hardest. */
export interface QuizCategory { name: string; clues: QuizClue[] }
export interface QuizBoard extends PackMeta { id: string; name: string; blurb: string; categories: QuizCategory[] }

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
function customStore<T extends { id: string } & PackMeta>(key: string, builtin: T[], game: string) {
  const builtinIds = new Set(builtin.map((b) => b.id));
  // An own pack (custom: true) whose id a later built-in also uses stays the player's own,
  // under a new id, so it is never mistaken for an edit and "restored" away. Reading only shows it
  // under that id, writing nothing (it happens while pages render); `settle` stores the move.
  const clashes = (x: T) => !!x.custom && builtinIds.has(x.id);
  const renamed = (x: T): T => (clashes(x) ? { ...x, id: 'my-' + x.id } : x);
  const stored = (): T[] => load<T[]>(key, []).map(renamed);
  // Runs as the app starts, before anything renders, and before each write. What the Community
  // library knows of a moved pack goes with it (shareLog.svelte.ts), so a later share updates the
  // same entry.
  function settle(): T[] {
    const items = load<T[]>(key, []);
    const moved = items.map(renamed);
    if (items.some(clashes)) save(key, moved);
    for (const x of items) if (clashes(x)) moveShared(game, x.id, renamed(x).id);
    return moved;
  }
  settle();
  return {
    settle,
    /** The player's own packs (not edits of built-ins). */
    all: (): T[] => stored().filter((x) => !builtinIds.has(x.id)),
    /** Everything saved, own packs and edits, for merging over the built-ins. */
    saved: stored,
    put(item: T): boolean {
      return this.putAll([item]);
    },
    /** Saves the packs on top, in this order, in one write: all of them, or (no room: false) none. */
    putAll(packs: readonly T[]): boolean {
      const ids = new Set(packs.map((p) => p.id));
      const items = settle().filter((x) => !ids.has(x.id));
      const saved = packs.map((item) => {
        const own = !builtinIds.has(item.id);
        const added = item.added ?? (own ? new Date().toISOString() : undefined);
        // Only the player's own pack can be marked shared, never an edit of a built-in.
        const { shared, ...rest } = item;
        return { ...rest, custom: own, ...(added ? { added } : {}), ...(own && shared === true ? { shared } : {}) } as unknown as T;
      });
      return trySave(key, [...saved, ...items]);
    },
    /**
     * Marks the player's own saved pack as shared to the Community library, in place and with
     * nothing else changed; false when there is no such pack (deleted meanwhile, or a built-in).
     */
    markShared(id: string): boolean {
      const items = settle();
      if (builtinIds.has(id) || !items.some((x) => x.id === id)) return false;
      save(key, items.map((x) => (x.id === id ? { ...x, shared: true } : x)));
      return true;
    },
    remove(id: string) {
      save(key, settle().filter((x) => x.id !== id));
      forgetShared(game, id);
    },
    isBuiltin: (id: string) => builtinIds.has(id),
    /** The built-in packs as shipped. */
    builtins: (): readonly T[] => builtin,
    /** Every pack name in use for this game: the built-ins' and the packs saved here. */
    names: (): string[] => [...builtin, ...stored()].map((x) => String((x as { name?: unknown }).name ?? '')),
    /** True when a built-in pack has been edited on this phone. */
    isEdited: (id: string) => builtinIds.has(id) && stored().some((x) => x.id === id),
    /** The pack as shipped, for "Restore original". */
    original: (id: string): T | undefined => builtin.find((b) => b.id === id),
    /** Drops this phone's edit of a built-in pack. */
    restore(id: string) {
      if (builtinIds.has(id)) save(key, settle().filter((x) => x.id !== id));
    },
  };
}

function merged<T extends { id: string }>(saved: T[], builtin: T[]): T[] {
  const byId = new Map(saved.map((c) => [c.id, c]));
  const own = saved.filter((c) => !builtin.some((b) => b.id === c.id));
  return [...own, ...builtin.map((b) => byId.get(b.id) ?? b)];
}

export const customDecks = customStore<WordDeck>('custom:decks', builtinDecks, 'forehead');
export const customSpectra = customStore<SpectrumPack>('custom:spectra', builtinSpectra, 'dial');
export const customGibberish = customStore<GibberishPack>('custom:gibberish', builtinGibberish, 'gibberish');
export const customQuiz = customStore<QuizBoard>('custom:quiz', builtinQuiz, 'quiz');

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
export interface TabooPack extends PackMeta { id: string; name: string; blurb: string; cards: TabooCard[] }
const tabooFiles = import.meta.glob<TabooPack>('../content/taboo/*.json', { eager: true, import: 'default' });
const builtinTaboo = ordered(Object.values(tabooFiles), ['classic', 'pop-culture', 'after-dark']);
export const customTaboo = customStore<TabooPack>('custom:taboo', builtinTaboo, 'taboo');
export const tabooPacks = (): TabooPack[] => merged(customTaboo.saved(), builtinTaboo);

// Brain Freeze: "Name 3 …" prompts, stored without the lead-in ("things you'd find in a fridge").
export interface QuickPack extends PackMeta { id: string; name: string; blurb: string; prompts: string[] }
const quickFiles = import.meta.glob<QuickPack>('../content/quick/*.json', { eager: true, import: 'default' });
const builtinQuick = ordered(Object.values(quickFiles), ['classic', 'pop-culture', 'after-dark']);
export const customQuick = customStore<QuickPack>('custom:quick', builtinQuick, 'quick');
export const quickPacks = (): QuickPack[] => merged(customQuick.saved(), builtinQuick);

// Snark Tank: prompts players write funny answers to ("The worst thing to hear from your pilot").
/** A final for three-line duels: a prompt that asks for three things, and the house's own three lines. */
export interface SnarkFinal { prompt: string; house: [string, string, string] }
export interface SnarkPack extends PackMeta {
  id: string; name: string; blurb: string; prompts: string[];
  /** Prompt → a stock answer for "Give me one" (sent untouched, it earns half points). */
  safety?: Record<string, string>;
  /** Finals for three-line duels. */
  finals?: SnarkFinal[];
}
const snarkFiles = import.meta.glob<SnarkPack>('../content/snark/*.json', { eager: true, import: 'default' });
const builtinSnark = ordered(Object.values(snarkFiles), ['classic', 'after-dark']);
export const customSnark = customStore<SnarkPack>('custom:snark', builtinSnark, 'snark');
export const snarkPacks = (): SnarkPack[] => merged(customSnark.saved(), builtinSnark);

/** Word Salad packs are bundled with the game and selected in host settings. */
export interface SaladPack { id: string; name: string; blurb: string; secrets: Secret[]; added?: string }
const saladFiles = import.meta.glob<SaladPack>('../content/salad/*.json', { eager: true, import: 'default' });
const builtinSalad = ordered(Object.values(saladFiles), ['classic']);
export const saladPacks = (): SaladPack[] => builtinSalad.slice();

// Doodle Brawl: titles for fighters ("World's okayest roommate").
export interface BrawlPack extends PackMeta { id: string; name: string; blurb: string; titles: string[] }
const brawlFiles = import.meta.glob<BrawlPack>('../content/brawl/*.json', { eager: true, import: 'default' });
const builtinBrawl = ordered(Object.values(brawlFiles), ['classic', 'after-dark']);
export const customBrawl = customStore<BrawlPack>('custom:brawl', builtinBrawl, 'brawl');
export const brawlPacks = (): BrawlPack[] => merged(customBrawl.saved(), builtinBrawl);

/** Sketchy packs: things to draw (Draw & guess) and lines that can start a chain (Telephone). */
export interface SketchPack extends PackMeta { id: string; name: string; blurb: string; words: string[]; ideas: string[] }
const sketchFiles = import.meta.glob<SketchPack>('../content/sketch/*.json', { eager: true, import: 'default' });
const builtinSketch = ordered(Object.values(sketchFiles), ['classic', 'after-dark']);
export const customSketch = customStore<SketchPack>('custom:sketch', builtinSketch, 'sketch');
export const sketchPacks = (): SketchPack[] => merged(customSketch.saved(), builtinSketch);

/** Bad Hand packs: prompt cards (each `___` is a blank; none means a question) and answer cards. */
export interface HandPack extends PackMeta { id: string; name: string; blurb: string; prompts: string[]; answers: string[] }
const handFiles = import.meta.glob<HandPack>('../content/hand/*.json', { eager: true, import: 'default' });
const builtinHand = ordered(Object.values(handFiles), ['classic', 'after-dark']);
export const customHand = customStore<HandPack>('custom:hand', builtinHand, 'hand');
export const handPacks = (): HandPack[] => merged(customHand.saved(), builtinHand);
