<script lang="ts">
  import { gameName } from '../../app.config';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import { CLIPS, POINTS, type GameState } from './logic';

  // Before each song: the room quiets down, the host taps Play. That tap starts the sound
  // (iPhones only allow it inside a tap), so the big button is the whole screen's point.
  let { game, canPlay, problem, note = '', onplay, onretry, onleave }: {
    game: GameState;
    /** The player has the song loaded. */
    canPlay: boolean;
    /** '' or why YouTube cannot be reached. */
    problem: '' | 'offline' | 'failed' | 'empty';
    note?: string;
    onplay: () => void;
    onretry: () => void;
    onleave: () => void;
  } = $props();

  const first = $derived(game.songsPlayed === 0 && game.players.every((p) => p.score === 0));
  // Taps this soon after the screen appears are the tail of the previous screen's tap.
  const shownAt = performance.now();
  function play() {
    if (performance.now() - shownAt < 400 || !canPlay) return;
    onplay();
  }
</script>

<Screen title={gameName('song')} onback={onleave} backLabel="Back to setup">
<div class="center">
  <p class="kicker">Song {game.songsPlayed + 1}</p>

  {#if problem}
    <div class="problem" role="alert">
      <span class="icon" aria-hidden="true">{problem === 'offline' ? '📵' : problem === 'empty' ? '📭' : '⚠️'}</span>
      {#if problem === 'offline'}
        <p><b>No internet.</b> {gameName('song')} streams songs from YouTube, so this phone needs to be online. Connect, then try again.</p>
      {:else if problem === 'empty'}
        <p><b>No songs to play.</b> Go back and pick a pack with songs in it.</p>
      {:else}
        <p><b>Can’t reach YouTube.</b> Check the internet connection (some school or work Wi-Fi blocks YouTube), then try again.</p>
      {/if}
    </div>
  {:else}
    <button class="play" class:off={!canPlay} onclick={play} aria-label={canPlay ? 'Play the clip' : 'Loading the song'} aria-disabled={!canPlay}>
      <span class="halo" aria-hidden="true"></span>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" /></svg>
    </button>
    <p class="hint">{canPlay ? 'Everyone quiet. Tap to play.' : 'Loading the song…'}</p>
  {/if}

  {#if note}<p class="note" role="status">{note}</p>{/if}

  {#if first && !problem}
    <ol class="how" aria-label="How to play">
      <li>Shout the song's title the moment you know it.</li>
      <li>{POINTS[0]} points on the {CLIPS[0]}-second clip, {POINTS[1]} at {CLIPS[1]}&nbsp;seconds, {POINTS[2]} at&nbsp;{CLIPS[2]}.</li>
      <li>First to {game.target} points wins.</li>
    </ol>
  {:else if !problem}
    <p class="meta">First to {game.target} wins</p>
  {/if}
</div>

  {#snippet actions()}
    {#if problem && problem !== 'empty'}<Button size="lg" onclick={onretry}>Try again</Button>{/if}
  {/snippet}
</Screen>

<style>
  .center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--s-4); text-align: center; }
  .kicker { color: var(--text-dim); font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; }
  .play {
    position: relative; margin: var(--s-3) 0; width: min(56vw, 220px); aspect-ratio: 1; border-radius: 50%; border: 0;
    background: var(--accent); color: var(--on-accent); display: grid; place-items: center;
    box-shadow: 0 14px 44px color-mix(in srgb, var(--accent) calc(45% * var(--glow)), transparent);
    transition: transform var(--dur-fast) var(--ease-out), opacity var(--dur) ease;
  }
  .play svg { width: 44%; height: 44%; margin-left: 8%; position: relative; }
  .play:active { transform: scale(0.95); }
  .play.off { opacity: 0.45; }
  .halo { position: absolute; inset: -14px; border-radius: 50%; border: 3px solid color-mix(in srgb, var(--accent) 45%, transparent); animation: breathe 2.4s ease-in-out infinite; }
  .play.off .halo { animation: none; opacity: 0.3; }
  .hint { font-family: var(--font-display); font-weight: 800; font-size: 1.4rem; }
  .note { color: var(--c-pass); font-weight: 600; max-width: 32ch; }
  .problem {
    display: flex; gap: var(--s-3); align-items: flex-start; text-align: left; padding: var(--s-4);
    border-radius: var(--r-lg); background: var(--bg-raised); border: 1.5px solid var(--line-strong); max-width: 30rem;
  }
  .problem .icon { font-size: 2rem; }
  .problem p { margin: 0; }
  .how { margin: 0; padding: var(--s-4) var(--s-4) var(--s-4) calc(var(--s-4) + 1.2em); border-radius: var(--r-md); background: var(--surface); color: var(--text-dim); display: flex; flex-direction: column; gap: var(--s-2); text-align: left; align-self: stretch; }
  .meta { color: var(--text-faint); }
  @keyframes breathe { 50% { transform: scale(1.06); opacity: 0.5; } }
  @media (prefers-reduced-motion: reduce) { .halo { animation: none; } }
</style>
