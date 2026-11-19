<script lang="ts">
  // The two teams facing off: each in its own colour, scores meeting at a "vs" in the middle.
  import type { Team, TeamIndex } from './state';
  import { teamColor } from './look';

  let { teams, scores, goal, active }: { teams: [Team, Team]; scores: [number, number]; goal: number; active: TeamIndex | null } = $props();
</script>

{#snippet side(i: TeamIndex)}
  <div class="team t{i}" class:on={active === i} class:off={active !== null && active !== i} style:--team={teamColor(i)} data-score-team={i}>
    <span class="name">{teams[i].name}</span>
    {#key scores[i]}<span class="score pop-in">{scores[i]}</span>{/key}
  </div>
{/snippet}

<div class="board" aria-label="Score, first to {goal}: {teams[0].name} {scores[0]}, {teams[1].name} {scores[1]}">
  {@render side(0)}
  <div class="vs" aria-hidden="true"><b>vs</b><span>to {goal}</span></div>
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
    transition: opacity var(--dur) ease, border-color var(--dur) ease, box-shadow var(--dur) ease;
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
  .vs {
    flex: none; width: 38px; display: flex; flex-direction: column; align-items: center; justify-content: center;
    line-height: 1; gap: 3px;
  }
  .vs b { font-family: var(--font-display); font-weight: 800; font-size: 0.95rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.02em; }
  .vs span { font-size: 0.62rem; color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; }
</style>
