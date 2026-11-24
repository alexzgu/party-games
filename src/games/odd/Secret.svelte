<script lang="ts">
  import { gameName } from '../../app.config';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import FitText from '../../components/FitText.svelte';
  import { tapGuard } from '../../lib/tapGuard';

  // One player's secret: the word, or that they are the odd one out. Both look the same from
  // across the room: one card, the same colours, a short line above and one under the big text,
  // and the odd one's big text ("Odd one out") as long as many secret words. The size is capped so
  // a short word does not fill the card.
  let { secret, name, onhide, onback }: {
    secret: { odd: boolean; word: string; pack: string };
    name: string;
    onhide: () => void;
    /** Back closes the secret onto this player's own hand-off. */
    onback: () => void;
  } = $props();

  // The odd one's line is set like a word, and the line under it is always there: the pack with
  // the hint, a neutral nudge without it.
  const big = $derived(secret.odd ? 'Odd one out' : secret.word);
  const under = $derived(secret.odd ? (secret.pack ? `Word from ${secret.pack}` : 'Blend in') : `from ${secret.pack}`);
  // A back tap counts only once this secret has been on screen for the guard time (keyed to the
  // player), so the tail of a double tap never closes it and also steps back a player.
  let ready = $state(tapGuard());
  $effect.pre(() => { void name; ready = tapGuard(); });
</script>

<Screen title={gameName('odd')} onback={() => ready() && onback()} backLabel="Hide">
  <section class="card" aria-label="Your secret">
    <p class="kicker">{name}, only you look</p>
    <div class="big"><FitText text={big} max={52} min={24} /></div>
    <p class="under">{under}</p>
  </section>

  {#snippet actions()}
    <Button size="lg" onclick={onhide}>Hide</Button>
  {/snippet}
</Screen>

<style>
  .card {
    flex: 1; min-height: 52dvh; display: flex; flex-direction: column; gap: var(--s-2); padding: var(--s-4);
    border-radius: 28px; border: 2px solid var(--line-strong); background: var(--bg-raised); box-shadow: var(--shadow);
    -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
  }
  .kicker { text-align: center; color: var(--text-dim); font-weight: 700; font-size: 0.95rem; overflow-wrap: anywhere; }
  .big { flex: 1; min-height: 140px; position: relative; color: var(--text); }
  .big :global(.fit) { position: absolute; inset: 0; }
  .under { text-align: center; color: var(--text-dim); font-weight: 700; font-size: 0.95rem; min-height: 1.5em; overflow-wrap: anywhere; }
</style>
