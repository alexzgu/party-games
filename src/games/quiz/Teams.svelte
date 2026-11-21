<script lang="ts">
  import PlayerList from '../../components/PlayerList.svelte';
  import { MAX_TEAMS, MIN_TEAMS } from './logic';
  import { teamColor } from './look';
  import { checkTeamName, nextTeamName } from './teams';

  // Add, rename and remove teams, the same list as the other games' players; one team is a solo
  // player. A team's colour and number follow its place. While a game is saved, `locked` keeps solo
  // and team play from turning into each other. `seats` follows each team's place in a saved game
  // (see PlayerList).
  let { names = $bindable(), seats = $bindable([]), locked = null }: {
    names: string[]; seats?: number[]; locked?: 'solo' | 'teams' | null;
  } = $props();
  const min = $derived(locked === 'teams' ? 2 : MIN_TEAMS);
  const max = $derived(locked === 'solo' ? 1 : MAX_TEAMS);
</script>

<PlayerList bind:names bind:seats {min} {max} keep={min} check={checkTeamName} newName={nextTeamName}
  noun="team" nouns="teams" tally={(n) => (n === 1 ? 'Solo' : String(n))}
  full={locked === 'solo' ? 'Solo until a new game' : undefined}>
  {#snippet note()}
    {#if names.length === 1}<p class="hint">Play for a high score: each tile is “Got it” or “Missed”.</p>{/if}
  {/snippet}
  {#snippet avatar(_, i)}
    <span class="dot" aria-hidden="true" style:--team={teamColor(i)}>{names.length > 1 ? i + 1 : ''}</span>
  {/snippet}
</PlayerList>

<style>
  .hint { margin: 0; color: var(--text-dim); font-size: 0.9rem; }
  .dot {
    flex: none; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center;
    font-family: var(--font-display); font-size: 0.95rem; font-weight: 800; line-height: 1; color: var(--bg);
    background: var(--team); box-shadow: 0 0 10px color-mix(in srgb, var(--team) 60%, transparent);
  }
</style>
