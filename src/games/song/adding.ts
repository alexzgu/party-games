// The "Add songs" review list: lines go in (pasted, from a playlist, or from Claude), are
// matched one at a time through the rate-limited matcher, and stream into the list for the
// host to keep, drop or re-pick. Knows nothing about screens, so the tests drive it with fakes.
import type { LegacySong, Song } from '../../lib/content';
import { matchWanted, wantedKey, type Match, type MatchDeps, type Track, type Wanted } from './match';
import { PlaylistError } from './youtube';

export interface Item {
  key: string;
  wanted: Wanted;
  state: 'waiting' | 'matching' | 'done';
  match: Match | null;
  keep: boolean;
  /** Already in the pack, or the same track as an earlier line. */
  dup: boolean;
}

export interface AdderDeps extends MatchDeps {
  /** A YouTube playlist's video ids; a PlaylistError when YouTube will not list it. */
  readPlaylist(list: string): Promise<string[]>;
}

export class Adder {
  items: Item[] = [];
  /** Why matching paused (no internet…), '' while all is well. */
  error = '';
  private running = false;
  private stopped = false;

  constructor(
    private deps: AdderDeps,
    private existing: Pick<Song, 'apple' | 'title' | 'artist'>[],
    private changed: (() => void) | null,
    restored: Item[] = [],
  ) {
    // A list saved mid-match carries on from where it was.
    this.items = restored.map((it) => (it.state === 'matching' ? { ...it, state: 'waiting' } : it));
  }

  /**
   * Adds lines and starts matching. Repeats of lines already in the list are ignored, except a
   * line that failed for a passing reason (Spotify did not answer), which is tried again.
   */
  add(wanted: Wanted[]): number {
    if (!this.changed) return 0;
    const known = new Set(this.items.map((i) => i.key));
    let added = 0;
    for (const w of wanted) {
      const key = wantedKey(w);
      const again = this.items.find((i) => i.key === key && i.state === 'done' && i.match?.retry);
      if (again) { Object.assign(again, { state: 'waiting', match: null, keep: false, dup: false }); added++; continue; }
      if (known.has(key)) continue;
      known.add(key);
      this.items.push({ key, wanted: w, state: 'waiting', match: null, keep: false, dup: false });
      added++;
    }
    this.changed?.();
    this.resume();
    return added;
  }

  /** Lines still to match. */
  get waiting(): number { return this.items.filter((i) => i.state !== 'done').length; }
  get done(): number { return this.items.filter((i) => i.state === 'done' && i.wanted.kind !== 'playlist').length; }
  get total(): number { return this.items.filter((i) => i.wanted.kind !== 'playlist').length; }
  get busy(): boolean { return this.running; }

  /** Starts (or restarts after stop() or a network error) working through the waiting lines. */
  resume(): void {
    if (!this.changed) return;
    this.stopped = false;
    this.error = '';
    if (!this.running) void this.pump();
  }

  /** Pauses after the line being matched now. */
  stop(): void {
    this.stopped = true;
  }

  /** Ends this importer session and detaches its draft writer. */
  close(): void {
    this.stop();
    this.changed = null;
  }

  toggle(key: string): void {
    const it = this.items.find((i) => i.key === key);
    if (!it?.match?.track?.preview || it.dup) return;
    it.keep = !it.keep;
    this.markDups();
    this.changed?.();
  }

  /**
   * "Wrong match? Pick another": the chosen track replaces the match, which joins the others.
   * A kept row's old song passes to the first row that was set aside as its repeat.
   */
  choose(key: string, track: Track): void {
    const it = this.items.find((i) => i.key === key);
    if (!it?.match) return;
    const old = it.match.track;
    const wasKept = it.keep;
    const others = [...(old ? [old] : []), ...it.match.others.filter((t) => t.id !== track.id)];
    it.match = { ...it.match, track, others, sure: true, why: undefined };
    it.keep = false;
    it.dup = this.isDup(track, it);
    it.keep = !!track.preview && !it.dup;
    const heir = wasKept && old && this.items.find((o) => o !== it && o.dup && o.match?.track?.id === old.id);
    if (heir) { heir.dup = false; heir.keep = true; }
    this.markDups();
    this.changed?.();
  }

  /** The songs to save: kept, playable and new to the pack. */
  kept(): Item[] {
    return this.items.filter((i) => i.keep && i.match?.track?.preview && !i.dup);
  }

  /**
   * Lines whose song will be in the pack once saved: kept, or matched to a song already there
   * (or kept on another row). A saved song needing a rematch is settled by these.
   */
  settled(): Set<string> {
    return new Set(this.items.filter((i) => i.state === 'done' && i.match?.track && (i.keep || i.dup)).map((i) => i.key));
  }

  /** In the pack already, or the same track as another row that is kept. */
  private isDup(t: Track, self: Item): boolean {
    return this.existing.some((s) => s.apple === t.id) || this.items.some((o) => o !== self && o.state === 'done' && o.keep && o.match?.track?.id === t.id);
  }

  /** After any row's keep or track changes, every unkept row's mark is worked out again (a kept row is never a repeat). */
  private markDups() {
    for (const o of this.items) {
      if (o.state === 'done' && !o.keep) o.dup = !!o.match?.track && this.isDup(o.match.track, o);
    }
  }

  private async pump() {
    this.running = true;
    try {
      while (!this.stopped) {
        const it = this.items.find((i) => i.state === 'waiting');
        if (!it) break;
        it.state = 'matching';
        this.changed?.();
        try {
          if (it.wanted.kind === 'playlist') await this.expand(it);
          else this.settle(it, await matchWanted(it.wanted, this.deps));
        } catch {
          // Only the network throws (a song that is not found is a result): pause, keep the line.
          it.state = 'waiting';
          this.error = navigator.onLine === false ? 'No internet. Connect, then try again.' : 'Couldn’t reach Apple Music or YouTube. Try again in a moment.';
          break;
        }
        this.changed?.();
      }
    } finally {
      this.running = false;
      this.changed?.();
    }
  }

  private settle(it: Item, m: Match) {
    it.match = m;
    it.state = 'done';
    it.dup = m.track ? this.isDup(m.track, it) : false;
    // Doubtful matches start kept but marked, so the host looks at them; misses start dropped.
    it.keep = !!m.track?.preview && !it.dup;
    this.markDups();
  }

  /**
   * A playlist line becomes one line per video in it. One YouTube will not list stays as a
   * skipped line, marked for retry, and the list goes on; only a connection problem pauses it.
   */
  private async expand(it: Item) {
    if (it.wanted.kind !== 'playlist') return;
    let ids: string[];
    try {
      ids = [...new Set(await this.deps.readPlaylist(it.wanted.list))];
    } catch (e) {
      if (!(e instanceof PlaylistError) || navigator.onLine === false) throw e;
      it.state = 'done';
      it.match = { line: it.wanted.line, track: null, others: [], sure: false, why: 'That YouTube playlist can’t be read: it may be private or empty', retry: true };
      return;
    }
    it.state = 'done';
    it.match = { line: it.wanted.line, track: null, others: [], sure: false, why: `a playlist of ${ids.length} videos` };
    const at = this.items.indexOf(it);
    const known = new Set(this.items.map((i) => i.key));
    const fresh: Item[] = ids
      .map((id): Wanted => ({ kind: 'youtube', id, line: `https://youtu.be/${id}` }))
      .filter((w) => !known.has(wantedKey(w)))
      .map((w) => ({ key: wantedKey(w), wanted: w, state: 'waiting', match: null, keep: false, dup: false }));
    this.items.splice(at + 1, 0, ...fresh);
  }
}

export function rematchWanted({ title, artist }: LegacySong): Wanted {
  return { kind: 'text', query: `${title} ${artist}`, guesses: [{ title, artist }], line: `${title} - ${artist}` };
}

/** A kept line as a pack song: Apple's id, tidied names, and the YouTube video it came from. */
export function toSong(it: Item, tidy: (t: Track) => { title: string; artist: string }): Song | null {
  const t = it.match?.track;
  if (!t?.preview) return null;
  const song: Song = { ...tidy(t), apple: t.id };
  if (it.match?.youtube) song.youtube = it.match.youtube;
  return song;
}
