<script lang="ts">
  import Avatar from './Avatar.svelte';
  import PlayerList from '../../components/PlayerList.svelte';
  import { checkName, MAX_PLAYERS, MIN_PLAYERS } from './logic';

  // Add, rename and remove players. The order is only for the scoreboard.
  let { names = $bindable() }: { names: string[] } = $props();
</script>

<PlayerList bind:names min={MIN_PLAYERS} max={MAX_PLAYERS} check={checkName}>
  {#snippet avatar(name, i)}<Avatar {name} index={i} size={32} />{/snippet}
</PlayerList>
