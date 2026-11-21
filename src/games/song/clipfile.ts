// Clip packs: an Earworm pack file made on a laptop (scripts/clip-songs.mjs) that also carries a
// short clip of each song, cut from its YouTube video. The file is a pack file
// ({"jerkBox": 1, "game": "song", "packs": [...]}) plus
// "clips": {"<songKey>": {"youtube": id, "at": seconds into the video, "seconds": length,
// "type": "audio/mp4", "data": base64}}. Pure: it reads and checks the file; clips.ts keeps the
// clips on the phone. A song without an Apple track is read only when its clip is in the file.
import { parseFile, readData, TOO_BIG, type ReadResult } from '../../lib/packfile';
import type { SongPack } from '../../lib/content';
import { songKey, YOUTUBE_ID } from './logic';

/** A whole clip pack: 40 songs of 12 s at 128 kbps come to about 10 MB of text. */
export const MAX_CLIP_FILE_BYTES = 40_000_000;
/** One clip's audio, well above 12 s of 256 kbps AAC. */
export const MAX_CLIP_BYTES = 1_000_000;
export const MAX_CLIP_SECONDS = 30;
export const MAX_CLIPS = 300;
/** AAC in MP4 (.m4a): what both iPhone Safari and Android Chrome decode through Web Audio. */
export const CLIP_TYPE = 'audio/mp4';

export interface Clip {
  /** The YouTube video it was cut from. */
  youtube: string;
  /** Where in that video the clip starts, in seconds. */
  at: number;
  /** The clip's length in seconds; the game plays it from 0. */
  seconds: number;
  type: string;
  bytes: ArrayBuffer;
}

/** A song key as songKey() makes it: an Apple track id, or "yt:" and a YouTube id. */
const KEY = /^(?:[1-9]\d{0,15}|yt:[A-Za-z0-9_-]{11})$/;
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const num = (x: unknown, min: number, max: number): x is number => typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;

/** Strict base64 to bytes, or null when it is not base64 or too long for a clip. */
export function base64Bytes(s: string): ArrayBuffer | null {
  if (!s || s.length % 4 !== 0 || !BASE64.test(s) || (s.length / 4) * 3 > MAX_CLIP_BYTES + 2) return null;
  let bin: string;
  try { bin = atob(s); } catch { return null; }
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

/** An MP4 file starts with a box whose type is "ftyp". */
const isMp4 = (b: ArrayBuffer) => b.byteLength > 12 && String.fromCharCode(...new Uint8Array(b, 4, 4)) === 'ftyp';

function clip(x: unknown): Clip | null {
  if (!isObj(x) || typeof x.youtube !== 'string' || !YOUTUBE_ID.test(x.youtube)) return null;
  if (!num(x.at, 0, 24 * 3600) || !num(x.seconds, 0.5, MAX_CLIP_SECONDS)) return null;
  const type = x.type === undefined ? CLIP_TYPE : x.type;
  if (type !== CLIP_TYPE || typeof x.data !== 'string') return null;
  const bytes = base64Bytes(x.data);
  return bytes && isMp4(bytes) ? { youtube: x.youtube, at: x.at, seconds: x.seconds, type, bytes } : null;
}

/** The clips in a file's "clips" field, by song key; the ones that cannot be used are counted. */
export function readClips(raw: unknown): { clips: Map<string, Clip>; skipped: number } {
  const clips = new Map<string, Clip>();
  if (!isObj(raw)) return { clips, skipped: 0 };
  const entries = Object.entries(raw);
  for (const [key, x] of entries.slice(0, MAX_CLIPS)) {
    const c = KEY.test(key) ? clip(x) : null;
    if (c) clips.set(key, c);
  }
  return { clips, skipped: entries.length - clips.size };
}

export type ClipFile = ReadResult & {
  /** Per pack, in the same order: the clips of that pack's songs. */
  clips: Map<string, Clip>[];
  clipsSkipped: number;
};

/** A pack file with or without clips, read for Earworm; or a plain-words reason it cannot be imported. */
export function readClipFile(content: string): ClipFile | { error: string } {
  if (content.length > MAX_CLIP_FILE_BYTES) return { error: TOO_BIG };
  const data = parseFile(content);
  const { clips, skipped } = readClips(isObj(data) ? data.clips : undefined);
  const r = readData(data, 'song', { clips: new Set(clips.keys()) });
  if ('error' in r) return r;
  const per = (r.packs as SongPack[]).map((p) => {
    const mine = new Map<string, Clip>();
    for (const s of p.songs) {
      const c = clips.get(songKey(s));
      if (c) mine.set(songKey(s), c);
    }
    return mine;
  });
  return { ...r, clips: per, clipsSkipped: skipped };
}
