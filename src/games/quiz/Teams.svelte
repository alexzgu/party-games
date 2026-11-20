<script lang="ts">
  import Stepper from '../../components/Stepper.svelte';
  import { MAX_TEAMS, MIN_TEAMS } from './logic';
  import { DEFAULT_TEAMS, teamColor } from './look';

  // How many teams (one team is a solo player), and their names. All ten names are kept, so
  // going 8 → 3 → 8 loses nothing. Past four the names sit two to a row on wider screens.
  let { names = $bindable(), count = $bindable() }: { names: string[]; count: number } = $props();
</script>

<section class="teams" aria-labelledby="teams-h">
  <h3 id="teams-h">Teams</h3>
  <Stepper bind:value={count} min={MIN_TEAMS} max={MAX_TEAMS} label={count === 1 ? 'Solo: one player' : 'Number of teams'} />
  {#if count === 1}<p class="hint">Play for a high score: each tile is “Got it” or “Missed”.</p>{/if}
  <ul class:many={count > 4}>
    {#each names.slice(0, count) as _, i (i)}
      <li class="pop-in" style:--team={teamColor(i)}>
        <span class="dot" aria-hidden="true">{count > 1 && i < 9 ? i + 1 : ''}</span>
        <input
          type="text"
          bind:value={names[i]}
          placeholder={DEFAULT_TEAMS[i]}
          aria-label={count === 1 ? 'Player name' : `Team ${i + 1} name`}
          autocomplete="off" autocapitalize="words" enterkeyhint="done" maxlength="18"
        />
      </li>
    {/each}
  </ul>
</section>

<style>
  .teams { display: flex; flex-direction: column; gap: var(--s-2); }
  .hint { margin: 0; color: var(--text-dim); font-size: 0.9rem; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--s-2); }
  @media (min-width: 520px) { ul.many { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  li { position: relative; }
  .dot {
    position: absolute; left: 10px; top: 50%; width: 22px; height: 22px; margin-top: -11px; border-radius: 50%;
    display: grid; place-items: center; font-size: 0.72rem; font-weight: 800; color: var(--bg);
    background: var(--team); box-shadow: 0 0 10px color-mix(in srgb, var(--team) 60%, transparent);
  }
  input { padding-left: 42px; font-weight: 700; border-color: color-mix(in srgb, var(--team) 45%, var(--line-strong)); }
  input::placeholder { color: var(--text-faint); font-weight: 600; }
</style>
