<script lang="ts">
  import Popup from '../../components/Popup.svelte';
  import Button from '../../components/Button.svelte';
  import { points, scores, type Game } from './logic';
  import { teamColor } from './look';

  // Fix one team's score by a board value, up or down. Each tap counts at once and can be undone.
  let { game, team, onadjust, onclose }: { game: Game; team: number; onadjust: (delta: number) => void; onclose: () => void } = $props();
  const score = $derived(scores(game)[team]);
</script>

<Popup title="Fix the score" {onclose}>
  <div class="fix" style:--team={teamColor(team)}>
    <p class="who">{game.teams[team]}</p>
    <p class="score" aria-live="polite">{points(score)}</p>
    <div class="rows">
      <span class="label">Add</span>
      <div class="vals" style:--n={game.values.length}>
        {#each game.values as v (v)}
          <button class="up" onclick={() => onadjust(v)} aria-label="Add {v}">+{v}</button>
        {/each}
      </div>
      <span class="label">Take away</span>
      <div class="vals" style:--n={game.values.length}>
        {#each game.values as v (v)}
          <button class="down" onclick={() => onadjust(-v)} aria-label="Take away {v}">−{v}</button>
        {/each}
      </div>
    </div>
    <Button onclick={onclose}>Done</Button>
  </div>
</Popup>

<style>
  .fix { display: flex; flex-direction: column; gap: var(--s-3); }
  .who { font-family: var(--font-display); font-weight: 800; font-size: 1.4rem; color: var(--team); text-align: center; }
  .score { font-family: var(--font-display); font-weight: 800; font-size: 3rem; line-height: 1; text-align: center; font-variant-numeric: tabular-nums; }
  .rows { display: flex; flex-direction: column; gap: var(--s-2); }
  .label { font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-faint); }
  .vals { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 6px; }
  .vals button {
    min-height: 48px; padding: 0 2px; border-radius: var(--r-sm); font-weight: 800; font-variant-numeric: tabular-nums;
    background: var(--surface); border: 1.5px solid var(--line-strong); font-size: 0.95rem;
  }
  .up { color: var(--c-good); }
  .down { color: var(--c-bad); }
  .vals button:active { background: var(--surface-hi); }
</style>
