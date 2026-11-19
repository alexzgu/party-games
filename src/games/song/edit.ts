// Checks for adding or editing one song by hand: a YouTube link (or id), a start time, title
// and artist. Pure, so the form and the tests share it.
import type { Song } from '../../lib/content';

export interface SongDraft { title: string; artist: string; link: string; start: string }

/** A clean song, or the reason it cannot be saved. `others` are the pack's other songs. */
export function checkSong(d: SongDraft, others: Song[]): { song: Song; error: '' } | { song: null; error: string } {
  const title = d.title.trim().replace(/\s+/g, ' ');
  const artist = d.artist.trim().replace(/\s+/g, ' ');
  const youtube = videoIdFrom(d.link);
  const start = d.start.trim() ? parseStart(d.start) : (startFromLink(d.link) ?? 0);
  const fail = (error: string) => ({ song: null, error });
  if (!title) return fail('Type the song title.');
  if (!artist) return fail('Type the artist.');
  if (!youtube) return fail('Paste a YouTube link (or the 11-character video id).');
  if (start === null) return fail('Start time looks wrong. Use seconds (65) or minutes:seconds (1:05).');
  if (others.some((s) => s.youtube === youtube)) return fail('That video is already in this pack.');
  if (others.some((s) => s.title.toLowerCase() === title.toLowerCase() && s.artist.toLowerCase() === artist.toLowerCase())) return fail(`${title} is already in this pack.`);
  return { song: { title, artist, youtube, start }, error: '' };
}

/** "1:05" → 65, "65" → 65; null when it is not a time. */
export function parseStart(raw: string): number | null {
  const t = raw.trim();
  if (/^\d+(\.\d+)?$/.test(t)) return Math.floor(Number(t));
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/** 65 → "1:05". */
export function formatStart(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

/** The video id in a YouTube link (watch, youtu.be, shorts, embed, music) or a bare id; null otherwise. */
export function videoIdFrom(raw: string): string | null {
  const t = raw.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(t)) return t;
  let url: URL;
  try { url = new URL(/^https?:\/\//.test(t) ? t : 'https://' + t); } catch { return null; }
  const host = url.hostname.replace(/^(www|m|music)\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = url.searchParams.get('v') ?? /^\/(?:shorts|embed|live|v)\/([^/?#]+)/.exec(url.pathname)?.[1] ?? null;
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

/** The start second in a link's t= or start= parameter ("t=1m5s", "t=65"), if any. */
export function startFromLink(raw: string): number | null {
  let url: URL;
  try { url = new URL(/^https?:\/\//.test(raw.trim()) ? raw.trim() : 'https://' + raw.trim()); } catch { return null; }
  const t = url.searchParams.get('t') ?? url.searchParams.get('start');
  if (!t) return null;
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(t);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}
