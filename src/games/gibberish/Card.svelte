<script lang="ts">
  import { onMount } from 'svelte';
  import FitText from '../../components/FitText.svelte';
  import Button from '../../components/Button.svelte';
  import HoldAnswer from './HoldAnswer.svelte';
  import Ring from './Ring.svelte';
  import Avatar from './Avatar.svelte';
  import { sfx, unlockAudio } from '../../lib/sound';
  import { haptic } from '../../lib/haptics';
  import type { GameState } from './logic';

  // The reader's view: phrase huge, category and answer on request, timer, and one big
  // button per guesser to hand out the point.
  let {
    game,
    startPaused = false,
    showCategory = false,
    peek = false,
    onaward,
    onnobody,
    ontimeout,
    onskip,
    onleave,
    ontick,
  }: {
    game: GameState;
    startPaused?: boolean;
    showCategory?: boolean;
    peek?: boolean;
    onaward: (player: number) => void;
    onnobody: () => void;
    ontimeout: () => void;
    onskip: () => void;
    onleave: () => void;
    ontick: (msLeft: number) => void;
  } = $props();

  const card = $derived(game.card!);
  const total = $derived(game.seconds * 1000);
  const guessers = $derived(game.players.map((p, i) => ({ p, i })).filter(({ i }) => i !== game.reader));
  const reader = $derived(game.players[game.reader]);
  // svelte-ignore state_referenced_locally
  let left = $state(game.timeLeft || game.seconds * 1000);
  // svelte-ignore state_referenced_locally
  let paused = $state(startPaused);

  // Taps this soon after the card (or the resumed card) appears are the tail of a double tap
  // on the previous screen, so they must not hand out a point.
  const GUARD_MS = 400;
  let shownAt = performance.now();
  const settled = () => performance.now() - shownAt >= GUARD_MS;

  // Counts down to a fixed end time, so dropped or slow frames never stretch the clock.
  // onMount, not $effect: the loop writes `left` and the parent saves `game` every second,
  // and neither may restart the timer.
  onMount(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') pause(); };
    document.addEventListener('visibilitychange', onHide);
    if (game.seconds === 0) return () => document.removeEventListener('visibilitychange', onHide);
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
          if (sec > 0 && sec <= 5) { sfx.tick(); haptic.light(); }
        }
        if (left <= 0) {
          sfx.buzzer();
          haptic.end();
          ontimeout();
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

  function resume() {
    unlockAudio();
    paused = false;
    shownAt = performance.now();
  }

  function pick(i: number) {
    if (settled()) onaward(i);
  }

  function pause() {
    paused = true;
    ontick(left);
  }

  function revealCategory() {
    if (!settled()) return;
    showCategory = true;
    sfx.tap();
  }
</script>

<div class="card-screen" class:blur={paused}>
  <header>
    <button class="icon-btn" onclick={() => settled() && pause()} aria-label="Pause">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M8 5v14M16 5v14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>
    </button>
    <p class="reader"><Avatar name={reader.name} index={game.reader} size={26} /> <span class="rname">{reader.name} reads</span></p>
    {#if total > 0}<Ring {left} {total} size={64} />{:else}<span class="spacer"></span>{/if}
  </header>

  <div class="read">
    <section class="bubble" aria-label="Phrase to read out loud">
      <p class="say">Say it out loud</p>
      <div class="phrase"><FitText text={card.phrase} max={112} min={26} /></div>
    </section>

    <div class="tools">
      {#if showCategory}
        <div class="category fade-in" role="status"><span>Category</span><b>{card.hint || 'Anything'}</b></div>
      {:else}
        <button class="show-cat" onclick={revealCategory} data-tip="Shows what kind of thing the answer is"><span aria-hidden="true">💡</span> Show category</button>
      {/if}
      <HoldAnswer answer={card.answer} bind:peek />
    </div>
  </div>

  <div class="judge">
    <h3 class="who">Who said it first?</h3>
    <div class="grid" class:three={guessers.length > 6}>
      {#each guessers as { p, i } (i)}
        <button class="player" onclick={() => pick(i)}>
          <Avatar name={p.name} index={i} size={30} />
          <span>{p.name}</span>
        </button>
      {/each}
    </div>

    <div class="row">
      <Button variant="secondary" onclick={onnobody} tip="Shows the answer; nobody scores">Nobody</Button>
      <Button variant="ghost" onclick={onskip} tip="Swaps this card for a new one; nobody scores">↻ Skip card</Button>
    </div>
  </div>
</div>

{#if paused}
  <div class="paused fade-in" role="dialog" aria-modal="true" aria-label="Paused" tabindex="-1" bind:this={dialog}>
    <p class="ptitle">Paused</p>
    <p class="muted">{reader.name} was reading. Only {reader.name} should see the next screen.</p>
    <div class="pactions">
      <Button size="lg" onclick={resume}>Resume</Button>
      <Button variant="secondary" onclick={() => { paused = false; onskip(); }} tip="Swaps this card for a new one; nobody scores">Skip</Button>
      <Button variant="ghost" onclick={onleave} tip="The game is saved so you can come back to it">Setup</Button>
    </div>
  </div>
{/if}

<style>
  .card-screen {
    min-height: 100dvh; max-width: 640px; margin: 0 auto;
    display: flex; flex-direction: column; gap: var(--s-3);
    padding: calc(var(--safe-top) + var(--s-3)) calc(var(--safe-right) + var(--s-4)) calc(var(--safe-bottom) + var(--s-4)) calc(var(--safe-left) + var(--s-4));
    -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
  }
  .card-screen.blur { filter: blur(18px); pointer-events: none; }
  header { display: flex; align-items: center; justify-content: space-between; gap: var(--s-2); min-height: 64px; }
  .icon-btn { width: 48px; height: 48px; border-radius: var(--r-pill); border: 0; background: var(--surface); color: var(--text); display: grid; place-items: center; flex: none; }
  .spacer { width: 48px; }
  .rname { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .reader { display: flex; align-items: center; gap: var(--s-2); font-weight: 700; color: var(--text-dim); min-width: 0; overflow: hidden; white-space: nowrap; }

  .bubble {
    position: relative; flex: 1 1 260px; min-height: 220px; display: flex; flex-direction: column;
    padding: var(--s-4) var(--s-4) var(--s-5); border-radius: 28px;
    background:
      radial-gradient(120% 90% at 100% 0%, color-mix(in srgb, var(--accent) 30%, transparent), transparent 65%),
      var(--bg-raised);
    border: 2px solid color-mix(in srgb, var(--accent) 55%, transparent);
    box-shadow: var(--shadow);
    margin-bottom: 14px;
  }
  /* the speech-bubble tail */
  .bubble::after {
    content: ''; position: absolute; left: 34px; bottom: -12px; width: 22px; height: 22px;
    background: var(--bg-raised); border: 2px solid color-mix(in srgb, var(--accent) 55%, transparent);
    border-top: 0; border-left: 0; transform: rotate(45deg); border-radius: 0 0 5px 0;
  }
  .say { color: var(--accent); font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; font-size: 0.78rem; text-align: center; }
  .phrase { flex: 1; min-height: 0; position: relative; }

  .tools { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s-2); }
  .show-cat {
    min-height: 64px; border-radius: var(--r-md); border: 0; background: var(--surface); font-weight: 700;
    display: flex; align-items: center; justify-content: center; gap: var(--s-2);
  }
  .category {
    min-height: 64px; border-radius: var(--r-md); background: color-mix(in srgb, var(--accent) 16%, var(--surface));
    display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--s-1) var(--s-2); text-align: center;
  }
  .category span { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-faint); font-weight: 700; }
  .category b { font-family: var(--font-display); font-size: 1.1rem; line-height: 1.1; }

  .who { font-family: var(--font-body); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-dim); margin-top: var(--s-1); }
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
  .player:active { transform: scale(0.96); background: color-mix(in srgb, var(--c-good) 30%, var(--surface)); }
  .row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s-2); }
  .read, .judge { display: contents; }
  /* A short phone with a big room: the phrase gives up height so every name and Nobody stay on screen. */
  @media (max-height: 720px) {
    .card-screen { gap: var(--s-2); }
    .bubble { flex-basis: 140px; min-height: 120px; }
    .show-cat, .category, .tools :global(.hold) { min-height: 48px; }
    .grid.three .player { min-height: 46px; }
  }

  /* A phone on its side: the phrase and its tools on the left at full height, who said it and
     Nobody on the right. */
  @media (orientation: landscape) and (max-height: 500px) {
    .card-screen {
      height: 100dvh; max-width: 960px; display: grid; column-gap: var(--s-5); row-gap: var(--s-2);
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr);
      padding-bottom: calc(var(--safe-bottom) + var(--s-2));
    }
    header { grid-column: 1 / -1; min-height: 0; }
    .read, .judge { display: flex; flex-direction: column; gap: var(--s-2); min-height: 0; }
    .judge { justify-content: center; overflow-y: auto; }
    .bubble { flex: 1 1 auto; min-height: 0; padding: var(--s-3) var(--s-3) var(--s-4); }
    .who { margin-top: 0; }
    .grid { gap: 6px; }
    .player, .grid.three .player { min-height: 44px; }
    .row :global(.btn) { min-height: 48px; padding: 0 var(--s-2); }
  }

  .paused {
    position: fixed; inset: 0; z-index: var(--z-overlay); display: flex; flex-direction: column; justify-content: center; gap: var(--s-4);
    padding: calc(var(--safe-top) + var(--s-5)) var(--s-5) calc(var(--safe-bottom) + var(--s-5));
    background: color-mix(in srgb, var(--bg) 82%, transparent); text-align: center;
  }
  .paused:focus { outline: none; }
  .ptitle { font-family: var(--font-display); font-weight: 800; font-size: 3rem; }
  .pactions { display: flex; flex-direction: column; gap: var(--s-2); margin-top: var(--s-4); }
  @media (orientation: landscape) and (max-height: 500px) {
    .paused { gap: var(--s-2); padding-top: calc(var(--safe-top) + var(--s-3)); padding-bottom: calc(var(--safe-bottom) + var(--s-3)); overflow-y: auto; }
    .ptitle { font-size: 2.2rem; line-height: 1.1; }
    .pactions { margin: var(--s-2) auto 0; width: min(480px, 100%); }
  }
</style>
