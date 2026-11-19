<script lang="ts">
  import type { Team, TeamIndex } from './state';
  import { teamColor } from './look';

  let { teams, scores, goal, active }: { teams: [Team, Team]; scores: [number, number]; goal: number; active: TeamIndex | null } = $props();
</script>

<div class="board" aria-label="Score, first to {goal}">
  {#each teams as t, i (i)}
    <div class="team" class:on={active === i} style:--team={teamColor(i as TeamIndex)} data-score-team={i}>
      <span class="name">{t.name}</span>
      {#key scores[i]}<span class="score pop-in">{scores[i]}</span>{/key}
    </div>
  {/each}
  <span class="goal" aria-hidden="true">to {goal}</span>
</div>

<style>
  .board { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-2); position: relative; }
  .team {
    display: flex; align-items: center; justify-content: space-between; gap: var(--s-2);
    min-height: 48px; padding: var(--s-1) var(--s-3) var(--s-1) var(--s-3);
    border-radius: var(--r-md); background: var(--surface);
    border: 2px solid transparent; opacity: 0.75;
    transition: opacity var(--dur) ease, border-color var(--dur) ease;
  }
  .team:nth-child(2) { flex-direction: row-reverse; }
  .team.on { opacity: 1; border-color: var(--team); background: color-mix(in srgb, var(--team) 16%, var(--surface)); }
  .name { font-weight: 700; font-size: 0.95rem; color: var(--team); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .score { font-family: var(--font-display); font-weight: 800; font-size: 1.6rem; font-variant-numeric: tabular-nums; display: inline-block; }
  .goal {
    position: absolute; left: 50%; top: 100%; transform: translate(-50%, 2px);
    font-size: 0.72rem; color: var(--text-faint); letter-spacing: 0.04em; text-transform: uppercase;
  }
</style>
