<script lang="ts">
  import Rules from './Rules.svelte';
  import { gameName } from '../../app.config';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import Strip from './Strip.svelte';
  import Confetti from './Confetti.svelte';
  import { playerColor, said } from './ui';
  import { roundNote, winner, type GameState } from './logic';

  // Between turns: how the last turn went, the scores, and whose turn it is now. Revealing the
  // prompt starts the clock, so the button says so.
  let { game, onbegin, onwin, onundo, onleave, error = '', notice = '' }: {
    game: GameState;
    onbegin: () => void;
    onwin: () => void;
    onundo: () => void;
    onleave: () => void;
    error?: string;
    /** A plain note over the start button (not an error). */
    notice?: string;
  } = $props();

  const up = $derived(game.players[game.turn]);
  const last = $derived(game.log.at(-1) ?? null);
  const won = $derived(winner(game));
  /** Someone reached the target but the round is not over yet (or ended tied on top). */
  const note = $derived(roundNote(game));
  const name = (i: number) => game.players[i]?.name ?? '';
</script>

{#if last && last.scorer >= 0 && game.prev}<Confetti count={30} />{/if}

<Screen title={gameName('quick')} onback={onleave} backLabel="Back to setup" split>
  {#snippet trailing()}<Rules seconds={game.seconds} target={game.target} steal={game.steal} stealUsesTurn={game.stealUsesTurn} />{/snippet}
<div class="center">
  <div class="split-side">
    {#if last}
      <section class="last" aria-label="Last turn">
        {#if last.scorer >= 0}
          <p class="verdict good pop-in" style:--c={playerColor(last.scorer)}>
            <span aria-hidden="true">✓</span>
            {last.scorer === last.stealer ? `${name(last.scorer)} stole it!` : `Point to ${name(last.scorer)}!`}
          </p>
        {:else}
          <p class="verdict bad pop-in"><span aria-hidden="true">✗</span> {last.stealer >= 0 ? 'Nobody got it' : `${name(last.player)} missed`}</p>
        {/if}
        <p class="prompt">{said(last.prompt)}</p>
      </section>
    {/if}

    <Strip {game} flash={game.prev && last ? last.scorer : -1} up={won >= 0 ? -1 : game.turn} />
  </div>

  <div class="split-main">
    {#if won >= 0}
      <div class="hand" style:--c={playerColor(won)}>
        <p class="kicker">Round over · top score</p>
        <p class="name pop-in">🏆 {name(won)}</p>
      </div>
    {:else}
      {#if note}<p class="round-note pop-in" role="status">{note}</p>{/if}
      <div class="hand" style:--c={playerColor(game.turn)}>
        <p class="kicker">Pass the phone to</p>
        <div class="who pop-in">
          <span class="glow" aria-hidden="true"></span>
          <span class="name">{up.name}</span>
        </div>
        <p class="hint">The clock starts when you tap: <b>{game.seconds} seconds</b> to name 3.</p>
      </div>
      {#if !last}<p class="meta">{game.target} points wins once the round is done{game.steal ? ' · steals on' : ''}</p>{/if}
    {/if}

    {#if error}<p class="error" role="alert">{error}</p>{:else if notice}<p class="notice" role="status">{notice}</p>{/if}
  </div>
</div>

  {#snippet actions()}
    {#if won >= 0}
      <Button size="lg" onclick={onwin}>🏆 Winner</Button>
    {:else}
      <Button size="lg" onclick={onbegin}>I'm {up.name}</Button>
    {/if}
    {#if game.prev}<Button variant="ghost" size="sm" onclick={onundo} tip="Back to judging the last try; any point comes off">Undo</Button>{/if}
  {/snippet}
</Screen>

<style>
  .center { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: var(--s-4); }
  .last { text-align: center; display: flex; flex-direction: column; gap: var(--s-1); }
  .verdict { display: inline-flex; align-self: center; align-items: center; gap: var(--s-2); font-family: var(--font-display); font-weight: 800; font-size: 1.8rem; line-height: 1.1; }
  .verdict.good { color: var(--c); }
  .verdict.good span { color: var(--c-good); }
  .verdict.bad { color: var(--text-dim); }
  .verdict.bad span { color: var(--c-bad); }
  .prompt { color: var(--text-dim); font-weight: 600; }
  .hand { display: flex; flex-direction: column; align-items: center; text-align: center; gap: var(--s-2); }
  .kicker { color: var(--text-dim); font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; font-size: 0.85rem; }
  .who { position: relative; display: grid; place-items: center; min-height: 130px; width: 100%; }
  .glow {
    position: absolute; width: 180px; height: 180px; border-radius: 50%;
    background: radial-gradient(circle, color-mix(in srgb, var(--c) calc(45% * var(--glow)), transparent), transparent 68%);
    animation: breathe 2.4s ease-in-out infinite;
  }
  .name {
    position: relative; font-family: var(--font-display); font-weight: 800; color: var(--c);
    font-size: clamp(2.6rem, 16vw, 5rem); line-height: 1; letter-spacing: -0.03em; overflow-wrap: anywhere;
  }
  .hint { font-size: 1.05rem; font-weight: 600; max-width: 22em; }
  .meta { text-align: center; color: var(--text-faint); }
  .round-note {
    align-self: center; max-width: 24em; padding: var(--s-2) var(--s-4); border-radius: var(--r-md); text-align: center;
    font-weight: 700; line-height: 1.3; background: color-mix(in srgb, var(--accent) 16%, var(--surface)); border: 1.5px solid var(--accent);
  }
  .error { color: var(--bad-ink); text-align: center; }
  .notice { color: var(--text-dim); font-weight: 600; text-align: center; }
  @keyframes breathe { 50% { transform: scale(1.12); opacity: 0.7; } }
  @media (prefers-reduced-motion: reduce) { .glow { animation: none; } }
  /* A phone on its side (Screen's split): the last turn and the scores on the left, who is up
     and the button on the right. */
  @media (orientation: landscape) and (max-height: 500px) {
    .center { display: contents; }
    .verdict { font-size: 1.5rem; }
    .who { min-height: 76px; }
    .glow { width: 130px; height: 130px; }
    .name { font-size: clamp(2.2rem, 6.5vw, 3.6rem); }
    .hint { font-size: 1rem; }
  }
</style>
