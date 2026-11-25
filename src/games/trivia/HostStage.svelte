<script lang="ts">
  import Button from '../../components/Button.svelte';
  import TapToFinish from '../../components/room/TapToFinish.svelte';
  import Timer from '../../components/room/Timer.svelte';
  import { ordinal } from '../../lib/room/look';
  import Answers from './Answers.svelte';
  import Seats from './Seats.svelte';
  import Standings from './Standings.svelte';
  import { gain, nameIn } from './labels';
  import type { View } from './view';

  // The shared screen during play, made to read from across a room: the category, then the
  // question and its four answers with who has answered (never what), then the right answer with
  // how many picked each, who got it and the points each gained, and the top five; and the end.
  let { v, online, onnext, onagain, onclose }: {
    v: View; online?: ReadonlySet<string>; onnext: () => void; onagain: () => void; onclose: () => void;
  } = $props();
  const name = $derived(nameIn(v));
  const answered = $derived(v.answered?.length ?? 0);
  const picks = $derived(v.result ? v.result.counts.reduce((a, b) => a + b, 0) : 0);
  const top = $derived([...v.players].sort((a, b) => b.score - a.score).slice(0, 5));
  const placeOf = (score: number) => ordinal(1 + v.players.filter((p) => p.score > score).length);
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
    {#if v.phase === 'category' && v.category}
      {@render head(`Question ${v.n} of ${v.count}`, 'Get ready…')}
      {#key v.at}<p class="category pop-in">{v.category}</p>{/key}
    {:else if v.phase === 'answer' && v.question && v.answers}
      {@render head(v.question, `${v.category} · ${answered} of ${v.players.length} answered · ${v.extra ? 'extra time, no speed points' : 'answer on your phone'}`)}
      {#key v.at}<div class="pop-in"><Answers answers={v.answers} size="lg" /></div>{/key}
      <Seats {v} {online} />
    {:else if v.phase === 'reveal' && v.question && v.answers && v.result}
      {@render head(v.question, `${v.category} · ${v.result.gains.length} of ${picks} ${picks === 1 ? 'answer' : 'answers'} right`)}
      <div class="pop-in"><Answers answers={v.answers} size="lg" right={v.result.right} counts={v.result.counts} /></div>
      <div class="boards">
        <section aria-label="Who got it">
          <h3>Got it</h3>
          {#if v.result.gains.length}
            <ul class="gains">{#each v.result.gains as g (g.pid)}<li><span>{name(g.pid)}</span><b>{gain(g.points)}</b></li>{/each}</ul>
          {:else}<p class="note">Nobody this time.</p>{/if}
        </section>
        <section aria-label="Top five">
          <h3>Top 5</h3>
          <ol class="top">{#each top as p (p.pid)}<li><span class="place">{placeOf(p.score)}</span><span class="who">{p.name}</span><b>{p.score}</b></li>{/each}</ol>
        </section>
      </div>
      <div class="next step"><Button size="lg" onclick={onnext}>{v.last ? 'Results' : 'Next'}</Button></div>
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
  .stage { flex: 1; display: grid; align-content: start; gap: var(--s-3); width: min(100%, 1400px); margin-inline: auto; padding-bottom: var(--s-4); }
  .head { display: flex; align-items: center; gap: var(--s-3); }
  .head > div { flex: 1; min-width: 0; }
  h2 { font-size: clamp(calc(1.3 * var(--rem-far)), 2.8vw, calc(2.6 * var(--rem-far))); line-height: 1.15; overflow-wrap: anywhere; }
  .note { color: var(--text-dim); font-size: clamp(var(--rem-far), 1.5vw, calc(1.3 * var(--rem-far))); }
  .paused { color: var(--c-pass); font: 800 clamp(1rem, 2vw, 1.6rem) / 1 var(--font-display); }
  .category {
    margin: clamp(var(--s-4), 10vh, 8rem) auto 0; max-width: 100%; color: var(--accent); text-align: center; overflow-wrap: anywhere;
    font: 800 clamp(2.6rem, 9vw, 8rem) / 1.05 var(--font-display);
  }
  .boards { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: var(--s-3); }
  section { display: grid; align-content: start; gap: var(--s-2); min-width: 0; padding: var(--s-2) var(--s-3); border-radius: var(--r-md); background: var(--surface); }
  h3 { font: 800 clamp(1rem, 1.5vw, 1.3rem) / 1.2 var(--font-display); color: var(--text-dim); }
  ul, ol { list-style: none; padding: 0; margin: 0; }
  .gains { display: flex; flex-wrap: wrap; gap: var(--s-1) var(--s-2); }
  .gains li { display: flex; gap: var(--s-1); align-items: baseline; padding: 2px var(--s-2); border-radius: var(--r-pill); background: var(--bg-sunk); font-size: clamp(calc(0.9 * var(--rem-far)), 1.2vw, calc(1.1 * var(--rem-far))); min-width: 0; }
  .gains span { overflow-wrap: anywhere; }
  .gains b, .top b { color: var(--accent); font-family: var(--font-display); white-space: nowrap; }
  .top { display: grid; grid-template-columns: minmax(0, 1fr); gap: 2px; }
  .top li { display: flex; gap: var(--s-2); align-items: baseline; font-size: clamp(calc(0.95 * var(--rem-far)), 1.3vw, calc(1.2 * var(--rem-far))); }
  .top .place { min-width: 2.4em; color: var(--text-dim); }
  .top .who { flex: 1; min-width: 0; overflow-wrap: anywhere; }
  .next { display: grid; gap: var(--s-3); grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); width: min(100%, 900px); margin-inline: auto; }
  @media (max-width: 700px) { .boards { grid-template-columns: minmax(0, 1fr); } }
  /* A short host window: everything a size down so the reveal fits; the bar's own Next stands in for the big one. */
  @media (max-height: 620px) {
    .stage { gap: var(--s-2); padding-bottom: var(--s-2); }
    h2 { font-size: clamp(calc(1.05 * var(--rem-far)), 2.2vw, calc(1.6 * var(--rem-far))); }
    .note { font-size: 0.95rem; }
    .category { margin-top: var(--s-4); }
    section { gap: var(--s-1); padding: var(--s-1) var(--s-2); }
    h3 { font-size: 0.9rem; }
    .boards { grid-template-columns: minmax(0, 7fr) minmax(0, 4fr); }
    .gains { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 2px var(--s-1); }
    .gains li { justify-content: space-between; padding: 0 var(--s-2); font-size: 0.8rem; }
    .gains span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .top { gap: 0; }
    .top li { gap: var(--s-1); font-size: 0.8rem; line-height: 1.3; }
    .top .place { min-width: 2.1em; }
    .top .who { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .step { display: none; }
  }
</style>
