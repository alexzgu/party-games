// "New pack" on Earworm setup: a pack of the player's own, named so it never clashes with one
// already on the phone. One the player backed out of untouched (no songs, nothing waiting to be
// added, still its given name) is removed when setup opens again, so no empty ticked packs pile up.
import { customSongs, songPacks, type SongPack } from '../../lib/content';
import { loadAdding } from './store';

const BASE = 'My songs';
export const NEW_PACK_ID = 'my-songs-';

/** "My songs", or "My songs 2", "My songs 3"… when that name is taken. */
export function newPackName(packs: Pick<SongPack, 'name'>[]): string {
  const taken = new Set(packs.map((p) => p.name.trim().toLowerCase()));
  for (let n = 1; ; n++) {
    const name = n === 1 ? BASE : `${BASE} ${n}`;
    if (!taken.has(name.toLowerCase())) return name;
  }
}

/** Made by "New pack" and left as it was: no songs, no review waiting, the name it was given. */
export function untouched(p: SongPack, pending: boolean): boolean {
  return !!p.custom && p.id.startsWith(NEW_PACK_ID) && !p.songs.length && !p.legacySongs?.length && !pending
    && new RegExp(`^${BASE}( \\d+)?$`).test(p.name);
}

/** A new empty pack, saved; returns its id. */
export function makeNewPack(): string {
  const id = NEW_PACK_ID + Date.now().toString(36);
  customSongs.put({ id, name: newPackName(songPacks()), blurb: 'Made on this phone', songs: [] });
  return id;
}

/** Removes the untouched new packs; returns their ids. */
export function dropUntouched(): string[] {
  const gone = songPacks().filter((p) => untouched(p, loadAdding<unknown>(p.id, null) !== null)).map((p) => p.id);
  for (const id of gone) customSongs.remove(id);
  return gone;
}
