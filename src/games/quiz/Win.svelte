<script lang="ts">
  import Button from '../../components/Button.svelte';
  import Confetti from './Confetti.svelte';
  import { leaders, points, standings, type Game } from './logic';
  import { teamColor } from './look';

  // Game over: the winner (or a tie) big, every team's final score, confetti in the winner's
  // colour. Any tap clears the confetti; the entrance itself is skipped by TapToFinish.
  let { game, onnew, onhome }: { game: Game; onnew: () => void; onhome: () => void } = $props();

  const rows = $derived(standings(game));
  const top = $derived(leaders(game));
  /** Shared places for ties: 1, 1, 3. */
  const place = (score: number) => 1 + rows.filter((r) => r.score > score).length;
  const tied = $derived(top.map((i) => game.teams[i]));
  const color = $derived(top.length === 1 ? teamColor(top[0]) : 'var(--accent)');
  let confetti = $state(true);
</script>

<svelte:window onpointerdown={() => (confetti = false)} />

{#if confetti && top.length}<Confetti colors={[color, color, 'var(--c-gold)', ...game.teams.map((_, i) => teamColor(i))]} />{/if}

<div class="win fade-in" style:--win={color}>
  <div class="trophy pop-in" aria-hidden="true">{top.length ? '🏆' : '🤷'}</div>
  <h1 class="pop-in" style:animation-delay="120ms">
    {#if top.length === 1}<span>{game.teams[top[0]]}</span> win!
    {:else if top.length > 1}It's a tie!<span class="tie">{tied.length < 3 ? tied.join(' & ') : `${tied.slice(0, -1).join(', ')} & ${tied.at(-1)}`}</span>
    {:else}Nobody scored{/if}
  </h1>
  {#if game.ended}<p class="early pop-in" style:animation-delay="200ms">Ended early: scores when the game stopped</p>{/if}

  <ol class="final" aria-label="Final scores">
    {#each rows as r, k (r.index)}
      <li class="pop-in" class:lead={top.includes(r.index)} style:--team={teamColor(r.index)} style:animation-delay="{300 + k * 110}ms">
        <span class="place">{place(r.score)}</span>
        <span class="tname">{r.name}</span>
        <b>{points(r.score)}</b>
      </li>
    {/each}
  </ol>
  <p class="faint pop-in" style:animation-delay="{360 + rows.length * 110}ms">{game.board.name}</p>

  <div class="actions pop-in" style:animation-delay="{460 + rows.length * 110}ms">
    <Button size="lg" onclick={onnew}>Play another board</Button>
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
</style>
