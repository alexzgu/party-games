<script lang="ts">
  import Button from '../../components/Button.svelte';
  import Confetti from './Confetti.svelte';
  import { leaders, points, scores, solo, standings, tileCount, type Game } from './logic';
  import { teamColor } from './look';

  // Game over: the winner (or a tie) big, every team's final score, confetti in the winner's
  // colour. Any tap clears the confetti; the entrance itself is skipped by TapToFinish. A solo
  // player gets their score and how many tiles they got; nine teams or more get compact rows
  // (two columns on a wide screen) that come in faster.
  let { game, onnew, onhome }: { game: Game; onnew: () => void; onhome: () => void } = $props();

  const rows = $derived(standings(game));
  const top = $derived(leaders(game));
  /** Shared places for ties: 1, 1, 3. */
  const place = (score: number) => 1 + rows.filter((r) => r.score > score).length;
  const tied = $derived(top.map((i) => game.teams[i]));
  const alone = $derived(solo(game));
  const many = $derived(game.teams.length > 8);
  const color = $derived(alone ? teamColor(0) : top.length === 1 ? teamColor(top[0]) : 'var(--accent)');
  const soloScore = $derived(scores(game)[0]);
  const got = $derived(game.log.filter((e) => e.kind === 'tile' && e.winner === 0).length);
  const step = $derived(many ? 40 : 110);
  const after = $derived(alone ? 300 : 360 + rows.length * step);
  let confetti = $state(true);
</script>

<svelte:window onpointerdown={() => (confetti = false)} />

{#if confetti && (alone ? soloScore > 0 : top.length)}<Confetti colors={[color, color, 'var(--c-gold)', ...game.teams.map((_, i) => teamColor(i))]} />{/if}

<div class="win fade-in" style:--win={color}>
  <div class="trophy pop-in" aria-hidden="true">{alone ? (soloScore > 0 ? '🏆' : '🤷') : top.length ? '🏆' : '🤷'}</div>
  <h1 class="pop-in" style:animation-delay="120ms">
    {#if alone}<span>{game.teams[0]}</span> scored<b class="solo-score" class:neg={soloScore < 0}>{points(soloScore)}</b>
    {:else if top.length === 1}<span>{game.teams[top[0]]}</span> win!
    {:else if top.length > 1}It's a tie!<span class="tie">{tied.length < 3 ? tied.join(' & ') : `${tied.slice(0, -1).join(', ')} & ${tied.at(-1)}`}</span>
    {:else}Nobody scored{/if}
  </h1>
  {#if game.ended}<p class="early pop-in" style:animation-delay="200ms">Ended early: scores when the game stopped</p>{/if}

  {#if alone}
    <p class="tiles pop-in" style:animation-delay="240ms">Got {got} of {tileCount(game)} tiles</p>
  {:else}
    <ol class="final" class:many class:two={rows.length > 4} style:--half={Math.ceil(rows.length / 2)} aria-label="Final scores">
      {#each rows as r, k (r.index)}
        <li class="pop-in" class:lead={top.includes(r.index)} style:--team={teamColor(r.index)} style:animation-delay="{300 + k * step}ms">
          <span class="place">{place(r.score)}</span>
          <span class="tname">{r.name}</span>
          <b>{points(r.score)}</b>
        </li>
      {/each}
    </ol>
  {/if}
  <p class="faint pop-in" style:animation-delay="{after}ms">{game.board.name}</p>

  <div class="actions pop-in" style:animation-delay="{after + 100}ms">
    <Button size="lg" onclick={onnew} tip="Back to setup to pick another pack">Play another pack</Button>
    <Button variant="ghost" onclick={onhome}>Home</Button>
  </div>
</div>

<style>
  .win {
    position: relative; isolation: isolate; flex: 1;
    width: min(100%, 760px); margin: 0 auto;
    display: flex; flex-direction: column; align-items: center; gap: clamp(12px, 2vmin, 24px); text-align: center;
    padding-top: clamp(16px, 5vmin, 64px);
  }
  .win::before {
    content: ''; position: fixed; inset: 0; z-index: -1; pointer-events: none;
    background: radial-gradient(110% 55% at 50% 0%, color-mix(in srgb, var(--win) 32%, transparent), transparent 75%), var(--bg);
  }
  .trophy { font-size: clamp(4rem, 12vmin, 8rem); line-height: 1; }
  h1 { font-size: clamp(2.4rem, 8vmin, 5.5rem); line-height: 1.02; }
  h1 span { display: block; color: var(--win); overflow-wrap: anywhere; text-shadow: 0 0 36px color-mix(in srgb, var(--win) 50%, transparent); }
  h1 .tie { font-size: 0.6em; margin-top: var(--s-2); }
  .early { color: var(--c-pass); font-weight: 700; }
  .final { list-style: none; margin: 0; padding: 0; width: 100%; display: flex; flex-direction: column; gap: var(--s-2); }
  li {
    display: flex; align-items: center; gap: var(--s-3); padding: clamp(10px, 1.6vmin, 18px) var(--s-4); border-radius: var(--r-md);
    background: color-mix(in srgb, var(--team) 8%, var(--surface)); border: 2px solid color-mix(in srgb, var(--team) 35%, transparent);
    font-weight: 800; font-size: clamp(1.1rem, 2.8vmin, 2rem);
  }
  li.lead { background: color-mix(in srgb, var(--team) 20%, var(--surface)); border-color: var(--team); box-shadow: 0 0 24px color-mix(in srgb, var(--team) 30%, transparent); }
  .place { width: 1.6em; color: var(--text-faint); font-family: var(--font-display); }
  .tname { flex: 1; min-width: 0; text-align: left; color: var(--team); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  li b { font-family: var(--font-display); font-size: 1.4em; line-height: 1; font-variant-numeric: tabular-nums; }
  .actions { width: min(100%, 520px); margin-top: auto; display: flex; flex-direction: column; gap: var(--s-2); }
  .final.many { display: grid; gap: 6px; }
  .final.many li { padding: 6px var(--s-3); font-size: clamp(1rem, 2.2vmin, 1.4rem); border-width: 1.5px; }
  .final.many li.lead { box-shadow: none; }
  @media (min-width: 700px) {
    .final.many { grid-template-columns: 1fr 1fr; grid-template-rows: repeat(var(--half), auto); grid-auto-flow: column; column-gap: var(--s-3); }
  }
  /* A phone on its side: the winner and the board's name on the left, the scores (five teams
     or more in two columns) and the buttons side by side on the right. */
  @media (orientation: landscape) and (max-height: 500px) {
    .win {
      display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-template-rows: auto auto auto 1fr auto;
      align-items: center; column-gap: var(--s-5); row-gap: var(--s-2); width: min(100%, 960px); padding-top: 0;
    }
    .trophy { grid-column: 1; grid-row: 1; align-self: end; font-size: 3rem; }
    h1 { grid-column: 1; grid-row: 2; font-size: clamp(2rem, 6vw, 3.2rem); }
    .early { grid-column: 1; grid-row: 3; }
    .win > .faint { grid-column: 1; grid-row: 4; align-self: start; }
    .final, .tiles { grid-column: 2; grid-row: 1 / 5; min-width: 0; }
    .final { gap: 6px; }
    .final.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: repeat(var(--half), auto); grid-auto-flow: column; column-gap: var(--s-2); }
    li, .final.many li { padding: 6px var(--s-3); font-size: 1.1rem; gap: var(--s-2); border-width: 1.5px; }
    .actions { grid-column: 2; grid-row: 5; width: 100%; margin: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; }
  }
  .solo-score { display: block; font-size: 1.25em; font-variant-numeric: tabular-nums; }
  .solo-score.neg { color: var(--c-bad); }
  .tiles { color: var(--text-dim); font-weight: 700; font-size: clamp(1.1rem, 2.8vmin, 1.8rem); }
</style>
