// Deals songs from the chosen packs. Each pack keeps its own "already heard" history, so
// switching pack combinations never resets what a group has already played.
import { makeBag } from '../../lib/bag';
import { songPacks, type Song } from '../../lib/content';
import { songKey } from './logic';

const MAX_TRIES = 40;

/**
 * `unplayable`: songs (by songKey) never to deal, because Apple has no preview for them.
 * `clips`: songs with a clip on this phone; they play from it, and a song with no Apple track
 * is dealt only when it has one.
 */
export function makeDealer(packIds: string[], unplayable: readonly string[] = [], clips: ReadonlySet<string> = new Set()) {
  const skip = new Set(unplayable);
  const chosen = songPacks().filter((p) => packIds.includes(p.id));
  for (const s of chosen.flatMap((p) => p.songs)) if (!s.apple && !clips.has(songKey(s))) skip.add(songKey(s));
  const packs = chosen.filter((p) => p.songs.some((s) => !skip.has(songKey(s))));
  const bags = packs.map((p) => {
    const songs = p.songs.filter((s) => !skip.has(songKey(s)));
    return { size: songs.length, bag: makeBag('song:' + p.id, songs, songKey) };
  });

  /** One song, from a pack chosen in proportion to its unheard songs (its size once all are heard). */
  function draw(): Song | undefined {
    const fresh = bags.filter((b) => b.bag.remaining > 0);
    const pool = fresh.length ? fresh.map((b) => ({ b, w: b.bag.remaining })) : bags.map((b) => ({ b, w: b.size }));
    let r = Math.random() * pool.reduce((n, p) => n + p.w, 0);
    const pick = pool.find((p) => (r -= p.w) < 0) ?? pool[pool.length - 1];
    return pick?.b.bag.next();
  }

  return {
    total: bags.reduce((n, b) => n + b.size, 0),
    /** The song plays from a clip on this phone. */
    hasClip: (song: Song) => clips.has(songKey(song)),
    /**
     * A song not in `dealt` (songs used this game, oldest first) when one is left; once all
     * were used, the least recently used one. Never one in `avoid` (the songs on screen now)
     * unless nothing else can play; null only when no song can.
     */
    next(dealt: readonly string[] = [], avoid: readonly (Song | null | undefined)[] = []): Song | null {
      const used = new Set(dealt);
      const held = new Set(avoid.flatMap((s) => (s ? [songKey(s)] : [])));
      const ok = (k: string) => !used.has(k) && !skip.has(k) && !held.has(k);
      for (let i = 0; i < MAX_TRIES; i++) {
        const song = draw();
        if (!song) return null;
        if (ok(songKey(song))) return song;
      }
      // Most songs are skipped or used: an unused playable one, else the least recently used.
      const left = [...new Map(packs.flatMap((p) => p.songs).map((s) => [songKey(s), s])).values()].filter((s) => !skip.has(songKey(s)));
      const fresh = left.filter((s) => ok(songKey(s)));
      if (fresh.length) return fresh[Math.floor(Math.random() * fresh.length)];
      const age = (s: Song) => dealt.indexOf(songKey(s));
      const others = left.filter((s) => !held.has(songKey(s))).sort((a, b) => age(a) - age(b));
      return others[0] ?? left[0] ?? null;
    },
    /** Never deal this song again in this game (its preview would not play). */
    drop(key: string) {
      skip.add(key);
    },
    /** No internet: deal only songs with a clip on this phone. False when there are none. */
    clipsOnly(): boolean {
      for (const s of packs.flatMap((p) => p.songs)) if (!clips.has(songKey(s))) skip.add(songKey(s));
      return packs.some((p) => p.songs.some((s) => !skip.has(songKey(s))));
    },
    /** Every Apple track id in the chosen packs whose song has no clip here, to look their previews up at the start. */
    appleIds(): number[] {
      return [...new Set(packs.flatMap((p) => p.songs.flatMap((s) => (s.apple && !clips.has(songKey(s)) ? [s.apple] : []))))];
    },
  };
}

/** Names of the chosen packs, in pack order, for a history entry. */
export function packNames(packIds: string[]): string[] {
  return songPacks().filter((p) => packIds.includes(p.id)).map((p) => p.name);
}
