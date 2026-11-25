<script lang="ts">
  import Button from '../../components/Button.svelte';
  import TapToFinish from '../../components/room/TapToFinish.svelte';
  import Timer from '../../components/room/Timer.svelte';
  import Choices from './Choices.svelte';
  import Seats from './Seats.svelte';
  import Standings from './Standings.svelte';
  import { nameIn, outcome } from './labels';
  import type { View } from './view';

  // The shared screen during play, made to read from across a room: the question's two choices,
  // who has voted (never which way), then the split with everyone's names (scores are on the
  // phones and at the end, so a full room still fits), and the end.
  let { v, online, onnext, onagain, onclose }: {
    v: View; online?: ReadonlySet<string>; onnext: () => void; onagain: () => void; onclose: () => void;
  } = $props();
  const name = $derived(nameIn(v));
  const voted = $derived(v.voted?.length ?? 0);
  const scorers = $derived(v.tally && v.tally.winner !== null ? v.tally.voters[v.tally.winner] : []);
</script>

{#snippet head(title: string, note: string)}
  <div class="head">
    <div><h2>{title}</h2>{#if note}<p class="note">{note}</p>{/if}</div>
    {#if v.paused}<b class="paused">Paused</b>{/if}
    <Timer left={v.left} total={v.total} paused={v.paused} size={64} />
  </div>
{/snippet}

<main class="stage">
  <TapToFinish>
    {#if v.phase === 'vote' && v.prompt}
      {@render head('Would you rather…', `Question ${v.n} of ${v.count} · ${voted} of ${v.players.length} voted · pick on your phone`)}
      {#key v.at}<div class="pop-in"><Choices prompt={v.prompt} size="lg" /></div>{/key}
      <Seats {v} {online} />
    {:else if v.phase === 'reveal' && v.prompt && v.tally}
      {@render head(outcome(v), !scorers.length ? '' : scorers.length > 4 ? `+1 point each for the ${scorers.length} on the bigger side.` : `+1 point each for ${scorers.map(name).join(', ')}.`)}
      <div class="pop-in"><Choices prompt={v.prompt} size="lg" tally={v.tally} {name} /></div>
      <div class="next"><Button size="lg" onclick={onnext}>{v.last ? 'Results' : 'Next'}</Button></div>
    {:else if v.phase === 'over'}
      <Standings {v} size="lg" />
      <div class="next">
        <Button size="lg" onclick={onagain} tip="Back to the lobby with the same players, scores at zero; the next game carries on with new questions">Lobby</Button>
        <Button size="lg" variant="secondary" onclick={onclose} tip="Sends every phone back to the start, after asking">Close</Button>
      </div>
    {/if}
  </TapToFinish>
</main>

<style>
  .stage { flex: 1; display: grid; align-content: start; gap: var(--s-4); width: min(100%, 1400px); margin-inline: auto; padding-bottom: var(--s-4); }
  .head { display: flex; align-items: center; gap: var(--s-3); }
  .head > div { flex: 1; min-width: 0; }
  h2 { font-size: clamp(1.4rem, calc(3.4vw * var(--text-scale)), 3rem); line-height: 1.1; overflow-wrap: anywhere; }
  .note { color: var(--text-dim); font-size: clamp(1rem, calc(1.6vw * var(--text-scale)), 1.4rem); }
  .paused { color: var(--c-pass); font: 800 clamp(1rem, calc(2vw * var(--text-scale)), 1.6rem) / 1 var(--font-display); }
  @media (max-height: 620px) { .stage { gap: var(--s-2); } }
  .next { display: grid; gap: var(--s-3); grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); width: min(100%, 900px); margin-inline: auto; }
</style>
