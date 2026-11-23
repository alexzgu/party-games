<script lang="ts">
  import Button from '../../components/Button.svelte';
  import TapToFinish from '../../components/room/TapToFinish.svelte';
  import Timer from '../../components/room/Timer.svelte';
  import { secs } from '../../lib/room/look';
  import Answers from './Answers.svelte';
  import PromptCard from './PromptCard.svelte';
  import Seats from './Seats.svelte';
  import Standings from './Standings.svelte';
  import { nameIn } from './labels';
  import type { View } from './view';

  // The shared screen during play, made to read from across a room: the prompt, then the
  // answers, the judge's spotlight, the winner and the end.
  let { v, online, onnext, onagain, onclose }: {
    v: View; online?: ReadonlySet<string>; onnext: () => void; onagain: () => void; onclose: () => void;
  } = $props();
  const name = $derived(nameIn(v));
  const judge = $derived(v.judge ? name(v.judge) : '');
  const played = $derived(v.progress?.length ?? 0);
  const won = $derived(v.winner !== null && v.winner !== undefined ? v.answers?.[v.winner] : undefined);
  const spot = $derived(v.spotlight !== null && v.spotlight !== undefined && v.phase === 'judge' ? v.answers?.[v.spotlight] : undefined);
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
    {#if v.phase === 'answer' && v.prompt}
      {@render head(`${judge} judges this one`, `${played} of ${v.answering?.length ?? 0} played · play your card on your phone`)}
      <div class="center"><PromptCard prompt={v.prompt} size="xl" label={v.picks === 2 ? 'Play two cards, in order' : 'Play one card'} /></div>
      <Seats {v} {online} scores />
    {:else if (v.phase === 'judge' || v.phase === 'vote') && v.prompt && v.answers}
      {#if v.phase === 'judge'}
        {@render head(spot ? `${judge} reads this one` : `${judge} is picking the funniest`,
          v.away !== null && v.away !== undefined ? `${judge}’s phone dropped: if it’s not back in ${secs(v.away)} s, everyone who played votes instead.` : spot ? 'Read it out. The judge picks the funniest on their phone.' : 'Shuffled, no names. The judge taps one to show it here.')}
      {:else}
        {@render head('Everyone who played votes', `${judge} isn’t here to judge. Vote on your phone, not for your own · ${played} voted`)}
      {/if}
      {#if spot}
        <div class="center pop-in" aria-live="polite">{#key v.spotlight}<PromptCard prompt={v.prompt} answers={spot.texts} size="xl" />{/key}</div>
        <Answers prompt={v.prompt} answers={v.answers} spotlight={v.spotlight} {name} />
      {:else}
        <PromptCard prompt={v.prompt} size="lg" />
        <Answers prompt={v.prompt} answers={v.answers} {name} size="lg" />
      {/if}
    {:else if v.phase === 'reveal' && v.prompt && v.answers && won}
      {@render head(`${name(won.by ?? '')} ${won.by === 'house' ? 'wins' : 'wins the point'}`,
        v.answers.length === 1 ? 'The only answer this round.' : v.voted ? 'Picked by the room’s vote.' : `Picked by ${judge}.`)}
      <div class="center pop-in"><PromptCard prompt={v.prompt} answers={won.texts} size="xl" /></div>
      {#if v.answers.length > 1}<Answers prompt={v.prompt} answers={v.answers} winner={v.winner} votes={v.votes} {name} size="lg" />{/if}
      <div class="next"><Button size="lg" onclick={onnext}>Next</Button></div>
    {:else if v.phase === 'over'}
      <Standings {v} {name} size="lg" />
      <div class="next">
        <Button size="lg" onclick={onagain}>Play again</Button>
        <Button size="lg" variant="secondary" onclick={onclose}>Close the room</Button>
      </div>
    {/if}
  </TapToFinish>
</main>

<style>
  .stage { flex: 1; display: grid; align-content: start; gap: var(--s-4); width: min(100%, 1400px); margin-inline: auto; padding-bottom: var(--s-4); }
  .head { display: flex; align-items: center; gap: var(--s-3); }
  .head > div { flex: 1; min-width: 0; }
  h2 { font-size: clamp(1.4rem, 3.4vw, 3rem); line-height: 1.1; overflow-wrap: anywhere; }
  .note { color: var(--text-dim); font-size: clamp(1rem, 1.6vw, 1.4rem); }
  .paused { color: var(--c-pass); font: 800 clamp(1rem, 2vw, 1.6rem) / 1 var(--font-display); }
  .center { width: min(100%, 1100px); margin-inline: auto; }
  .next { display: grid; gap: var(--s-3); grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); width: min(100%, 900px); margin-inline: auto; }
</style>
