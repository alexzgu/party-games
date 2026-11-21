// Checks for editing one song by hand: the title and artist players see, an optional YouTube
// video for the reveal, and the clip start (null: picked automatically). Pure, so the form and
// the tests share it.
import type { Song } from '../../lib/content';
import { youtubeFrom } from './match';
import { MAX_START } from './logic';
import { latestStart } from './pick';

export interface SongDraft { title: string; artist: string; youtube: string; start: number | null }

const tidyText = (s: string) => s.trim().replace(/\s+/g, ' ');

/** A clean song, or the reason it cannot be saved. `others` are the pack's other songs. */
export function checkSong(d: SongDraft, base: Song, others: Song[]): { song: Song; error: '' } | { song: null; error: string } {
  const title = tidyText(d.title);
  const artist = tidyText(d.artist);
  const fail = (error: string) => ({ song: null, error });
  if (!title) return fail('Type the song title.');
  if (!artist) return fail('Type the artist.');
  const link = d.youtube.trim();
  const youtube = !link ? '' : /^[A-Za-z0-9_-]{11}$/.test(link) ? link : youtubeFrom(link)?.video ?? null;
  if (youtube === null) return fail('That doesn’t look like a link to one YouTube video. Leave it empty if there isn’t one.');
  if (others.some((s) => s.title.toLowerCase() === title.toLowerCase() && s.artist.toLowerCase() === artist.toLowerCase())) return fail(`${title} is already in this pack.`);
  // A clip-only song's video is how this phone finds its clip, so it stays.
  if (base.clipOnly) return { song: { title, artist, youtube: base.youtube, clipOnly: true }, error: '' };
  const song: Song = { title, artist, apple: base.apple };
  if (d.start !== null) song.start = Math.round(Math.min(Math.max(0, d.start), MAX_START) * 10) / 10;
  if (youtube) song.youtube = youtube;
  return { song, error: '' };
}

/** The latest start the clip picker offers: the longest clip fits in the preview, and a pack may save it (MAX_START). */
export const latestHandStart = (duration: number): number => Math.min(MAX_START, latestStart(duration));

/** 12.4 → "0:12.4", 65 → "1:05". */
export function formatStart(s: number): string {
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  const whole = Math.floor(rest);
  const tenth = Math.round((rest - whole) * 10);
  return `${m}:${String(whole).padStart(2, '0')}${tenth ? `.${tenth % 10}` : ''}`;
}
