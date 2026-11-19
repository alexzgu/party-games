<script lang="ts">
  // The two teams facing off, each in its own colour, scores meeting at a "vs" in the middle
  // that says what the game is played to.
  import type { Game, TeamIndex } from './state';
  import { teamColor } from './look';

  let { game, scores, active }: { game: Game; scores: [number, number]; active: TeamIndex | null } = $props();

  const to = $derived(game.mode === 'score' ? `to ${game.goal}` : `${game.rounds} rds`);
  const told = $derived(game.mode === 'score' ? `first to ${game.goal}` : `${game.rounds} rounds`);
</script>

{#snippet side(i: TeamIndex)}
  <div class="team t{i}" class:on={active === i} class:off={active !== null && active !== i} style:--team={teamColor(i)}>
    <span class="name">{game.names[i]}</span>
    {#key scores[i]}<span class="score pop-in">{scores[i]}</span>{/key}
  </div>
{/snippet}

<div class="board" role="group" aria-label="Score, {told}: {game.names[0]} {scores[0]}, {game.names[1]} {scores[1]}">
  {@render side(0)}
  <div class="vs" aria-hidden="true"><b>vs</b><span>{to}</span></div>
  {@render side(1)}
</div>

<style>
  .board { display: flex; align-items: stretch; gap: var(--s-1); }
  .team {
    flex: 1 1 0; min-width: 0;
    display: flex; align-items: center; justify-content: space-between; gap: var(--s-2);
    min-height: 50px; padding: var(--s-1) var(--s-3);
    border-radius: var(--r-md) var(--s-1) var(--s-1) var(--r-md);
    background: color-mix(in srgb, var(--team) 10%, var(--surface));
    border: 2px solid color-mix(in srgb, var(--team) 30%, transparent);
    transition: opacity var(--dur) ease, border-color var(--dur) ease;
  }
  .t1 { flex-direction: row-reverse; border-radius: var(--s-1) var(--r-md) var(--r-md) var(--s-1); }
  .team.on {
    border-color: var(--team);
    background: color-mix(in srgb, var(--team) 22%, var(--surface));
    box-shadow: 0 0 22px color-mix(in srgb, var(--team) calc(40% * var(--glow)), transparent);
  }
  .team.off { opacity: 0.7; }
  .name { font-weight: 800; font-size: 0.92rem; color: var(--team); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .score {
    font-family: var(--font-display); font-weight: 800; font-size: 1.7rem; line-height: 1;
    font-variant-numeric: tabular-nums; display: inline-block; color: var(--text);
  }
  .vs { flex: none; width: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1; gap: 3px; }
  .vs b { font-family: var(--font-display); font-weight: 800; font-size: 0.95rem; color: var(--text-dim); text-transform: uppercase; }
  .vs span { font-size: 0.62rem; color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; }
</style>
