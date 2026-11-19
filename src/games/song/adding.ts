// The "Add songs" review list: lines go in (pasted, from a playlist, or from Claude), are
// matched one at a time through the rate-limited matcher, and stream into the list for the
// host to keep, drop or re-pick. Knows nothing about screens, so the tests drive it with fakes.
import type { Song } from '../../lib/content';
import { matchWanted, wantedKey, type Match, type MatchDeps, type Track, type Wanted } from './match';

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
  /** A YouTube playlist's video ids. */
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
    private changed: () => void,
    restored: Item[] = [],
  ) {
    // A list saved mid-match carries on from where it was.
    this.items = restored.map((it) => (it.state === 'matching' ? { ...it, state: 'waiting' } : it));
  }

  /** Adds lines (repeats of lines already in the list are ignored) and starts matching. */
  add(wanted: Wanted[]): number {
    const known = new Set(this.items.map((i) => i.key));
    let added = 0;
    for (const w of wanted) {
      const key = wantedKey(w);
      if (known.has(key)) continue;
      known.add(key);
      this.items.push({ key, wanted: w, state: 'waiting', match: null, keep: false, dup: false });
      added++;
    }
    this.changed();
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
    this.stopped = false;
    this.error = '';
    if (!this.running) void this.pump();
  }

  /** Pauses after the line being matched now. */
  stop(): void {
    this.stopped = true;
  }

  toggle(key: string): void {
    const it = this.items.find((i) => i.key === key);
    if (!it?.match?.track?.preview) return;
    it.keep = !it.keep;
    this.changed();
  }

  /** "Wrong match? Pick another": the chosen track replaces the match, which joins the others. */
  choose(key: string, track: Track): void {
    const it = this.items.find((i) => i.key === key);
    if (!it?.match) return;
    const old = it.match.track;
    const others = [...(old ? [old] : []), ...it.match.others.filter((t) => t.id !== track.id)];
    it.match = { ...it.match, track, others, sure: true, why: undefined };
    it.dup = this.isDup(track, it);
    it.keep = !!track.preview && !it.dup;
    this.changed();
  }

  /** The songs to save: kept, playable and new to the pack. */
  kept(): Item[] {
    return this.items.filter((i) => i.keep && i.match?.track?.preview && !i.dup);
  }

  private isDup(t: Track, self: Item): boolean {
    return this.existing.some((s) => s.apple === t.id) || this.items.some((o) => o !== self && o.state === 'done' && o.keep && o.match?.track?.id === t.id);
  }

  private async pump() {
    this.running = true;
    try {
      while (!this.stopped) {
        const it = this.items.find((i) => i.state === 'waiting');
        if (!it) break;
        it.state = 'matching';
        this.changed();
        try {
          if (it.wanted.kind === 'playlist') await this.expand(it);
          else this.settle(it, await matchWanted(it.wanted, this.deps));
        } catch {
          // Only the network throws (a song that is not found is a result): pause, keep the line.
          it.state = 'waiting';
          this.error = navigator.onLine === false ? 'No internet. Connect, then try again.' : 'Couldn’t reach Apple Music or YouTube. Try again in a moment.';
          break;
        }
        this.changed();
      }
    } finally {
      this.running = false;
      this.changed();
    }
  }

  private settle(it: Item, m: Match) {
    it.match = m;
    it.state = 'done';
    it.dup = m.track ? this.isDup(m.track, it) : false;
    // Doubtful matches start kept but marked, so the host looks at them; misses start dropped.
    it.keep = !!m.track?.preview && !it.dup;
  }

  /** A playlist line becomes one line per video in it. */
  private async expand(it: Item) {
    if (it.wanted.kind !== 'playlist') return;
    const ids = await this.deps.readPlaylist(it.wanted.list);
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

/** A kept line as a pack song: Apple's id, tidied names, and the YouTube video it came from. */
export function toSong(it: Item, tidy: (t: Track) => { title: string; artist: string }): Song | null {
  const t = it.match?.track;
  if (!t?.preview) return null;
  const song: Song = { ...tidy(t), apple: t.id };
  if (it.match?.youtube) song.youtube = it.match.youtube;
  return song;
}
