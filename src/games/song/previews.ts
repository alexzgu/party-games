import type { Song } from '../../lib/content';
import { prepare, type Prepared } from './audio';
import { NetError } from './itunes';
import type { Track } from './match';

/** Share ongoing work only. Decoded previews are cached by the audio loader. */
export function pendingPreview(
  pending: Map<number, Promise<Prepared | null>>,
  id: number,
  load: () => Promise<Prepared | null>,
): Promise<Prepared | null> {
  const existing = pending.get(id);
  if (existing) return existing;
  const request = load().finally(() => pending.delete(id));
  pending.set(id, request);
  return request;
}

/** A missing preview is a result. A failed request leaves the song eligible for retry. */
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
    if (updated.preview !== track.preview) return prepare(song, updated);
    if (error instanceof DOMException && error.name === 'EncodingError') return null;
    throw error;
  }
}
