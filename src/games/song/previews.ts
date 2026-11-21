import type { Song } from '../../lib/content';
import { loadClip, prepare, type Prepared } from './audio';
import type { Clip } from './clipfile';
import { NetError } from './itunes';
import { songKey } from './logic';
import type { Track } from './match';

/** Share ongoing work only. Decoded previews are cached by the audio loader. */
export function pendingPreview<K, T = Prepared | null>(
  pending: Map<K, Promise<T>>,
  id: K,
  load: () => Promise<T>,
): Promise<T> {
  const existing = pending.get(id);
  if (existing) return existing;
  const request = load().finally(() => pending.delete(id));
  pending.set(id, request);
  return request;
}

/**
 * A missing or unplayable preview is a result (null: the song is skipped). Only a connection
 * problem (offline, no answer, or Apple's lookup failing) throws, leaving the song for retry.
 */
export async function preparePreview(
  song: Song,
  lookup: (song: Song) => Promise<Track | null>,
  refresh: () => Promise<Track | null>,
): Promise<Prepared | null> {
  const track = await lookup(song);
  if (!track?.preview) return null;
  try {
    return await prepare(song, track);
  } catch (error) {
    if (!navigator.onLine) throw new NetError('offline', true);
    const updated = await refresh();
    if (!updated?.preview) return null;
    if (updated.preview === track.preview) return skipUnlessConnection(error);
    return prepare(song, updated).catch(skipUnlessConnection);
  }
}

/** A preview that failed for the song's own reason (refused, undecodable, no Web Audio) is skipped. */
function skipUnlessConnection(error: unknown): null {
  if (!navigator.onLine) throw new NetError('offline', true);
  if (error instanceof NetError) throw error;
  return null;
}

/** A song ready to play, from its clip on this phone or from Apple's preview. */
export interface Loaded {
  /** songKey of the song. */
  key: string;
  /** Apple's track (art and link at the reveal); null for a clip, which needs no lookup. */
  track: Track | null;
  buffer: AudioBuffer;
  /** Seconds into the buffer where the clip starts: 0 for a clip, which was cut at its moment. */
  start: number;
  fromClip: boolean;
}

/**
 * A song with a clip on this phone plays from it, with no Apple lookup; one without plays
 * Apple's preview exactly as before (`viaApple`). A clip that will not decode falls back to the
 * preview when the song has an Apple track; a clip-only song without a working clip cannot play (null).
 */
export async function prepareSong(
  song: Song,
  clip: Clip | undefined,
  viaApple: () => Promise<Prepared | null>,
  decode: (key: string, bytes: ArrayBuffer) => Promise<AudioBuffer> = loadClip,
): Promise<Loaded | null> {
  const key = songKey(song);
  if (clip) {
    try {
      return { key, track: null, buffer: await decode(key, clip.bytes), start: 0, fromClip: true };
    } catch {
      console.warn(`Earworm: the clip on this phone for ${key} would not decode.`);
    }
  }
  if (!song.apple) return null;
  const p = await viaApple();
  return p && { key, track: p.track, buffer: p.buffer, start: p.start, fromClip: false };
}
