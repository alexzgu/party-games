<script lang="ts">
  import { onMount } from 'svelte';
  import FitText from '../../components/FitText.svelte';
  import Button from '../../components/Button.svelte';
  import Ring from './Ring.svelte';
  import Avatar from './Avatar.svelte';
  import JudgeButtons from './JudgeButtons.svelte';
  import { sfx, unlockAudio } from '../../lib/sound';
  import { haptic } from '../../lib/haptics';
  import type { GameState } from './logic';

  // One try at a prompt: the prompt huge, the clock draining under it, a tick every second and a
  // buzzer at zero. Then the room judges on the same screen. Live play: never tap-to-skip.
  let { game, startPaused = false, frozen = false, onjudge, ontimeup, ontick, onleave }: {
    game: GameState;
    startPaused?: boolean;
    /** Demo screens: show the clock as saved, never run it. */
    frozen?: boolean;
    onjudge: (got: boolean) => void;
    ontimeup: () => void;
    ontick: (msLeft: number) => void;
    onleave: () => void;
  } = $props();

  const total = $derived(game.seconds * 1000);
  const who = $derived(game.players[game.actor]);
  const owner = $derived(game.players[game.turn]);
  const judging = $derived(game.phase === 'judge');
  // svelte-ignore state_referenced_locally
  let left = $state(game.phase === 'judge' ? 0 : game.timeLeft || game.seconds * 1000);
  // svelte-ignore state_referenced_locally
  let paused = $state(startPaused);

  // Counts down to a fixed end time, so dropped or slow frames never stretch the clock.
  // onMount, not $effect: the loop writes `left` and the parent saves `game` every second,
  // and neither may restart the clock.
  onMount(() => {
    const onHide = () => { if (document.visibilityState === 'hidden' && game.phase === 'live') pause(); };
    document.addEventListener('visibilitychange', onHide);
    if (frozen || game.phase !== 'live') return () => document.removeEventListener('visibilitychange', onHide);
    let endAt = performance.now() + left;
    let wasPaused = paused;
    let lastSec = Math.ceil(left / 1000);
    let raf = 0;
    const loop = () => {
      const now = performance.now();
      if (paused) {
        wasPaused = true;
      } else {
        if (wasPaused) { endAt = now + left; wasPaused = false; }
        left = Math.max(0, endAt - now);
        const sec = Math.ceil(left / 1000);
        if (sec !== lastSec) {
          lastSec = sec;
          ontick(left);
          if (sec > 0) { if (sec <= 2) sfx.warn(); else sfx.tick(); haptic.light(); }
        }
        if (left <= 0) {
          sfx.buzzer();
          haptic.end();
          ontimeup();
          return;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', onHide); };
  });

  let dialog = $state<HTMLElement>();
  $effect(() => { if (paused) dialog?.focus(); });

  function pause() {
    paused = true;
    ontick(left);
  }

  function resume() {
    unlockAudio();
    paused = false;
  }
</script>

<div class="turn" class:blur={paused} class:judging>
  <header>
    <p class="who"><Avatar name={who.name} index={game.actor} size={30} /> <span>{who.name}</span></p>
    {#if game.stealing}<span class="badge steal">Steal</span>{/if}
  </header>

  <section class="card" aria-label="Your prompt">
    <p class="lead">Name 3</p>
    <div class="prompt"><FitText text={game.prompt ?? ''} max={84} min={24} /></div>
    {#if game.stealing}<p class="note">Different from what {owner.name} said</p>{/if}
  </section>

  <div class="clock"><Ring {left} {total} done={judging} /></div>

  <div class="foot">
    {#if judging}
      <JudgeButtons name={who.name} {onjudge} />
    {:else}
      <Button size="lg" onclick={() => onjudge(true)} tip="Stops the clock and scores the point">✓ All 3</Button>
    {/if}
  </div>
</div>

{#if paused}
  <div class="paused fade-in" role="dialog" aria-modal="true" aria-label="Paused" tabindex="-1" bind:this={dialog}>
    <p class="ptitle">Paused</p>
    <p class="muted">{who.name} had {Math.ceil(left / 1000)} {Math.ceil(left / 1000) === 1 ? 'second' : 'seconds'} left on “{game.prompt}”.</p>
    <div class="pactions">
      <Button size="lg" onclick={resume}>Resume</Button>
      <Button variant="ghost" onclick={onleave} tip="The game is saved so you can come back to it">Setup</Button>
    </div>
  </div>
{/if}

<style>
  .turn {
    min-height: 100dvh; max-width: 640px; margin: 0 auto;
    display: flex; flex-direction: column; gap: var(--s-3);
    padding: calc(var(--safe-top) + var(--s-3)) calc(var(--safe-right) + var(--s-4)) calc(var(--safe-bottom) + var(--s-4)) calc(var(--safe-left) + var(--s-4));
    -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
  }
  .turn.blur { filter: blur(18px); pointer-events: none; }
  header { display: flex; align-items: center; justify-content: space-between; gap: var(--s-2); min-height: 48px; }
  .who { display: flex; align-items: center; gap: var(--s-2); font-weight: 800; font-size: 1.15rem; min-width: 0; }
  .who span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .badge {
    flex: none; padding: 6px 14px; border-radius: var(--r-pill); font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; font-size: 0.85rem;
    color: var(--c-pass); border: 2px solid var(--c-pass); background: color-mix(in srgb, var(--c-pass) 14%, transparent);
  }

  .card {
    flex: 1 1 200px; min-height: 180px; display: flex; flex-direction: column; padding: var(--s-4) var(--s-4) var(--s-4);
    border-radius: 28px; border: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); box-shadow: var(--shadow);
    background: radial-gradient(120% 90% at 0% 0%, color-mix(in srgb, var(--accent) 26%, transparent), transparent 65%), var(--bg-raised);
  }
  .lead { text-align: center; color: var(--accent); font-family: var(--font-display); font-weight: 800; font-size: 1.5rem; text-transform: uppercase; letter-spacing: 0.08em; line-height: 1; }
  .prompt { flex: 1; min-height: 0; position: relative; }
  .note { text-align: center; color: var(--c-pass); font-weight: 700; }

  .clock { flex: none; width: min(70vw, 32dvh, 300px); margin: 0 auto; }
  .foot { flex: none; min-height: 116px; display: flex; flex-direction: column; justify-content: flex-end; }

  /* A phone on its side: the prompt on the left at full height, the clock and the buttons on the right. */
  @media (orientation: landscape) and (max-height: 500px) {
    .turn {
      height: 100dvh; max-width: 960px; display: grid; column-gap: var(--s-5); row-gap: var(--s-2);
      grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr) auto;
      padding-bottom: calc(var(--safe-bottom) + var(--s-2));
    }
    header { grid-column: 1 / -1; min-height: 44px; }
    .card { grid-column: 1; grid-row: 2 / 4; min-height: 0; }
    .clock { grid-column: 2; grid-row: 2; align-self: center; width: auto; height: 100%; max-height: min(100%, 220px); aspect-ratio: 1; min-height: 0; }
    .foot { grid-column: 2; grid-row: 3; min-height: 0; }
  }

  .paused {
    position: fixed; inset: 0; z-index: var(--z-overlay); display: flex; flex-direction: column; justify-content: center; gap: var(--s-4);
    padding: calc(var(--safe-top) + var(--s-5)) var(--s-5) calc(var(--safe-bottom) + var(--s-5));
    background: color-mix(in srgb, var(--bg) 82%, transparent); text-align: center;
  }
  .paused:focus { outline: none; }
  .ptitle { font-family: var(--font-display); font-weight: 800; font-size: 3rem; }
  .pactions { display: flex; flex-direction: column; gap: var(--s-2); margin-top: var(--s-4); max-width: 480px; width: 100%; margin-inline: auto; }
  @media (orientation: landscape) and (max-height: 500px) {
    .paused { gap: var(--s-2); padding-top: calc(var(--safe-top) + var(--s-3)); padding-bottom: calc(var(--safe-bottom) + var(--s-3)); overflow-y: auto; }
    .ptitle { font-size: 2.2rem; line-height: 1.1; }
    .pactions { margin-top: var(--s-2); }
  }
</style>
