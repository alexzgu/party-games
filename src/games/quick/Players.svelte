<script lang="ts">
  import Avatar from './Avatar.svelte';
  import PlayerList from '../../components/PlayerList.svelte';
  import { checkName, MAX_PLAYERS, MIN_PLAYERS } from './logic';

  // Add, rename and remove players. Turns go round in this order.
  // `seats` follows each player's place in a saved game (see PlayerList).
  let { names = $bindable(), seats = $bindable([]) }: { names: string[]; seats?: number[] } = $props();
</script>

<PlayerList bind:names bind:seats min={MIN_PLAYERS} max={MAX_PLAYERS} check={checkName}>
  {#snippet avatar(name, i)}<Avatar {name} index={i} size={32} />{/snippet}
</PlayerList>
