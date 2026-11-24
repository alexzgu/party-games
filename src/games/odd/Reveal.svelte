<script lang="ts">
  import { gameName } from '../../app.config';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import FitText from '../../components/FitText.svelte';
  import { playerColor } from './ui';
  import { caught, type GameState } from './logic';
  import { TAP_GUARD_MS, tapGuard } from '../../lib/tapGuard';

  // Who the room picked and whether it was the odd one out. Caught: they guess the word out loud
  // before it shows, and the room says whether they got it. Not caught: the word shows at once.
  let { game, onshow, onsettle, onleave }: {
    game: GameState;
    onshow: () => void;
    onsettle: (guessed: boolean | null) => void;
    onleave: () => void;
  } = $props();

  const r = $derived(game.round);
  const got = $derived(caught(r));
  const picked = $derived(game.players[r.picked].name);
  const odd = $derived(game.players[r.odd].name);
  // The judge buttons take the place of Show word: the tail of a double tap there is ignored.
  const ready = tapGuard(TAP_GUARD_MS);
</script>

<Screen title={gameName('odd')} onback={onleave} backLabel="Back to setup">
  <div class="reveal">
    <p class="verdict pop-in" class:good={got}>
      <span class="icon" aria-hidden="true">{got ? '✓' : '✗'}</span>
      {#if got}<span><b style:color={playerColor(r.odd)}>{picked}</b> was the odd one out!</span>
      {:else}<span><b>{picked}</b> was not the odd one out. It was <b style:color={playerColor(r.odd)}>{odd}</b>.</span>{/if}
    </p>
    {#if r.shown}
      <section class="word pop-in" aria-label="The word">
        <p class="label">The word</p>
        <div class="big"><FitText text={r.word} max={72} min={24} /></div>
        <p class="pack">from {r.pack}</p>
      </section>
      {#if got}<p class="ask">Did {odd} get it?</p>{/if}
    {:else}
      <p class="ask big-ask">{odd}, guess the word out loud.</p>
    {/if}
  </div>

  {#snippet actions()}
    {#if !r.shown}
      <Button size="lg" onclick={onshow}>Show word</Button>
    {:else if got}
      <div class="judge" role="group" aria-label="Did {odd} get it?">
        <button class="call no" onclick={() => ready() && onsettle(false)}><span class="mk" aria-hidden="true">✗</span> Missed</button>
        <button class="call yes" onclick={() => ready() && onsettle(true)}><span class="mk" aria-hidden="true">✓</span> Got it</button>
      </div>
    {:else}
      <Button size="lg" onclick={() => onsettle(null)}>Next</Button>
    {/if}
  {/snippet}
</Screen>

<style>
  .reveal { display: flex; flex-direction: column; gap: var(--s-4); text-align: center; padding-top: var(--s-2); }
  .verdict { font-family: var(--font-display); font-weight: 800; font-size: 1.7rem; line-height: 1.15; display: flex; flex-direction: column; align-items: center; gap: var(--s-1); overflow-wrap: anywhere; }
  .icon { font-size: 2.4rem; line-height: 1; color: var(--c-bad); }
  .good .icon { color: var(--c-good); }
  .word { display: flex; flex-direction: column; gap: var(--s-1); padding: var(--s-3); border-radius: var(--r-lg); background: var(--bg-raised); border: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); }
  .label { color: var(--text-dim); font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; font-size: 0.85rem; }
  .big { height: 120px; position: relative; }
  .big :global(.fit) { position: absolute; inset: 0; }
  .pack { color: var(--text-dim); font-weight: 600; }
  .ask { font-size: 1.2rem; font-weight: 700; }
  .big-ask { font-family: var(--font-display); font-size: 1.9rem; line-height: 1.15; overflow-wrap: anywhere; }
  .judge { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-2); }
  .call {
    --c: var(--c-good); min-height: 72px; border-radius: var(--r-lg); display: flex; align-items: center; justify-content: center; gap: var(--s-2);
    font-family: var(--font-display); font-weight: 800; font-size: 1.35rem; color: var(--text);
    border: 2.5px solid var(--c); background: color-mix(in srgb, var(--c) 20%, var(--surface));
    transition: transform var(--dur-fast) var(--ease-out), background var(--dur-fast) ease;
  }
  .call.no { --c: var(--c-bad); }
  .call:active { transform: scale(0.96); background: color-mix(in srgb, var(--c) 40%, var(--surface)); }
  .mk { color: var(--c); font-size: 1.6rem; line-height: 1; }
</style>
