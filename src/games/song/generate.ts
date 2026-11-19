// "Ask Claude" for Earworm: the host types a theme; Claude streams "Title | Artist" lines and each
// one goes to the matcher the moment it arrives.
import { cleanItem, streamLines } from '../../lib/claude';
import { parseLine, type Wanted } from './match';

export const COUNT_RANGE = [10, 50] as const;
export const DEFAULT_COUNT = 30;

export const SYSTEM = `You pick songs for a name-that-tune party game. A phone plays two seconds of each song's catchiest moment and a room of adults in their 20s in the US shouts the title.

Output format: one song per line, exactly
Title | Artist
No numbering, no header, no blank lines, no commentary before or after.

Every song must meet all of these:
1. A real, released song, with the title and main artist exactly as the artist released it (features as "A ft. B" in the artist).
2. Recognisable from a few seconds of its hook by most of the room: hits, anthems, singalongs. No deep cuts.
3. Studio originals only: never live versions, covers, remixes or karaoke.
4. Every song fits the theme. Never repeat a song.`;

export function buildPrompt(theme: string, count: number, avoid: string[]): string {
  let p = `Theme: ${theme.trim() || 'songs everyone knows'}\nList ${count} songs.`;
  if (avoid.length) p += `\nThese are already in the pack, so do not list them: ${avoid.join('; ')}.`;
  return p;
}

/** Streams songs for a theme; each line is handed over as a parsed line for the matcher. */
export async function askClaude(opts: { theme: string; count: number; avoid: string[]; onSong: (w: Wanted) => void; signal?: AbortSignal }): Promise<void> {
  await streamLines({
    system: SYSTEM,
    prompt: buildPrompt(opts.theme, opts.count, opts.avoid),
    signal: opts.signal,
    maxTokens: 4000,
    onLine: (line) => {
      const w = parseLine(cleanItem(line));
      if (w?.kind === 'text') opts.onSong(w);
    },
  });
}
