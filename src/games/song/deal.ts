// Deals songs from the chosen packs. Each pack keeps its own "already heard" history, so
// switching pack combinations never resets what a group has already played.
import { makeBag } from '../../lib/bag';
import { songPacks, type Song } from '../../lib/content';

const songKey = (s: Song) => s.youtube;
const MAX_TRIES = 40;

export function makeDealer(packIds: string[], broken: readonly string[] = []) {
  const skip = new Set(broken);
  const packs = songPacks().filter((p) => packIds.includes(p.id) && p.songs.some((s) => !skip.has(s.youtube)));
  const bags = packs.map((p) => {
    const songs = p.songs.filter((s) => !skip.has(s.youtube));
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
    /** A song not in `dealt` (ids used this game) when one is left, else any song. */
    next(dealt: readonly string[] = []): Song | null {
      const used = new Set(dealt);
      let song: Song | undefined;
      for (let i = 0; i < MAX_TRIES; i++) {
        song = draw();
        if (!song || (!used.has(song.youtube) && !skip.has(song.youtube))) return song ?? null;
      }
      return song && !skip.has(song.youtube) ? song : null;
    },
    /** Never deal this id again in this game (YouTube refused it). */
    drop(id: string) {
      skip.add(id);
    },
  };
}

/** Names of the chosen packs, in pack order, for a history entry. */
export function packNames(packIds: string[]): string[] {
  return songPacks().filter((p) => packIds.includes(p.id)).map((p) => p.name);
}
