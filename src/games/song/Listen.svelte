<script lang="ts">
  import Button from '../../components/Button.svelte';
  import Avatar from './Avatar.svelte';
  import { CLIPS, POINTS, clipSeconds, pointsNow, type GameState } from './logic';
  import type { ClipStatus } from './ui';

  // The host's screen while the room listens: replay or lengthen the clip, then tap who named
  // it. The spinning record (Stage) sits between the header and these controls.
  let { game, status, note = '', connection = '', onretry, onagain, onlonger, onaward, onnobody, onskip, onleave }: {
    game: GameState;
    status: ClipStatus;
    note?: string;
    connection?: '' | 'offline' | 'failed';
    onretry?: () => void;
    onagain: () => void;
    onlonger: () => void;
    onaward: (player: number) => void;
    onnobody: () => void;
    onskip: () => void;
    onleave: () => void;
  } = $props();

  const last = $derived(game.step >= CLIPS.length - 1);
  const nextLen = $derived(CLIPS[Math.min(game.step + 1, CLIPS.length - 1)]);
  const nextPts = $derived(POINTS[Math.min(game.step + 1, POINTS.length - 1)]);
  const loaded = $derived(status !== 'loading' && status !== 'error');
  const fresh = $derived(status === 'ready');

  // Taps this soon after the screen appears are the tail of the Play tap: neither names nor
  // "Nobody got it" may reveal the song then.
  const shownAt = performance.now();
  const settled = () => performance.now() - shownAt >= 400;
  const pick = (i: number) => { if (settled()) onaward(i); };
  const nobody = () => { if (settled()) onnobody(); };

  // Laptop or TV host: Space plays again, L plays longer, 1–9 award, 0 nobody.
  function key(e: KeyboardEvent) {
    if ((connection && e.target instanceof HTMLButtonElement) || e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (loaded) onagain(); }
    else if (e.key.toLowerCase() === 'l' && !last && loaded) onlonger();
    else if (e.key === '0') nobody();
    else if (/^[1-9]$/.test(e.key) && game.players[Number(e.key) - 1]) pick(Number(e.key) - 1);
  }
</script>

<svelte:window onkeydown={key} />

<header class="top">
  <button class="icon-btn" onclick={onleave} aria-label="Back to setup (game is saved)">
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </button>
  <p class="song">Song {game.songsPlayed + 1}</p>
  <p class="worth" aria-live="polite"><b>{pointsNow(game)}</b> {pointsNow(game) === 1 ? 'pt' : 'pts'} · {clipSeconds(game)} s</p>
</header>

<div class="controls">
  {#if note}<p class="note" role="status">{note}</p>{/if}
  {#if connection}
    <p class="note" role="alert">{connection === 'offline' ? 'No internet. Reconnect to play this song.' : 'Can’t reach Apple Music. Check your connection.'}</p>
    <Button onclick={onretry}>Retry</Button>
  {/if}
  <div class="row">
    <Button variant={fresh ? 'primary' : 'secondary'} onclick={onagain} disabled={!loaded}>{fresh ? '▶ Play' : '↺ Again'}</Button>
    <Button variant="secondary" onclick={onlonger} disabled={last || !loaded}>
      {last ? 'Longest clip' : `Longer: ${nextLen} s · ${nextPts} pt${nextPts > 1 ? 's' : ''}`}
    </Button>
  </div>

  <h3 class="who">Who named it?</h3>
  <div class="grid" class:three={game.players.length > 6}>
    {#each game.players as p, i (i)}
      <button class="player" onclick={() => pick(i)}>
        <Avatar name={p.name} index={i} size={30} />
        <span>{p.name}</span>
      </button>
    {/each}
  </div>

  <!-- Nobody ends the song (the answer shows); Skip swaps it unheard, so it is only a small link. -->
  <Button variant="secondary" onclick={nobody}>🤷 Nobody got it</Button>
  <button class="skip" onclick={onskip}>Skip this song (no points, it isn’t shown)</button>
</div>

<style>
  .top { order: 0; display: flex; align-items: center; justify-content: space-between; gap: var(--s-2); min-height: 56px; }
  .icon-btn { width: 48px; height: 48px; border-radius: var(--r-pill); border: 0; background: var(--surface); color: var(--text); display: grid; place-items: center; flex: none; }
  .song { font-family: var(--font-display); font-weight: 800; font-size: 1.35rem; }
  .worth { color: var(--text-dim); font-weight: 600; white-space: nowrap; min-width: 48px; text-align: right; }
  .worth b { color: var(--c-gold); font-family: var(--font-display); font-size: 1.4rem; }
  .controls { order: 2; display: flex; flex-direction: column; gap: var(--s-2); padding-bottom: calc(var(--safe-bottom) + var(--s-3)); }
  .note { color: var(--c-pass); font-weight: 600; text-align: center; }
  .row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s-2); }
  .row :global(.btn) { padding: 0 var(--s-3); font-size: 1.02rem; }
  .who { font-family: var(--font-body); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-dim); margin-top: var(--s-2); }
  .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s-2); }
  .grid.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .player {
    min-height: var(--tap); padding: var(--s-2) var(--s-3); border-radius: var(--r-md);
    border: 1.5px solid var(--line-strong); background: var(--surface);
    display: flex; align-items: center; gap: var(--s-2); font-weight: 700; font-size: 1.1rem; text-align: left;
    transition: transform var(--dur-fast) var(--ease-out), background var(--dur-fast) ease;
  }
  .player span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .grid.three .player { font-size: 1rem; padding: var(--s-2); justify-content: center; text-align: center; }
  .grid.three .player :global(.avatar) { display: none; }
  @media (max-height: 760px) {
    .grid.three .player { min-height: var(--tap-min); }
    .who { margin-top: 0; }
  }
  .skip { align-self: center; min-height: 44px; padding: 0 var(--s-3); background: none; border: 0; color: var(--text-dim); font-size: 0.9rem; text-decoration: underline; text-underline-offset: 3px; }
  .player:active { transform: scale(0.96); background: color-mix(in srgb, var(--c-good) 30%, var(--surface)); }
</style>
