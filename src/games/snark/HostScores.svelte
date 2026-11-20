<script lang="ts">
  import Button from '../../components/Button.svelte';
  import Avatar from '../../components/room/Avatar.svelte';
  import { isFinalRound, type Game } from './logic';
  import { place, pts, standings } from './record';
  import { playerColor, roundName, secs } from './look';

  // Between rounds: everyone's total with this round's gain, then the next round starts by itself.
  let { game, left, onnext }: { game: Game; left: number | null; onnext: () => void } = $props();

  const rows = $derived(standings(game));
  const best = $derived(Math.max(1, ...rows.map((p) => p.score)));
  const gain = (pid: string) => game.items.reduce((n, it) => n + (it.result?.points[pid] ?? 0), 0);
  const next = $derived(game.round + 1);
  const nextName = $derived(roundName(next, game.settings.rounds) + (isFinalRound(game, next) ? ': one prompt for everyone' : next === 2 ? ': double points' : ''));
</script>

<div class="scores">
  <h1 class="pop-in">Scores after {roundName(game.round, game.settings.rounds).toLowerCase()}</h1>
  <ol>
    {#each rows as p, k (p.pid)}
      <li class="pop-in" style:--who={playerColor(p.color)} style:animation-delay="{120 + k * 90}ms">
        <span class="place">{place(game, p.score)}</span>
        <Avatar name={p.name} color={p.color} size={40} />
        <span class="name">{p.name}</span>
        <span class="bar"><i style:width="{(100 * p.score) / best}%"></i></span>
        {#if gain(p.pid)}<span class="gain">+{pts(gain(p.pid))}</span>{/if}
        <b>{pts(p.score)}</b>
      </li>
    {/each}
  </ol>
  <div class="next">
    <p class="muted">Next: {nextName}{left !== null ? ` · in ${secs(left)} s` : ''}</p>
    <div class="go"><Button size="lg" onclick={onnext}>Start {roundName(next, game.settings.rounds).toLowerCase()}</Button></div>
  </div>
</div>

<style>
  .scores { flex: 1; display: flex; flex-direction: column; gap: clamp(12px, 2.4vmin, 24px); width: min(100%, 980px); margin: 0 auto; padding: var(--s-3) 0; }
  h1 { text-align: center; font-size: clamp(1.8rem, 5.6vmin, 3.4rem); }
  ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--s-2); }
  li { display: flex; align-items: center; gap: var(--s-3); padding: clamp(6px, 1.2vmin, 12px) var(--s-4); border-radius: var(--r-md); background: var(--surface); font-size: clamp(1rem, 2.6vmin, 1.5rem); }
  .place { width: 1.4em; color: var(--text-faint); font-family: var(--font-display); font-weight: 800; }
  .name { width: 9em; min-width: 0; font-weight: 800; color: var(--who); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar { flex: 1; height: 10px; border-radius: var(--r-pill); background: var(--bg-sunk); overflow: hidden; }
  .bar i { display: block; height: 100%; background: var(--who); border-radius: var(--r-pill); animation: grow var(--dur-slow) var(--ease-out) both 0.3s; transform-origin: left; }
  @keyframes grow { from { transform: scaleX(0); } }
  .gain { color: var(--c-good); font-weight: 800; font-size: 0.8em; white-space: nowrap; }
  b { min-width: 4.2em; text-align: right; font-family: var(--font-display); font-variant-numeric: tabular-nums; }
  .next { margin-top: auto; display: flex; flex-direction: column; align-items: center; gap: var(--s-2); }
  .go { width: min(100%, 420px); }
  @media (max-width: 560px) { .bar { display: none; } .name { flex: 1; width: auto; } }
</style>
