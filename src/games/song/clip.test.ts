import { describe, expect, it } from 'vitest';
import { AD_AFTER_MS, BLOCKED_AFTER_MS, Clip, STATE, type Clock, type PlayerLike } from './clip';

/** A stand-in for YT.Player: time runs while it plays; it can be told to block, error or show an ad. */
class FakePlayer implements PlayerLike {
  state: number = STATE.UNSTARTED;
  time = 0;
  id = '';
  shown = '';
  /** ms of ad left before our video plays. */
  adLeft = 0;
  /** The browser refuses to start sound (iPhone without a tap). */
  blocked = false;
  /** seekTo is ignored (as during an ad). */
  seeks: number[] = [];
  cueVideoById({ videoId, startSeconds = 0 }: { videoId: string; startSeconds?: number }) { this.id = videoId; this.shown = videoId; this.time = startSeconds; this.state = STATE.CUED; }
  playVideo() {
    if (this.blocked) return;
    this.state = STATE.PLAYING;
    if (this.adLeft > 0) this.shown = 'AD_________';
  }
  pauseVideo() { if (this.state === STATE.PLAYING) this.state = STATE.PAUSED; }
  seekTo(s: number) { this.seeks.push(s); if (this.adLeft <= 0) this.time = s; }
  getCurrentTime() { return this.adLeft > 0 ? 0 : this.time; }
  getPlayerState() { return this.state; }
  getVideoData() { return { video_id: this.shown }; }
  advance(ms: number) {
    if (this.state !== STATE.PLAYING) return;
    if (this.adLeft > 0) {
      this.adLeft -= ms;
      if (this.adLeft <= 0) { this.shown = this.id; this.time = 0; } // after an ad YouTube starts at 0
      return;
    }
    this.time += ms / 1000;
  }
}

function setup(player = new FakePlayer()) {
  let now = 0;
  let fn: (() => void) | null = null;
  const clock: Clock = { now: () => now, every: (_ms, f) => { fn = f; return () => { fn = null; }; } };
  const statuses: string[] = [];
  const errors: [number, string][] = [];
  let progress = 0;
  const clip = new Clip(player, { status: (s) => statuses.push(s), progress: (f) => (progress = f), error: (c, id) => errors.push([c, id]) }, clock);
  const run = (ms: number) => { for (let t = 0; t < ms; t += 100) { now += 100; player.advance(100); fn?.(); } };
  return { player, clip, statuses, errors, run, progress: () => progress, watching: () => fn !== null };
}

describe('Clip', () => {
  it('plays from the start for the clip length, then pauses', () => {
    const { player, clip, statuses, run, progress } = setup();
    clip.cue('abcdefghijk', 60);
    clip.play(2);
    run(1000);
    expect(clip.status).toBe('playing');
    expect(progress()).toBeCloseTo(0.5, 1);
    run(1200);
    expect(clip.status).toBe('done');
    expect(player.state).toBe(STATE.PAUSED);
    expect(player.time).toBeGreaterThanOrEqual(62);
    expect(statuses).toEqual(['cued', 'starting', 'playing', 'done']);
  });

  it('Longer replays from the start for the longer length', () => {
    const { player, clip, run } = setup();
    clip.cue('abcdefghijk', 30);
    clip.play(2);
    run(2500);
    clip.play(5);
    expect(player.time).toBe(30);
    run(4000);
    expect(clip.status).toBe('playing');
    run(1500);
    expect(clip.status).toBe('done');
  });

  it('waits out an ad without counting it, says so, then plays the clip from its start', () => {
    const player = new FakePlayer();
    player.adLeft = 5000;
    const { clip, statuses, run } = setup(player);
    clip.cue('abcdefghijk', 45);
    clip.play(2);
    run(AD_AFTER_MS + 200);
    expect(clip.status).toBe('ad');
    run(3600);
    expect(clip.status).toBe('ad');
    // The ad ends and YouTube restarts the video at 0: the clip seeks back to its start.
    run(1300);
    expect(clip.status).toBe('playing');
    expect(player.time).toBeGreaterThanOrEqual(45);
    run(2500);
    expect(clip.status).toBe('done');
    expect(statuses).toContain('ad');
  });

  it('says the player needs a tap when the browser will not start the sound, and recovers when it plays', () => {
    const player = new FakePlayer();
    player.blocked = true;
    const { clip, run } = setup(player);
    clip.cue('abcdefghijk', 10);
    clip.play(2);
    run(BLOCKED_AFTER_MS + 100);
    expect(clip.status).toBe('blocked');
    // The player was tapped directly: YouTube starts it.
    player.blocked = false;
    player.playVideo();
    run(500);
    expect(clip.status).toBe('playing');
  });

  it('does not call buffering blocked', () => {
    const { player, clip, run } = setup();
    clip.cue('abcdefghijk', 10);
    clip.play(2);
    player.state = STATE.BUFFERING;
    run(BLOCKED_AFTER_MS + 1000);
    expect(clip.status).toBe('starting');
  });

  it('reports an error with the video id and stops watching', () => {
    const { clip, errors, watching } = setup();
    clip.cue('abcdefghijk', 10);
    clip.play(2);
    clip.fail(150);
    expect(clip.status).toBe('error');
    expect(errors).toEqual([[150, 'abcdefghijk']]);
    expect(watching()).toBe(false);
  });

  it('the payoff plays on for its seconds, and stop() ends it early', () => {
    const { player, clip, run } = setup();
    clip.cue('abcdefghijk', 10);
    clip.play(2);
    run(2500);
    clip.payoff(6);
    expect(clip.status).toBe('payoff');
    run(3000);
    expect(player.state).toBe(STATE.PLAYING);
    run(3100);
    expect(clip.status).toBe('done');
    expect(player.state).toBe(STATE.PAUSED);
    clip.payoff(6);
    clip.stop();
    expect(clip.status).toBe('done');
    expect(player.state).toBe(STATE.PAUSED);
  });
});
