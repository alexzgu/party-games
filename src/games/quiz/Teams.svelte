<script lang="ts">
  import Segmented from '../../components/Segmented.svelte';
  import { MAX_TEAMS, MIN_TEAMS } from './logic';
  import { DEFAULT_TEAMS, teamColor } from './look';

  // How many teams, and their names. All four names are kept, so going 4 → 2 → 4 loses nothing.
  let { names = $bindable(), count = $bindable() }: { names: string[]; count: number } = $props();
  const counts = Array.from({ length: MAX_TEAMS - MIN_TEAMS + 1 }, (_, i) => ({ value: MIN_TEAMS + i, label: `${MIN_TEAMS + i} teams` }));
</script>

<section class="teams" aria-labelledby="teams-h">
  <h3 id="teams-h">Teams</h3>
  <Segmented bind:value={count} options={counts} label="Number of teams" />
  <ul>
    {#each names.slice(0, count) as _, i (i)}
      <li class="pop-in" style:--team={teamColor(i)}>
        <span class="dot" aria-hidden="true"></span>
        <input
          type="text"
          bind:value={names[i]}
          placeholder={DEFAULT_TEAMS[i]}
          aria-label="Team {i + 1} name"
          autocomplete="off" autocapitalize="words" enterkeyhint="done" maxlength="18"
        />
      </li>
    {/each}
  </ul>
</section>

<style>
  .teams { display: flex; flex-direction: column; gap: var(--s-2); }
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--s-2); }
  li { position: relative; }
  .dot {
    position: absolute; left: 14px; top: 50%; width: 14px; height: 14px; margin-top: -7px; border-radius: 50%;
    background: var(--team); box-shadow: 0 0 10px color-mix(in srgb, var(--team) 60%, transparent);
  }
  input { padding-left: 38px; font-weight: 700; border-color: color-mix(in srgb, var(--team) 45%, var(--line-strong)); }
  input::placeholder { color: var(--text-faint); font-weight: 600; }
</style>
