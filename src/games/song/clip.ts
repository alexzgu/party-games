// Plays one clip of a YouTube video: from the song's start second for N seconds, then pauses.
// Works on anything shaped like the IFrame API player, so tests drive it with a fake. It watches
// the player instead of trusting it: the clip only counts while the video's own clock is inside
// the clip, so an ad (other video, or our video stuck before the start) never eats the clip.

/** The parts of YT.Player this uses. */
export interface PlayerLike {
  cueVideoById(o: { videoId: string; startSeconds?: number }): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getPlayerState(): number;
  getVideoData?(): { video_id?: string } | undefined;
}

/** YT.PlayerState values. */
export const STATE = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const;

/** Player errors that mean this video can never play embedded: removed (100) or embedding off (101, 150). */
export const PERMANENT_ERRORS = [100, 101, 150];

export type ClipStatus =
  | 'idle' // nothing loaded yet
  | 'cued' // the video is loaded and waiting
  | 'starting' // play was asked for; no sound yet
  | 'ad' // YouTube is playing something else first
  | 'playing' // the clip is playing
  | 'done' // the clip (or the reveal) finished and paused
  | 'blocked' // the browser would not start sound: the player itself needs a tap
  | 'payoff' // the reveal: the video plays on, uncovered
  | 'error';

export interface Clock {
  now(): number;
  /** Calls fn every ms until the returned stop function is called. */
  every(ms: number, fn: () => void): () => void;
}

export const realClock: Clock = {
  now: () => performance.now(),
  every: (ms, fn) => { const t = setInterval(fn, ms); return () => clearInterval(t); },
};

export interface ClipEvents {
  status(s: ClipStatus): void;
  /** Fraction of the clip heard so far, 0–1, while it plays. */
  progress?(f: number): void;
  error?(code: number, videoId: string): void;
}

/** How long the video may play outside the clip before it counts as an ad. */
export const AD_AFTER_MS = 1200;
/** How long play may go unanswered (not even buffering) before the player needs a tap. */
export const BLOCKED_AFTER_MS = 3500;
const TICK_MS = 100;
/** How far before the start the video's clock may be and still count as the clip. */
const EARLY_S = 1;

export class Clip {
  status: ClipStatus = 'idle';
  videoId = '';
  private start = 0;
  private until = 0;
  private mode: 'clip' | 'payoff' | null = null;
  private askedAt = 0;
  private wrongSince = 0;
  private lastSeek = 0;
  private payoffEnd = 0;
  private stopWatch: (() => void) | null = null;

  constructor(private p: PlayerLike, private on: ClipEvents, private clock: Clock = realClock) {}

  /** Loads a video at its clip start, ready for play() without a wait. */
  cue(videoId: string, start: number): void {
    this.unwatch();
    this.mode = null;
    this.videoId = videoId;
    this.start = start;
    this.p.cueVideoById({ videoId, startSeconds: start });
    this.set('cued');
  }

  /** Plays the cued video from the clip start for `seconds`. Call it inside the tap (iOS). */
  play(seconds: number): void {
    if (!this.videoId) return;
    this.mode = 'clip';
    this.until = this.start + seconds;
    this.askedAt = this.clock.now();
    this.lastSeek = this.askedAt;
    this.wrongSince = 0;
    this.p.seekTo(this.start, true);
    this.p.playVideo();
    this.on.progress?.(0);
    this.set('starting');
    this.watch();
  }

  /** The reveal: let the video play on from where it is for `seconds`, then pause. */
  payoff(seconds: number): void {
    if (!this.videoId) return;
    this.mode = 'payoff';
    this.payoffEnd = this.clock.now() + seconds * 1000;
    this.p.playVideo();
    this.set('payoff');
    this.watch();
  }

  /** Pauses whatever is playing. */
  stop(): void {
    const was = this.mode;
    this.unwatch();
    this.mode = null;
    try { this.p.pauseVideo(); } catch { /* player gone */ }
    if (was) this.set('done');
  }

  /** Wire to the player's onError event. */
  fail(code: number): void {
    this.unwatch();
    this.mode = null;
    this.set('error');
    this.on.error?.(code, this.videoId);
  }

  /** Wire to the player's onStateChange event: answers at once instead of on the next tick. */
  changed(): void {
    if (this.mode) this.tick();
  }

  /** Stops watching for good (screen closed). */
  dispose(): void {
    this.unwatch();
    this.mode = null;
  }

  private set(s: ClipStatus) {
    if (this.status === s) return;
    this.status = s;
    this.on.status(s);
  }

  private watch() {
    if (!this.stopWatch) this.stopWatch = this.clock.every(TICK_MS, () => this.tick());
  }

  private unwatch() {
    this.stopWatch?.();
    this.stopWatch = null;
  }

  private finish() {
    this.unwatch();
    this.mode = null;
    try { this.p.pauseVideo(); } catch { /* player gone */ }
    this.set('done');
  }

  private tick() {
    const now = this.clock.now();
    const state = this.p.getPlayerState();
    if (this.mode === 'payoff') {
      if (now >= this.payoffEnd || state === STATE.ENDED) this.finish();
      return;
    }
    if (this.mode !== 'clip') return;
    if (state === STATE.ENDED) { this.finish(); return; }
    const t = this.p.getCurrentTime();
    const shown = this.p.getVideoData?.()?.video_id;
    const ours = !shown || shown === this.videoId;
    const inClip = ours && t >= this.start - EARLY_S && t <= this.until + 2;
    if (state === STATE.PLAYING && inClip) {
      this.wrongSince = 0;
      this.set('playing');
      this.on.progress?.(Math.min(1, Math.max(0, (t - this.start) / (this.until - this.start))));
      if (t >= this.until) this.finish();
      return;
    }
    if (state === STATE.PLAYING) {
      // Sound, but not our clip: an ad, or our video playing from the wrong place.
      if (ours && now - this.lastSeek >= 1000) { this.lastSeek = now; this.p.seekTo(this.start, true); }
      if (!this.wrongSince) this.wrongSince = now;
      if (now - this.wrongSince >= AD_AFTER_MS) this.set('ad');
      return;
    }
    // Not playing. Buffering is patience; never leaving cued/unstarted means the browser said no.
    const stuck = state === STATE.UNSTARTED || state === STATE.CUED || state === STATE.PAUSED;
    if (this.status === 'starting' && stuck && now - this.askedAt >= BLOCKED_AFTER_MS) this.set('blocked');
  }
}
