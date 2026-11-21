// Clips kept on this phone: imported with a clip pack (clipfile.ts), stored in IndexedDB per
// pack and song, read once when a game starts, and removed with their pack. Every IndexedDB call
// is guarded: a phone that will not store them (private mode, full, evicted) just plays Apple's
// previews, and a song that has only a clip is left out there. The records hold the audio and
// where it came from, never a title, so nothing here names a song.
import type { Clip } from './clipfile';
import { readClipFile } from './clipfile';
import { importMessage, savePacks } from '../../lib/packfile';

const DB = 'jerkbox-clips';
const STORE = 'clips';
const BY_PACK = 'pack';

interface Row extends Clip { pack: string; key: string }

let opening: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  if (opening) return opening;
  opening = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore(STORE, { keyPath: ['pack', 'key'] });
      store.createIndex(BY_PACK, 'pack');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('blocked'));
  });
  // A failed open is tried again next time.
  opening.catch(() => (opening = null));
  return opening;
}

/** One transaction on the store; resolves with `work`'s result once it has committed. */
async function run<T>(mode: IDBTransactionMode, work: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const d = await db();
  return new Promise<T | undefined>((resolve, reject) => {
    const tx = d.transaction(STORE, mode);
    const req = work(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('aborted'));
  });
}

const rowsOf = (pack: string) => run<Row[]>('readonly', (s) => s.index(BY_PACK).getAll(pack) as IDBRequest<Row[]>);

/** Replaces a pack's clips with these. Returns how many were saved (0 when the phone would not). */
export async function saveClips(pack: string, clips: ReadonlyMap<string, Clip>): Promise<number> {
  if (!clips.size) return 0;
  try {
    await run('readwrite', (s) => {
      s.delete(IDBKeyRange.bound([pack, ''], [pack, '￿']));
      for (const [key, c] of clips) s.put({ ...c, pack, key } satisfies Row);
    });
    return clips.size;
  } catch {
    return 0;
  }
}

/** Every clip of these packs, by song key (the first pack's wins); empty when there are none or no storage. */
export async function loadClips(packIds: readonly string[]): Promise<Map<string, Clip>> {
  const out = new Map<string, Clip>();
  for (const pack of packIds) {
    try {
      for (const r of (await rowsOf(pack)) ?? []) if (!out.has(r.key)) out.set(r.key, { youtube: r.youtube, at: r.at, seconds: r.seconds, type: r.type, bytes: r.bytes });
    } catch { /* no storage: the previews play */ }
  }
  return out;
}

/** Removes a pack's clips (its pack was deleted). */
export async function removeClips(pack: string): Promise<void> {
  try { await run('readwrite', (s) => s.delete(IDBKeyRange.bound([pack, ''], [pack, '￿']))); } catch { /* nothing stored */ }
}

/** A pack's clips on this phone: song key → size in bytes (empty when none or no storage). */
export async function storedClips(pack: string): Promise<Map<string, number>> {
  try {
    return new Map(((await rowsOf(pack)) ?? []).map((r) => [r.key, r.bytes.byteLength]));
  } catch {
    return new Map();
  }
}

/** Asks the browser not to clear the clips when space runs low; true when it agreed. */
export async function askToKeep(): Promise<boolean> {
  try { return (await navigator.storage?.persist?.()) ?? false; } catch { return false; }
}

/** "5.6 MB", "820 KB". */
export const sizeText = (bytes: number) => (bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`);

/**
 * Imports an Earworm pack file, with or without clips: saves its packs as the player's own (as
 * every pack file does) and each pack's clips on this phone. Returns the saved pack ids and what to tell the player.
 */
export async function importSongFile(content: string): Promise<{ error: string } | { ids: string[]; message: string }> {
  const r = readClipFile(content);
  if ('error' in r) return r;
  const saved = savePacks('song', r.packs);
  const wanted = r.clips.reduce((n, c) => n + c.size, 0);
  let stored = 0;
  if (wanted) {
    void askToKeep();
    for (const [i, p] of saved.entries()) stored += await saveClips(p.id, r.clips[i]);
  }
  const parts = [importMessage('song', { saved, skipped: r.skipped, problems: r.problems })];
  if (stored) parts.push(`${stored} ${stored === 1 ? 'clip' : 'clips'} saved on this phone.`);
  if (wanted && stored < wanted) parts.push('Some clips could not be saved on this phone (it may be full), so those songs play from Apple Music, or are left out if Apple doesn’t have them.');
  if (r.clipsSkipped) parts.push(`${r.clipsSkipped} ${r.clipsSkipped === 1 ? 'clip was' : 'clips were'} damaged and left out.`);
  return { ids: saved.map((p) => p.id), message: parts.join(' ') };
}
