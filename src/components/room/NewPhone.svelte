<script lang="ts">
  import Button from '../Button.svelte';
  import Popup from '../Popup.svelte';
  import { BOT_PID, type HostLink } from '../../lib/room/host-link.svelte';

  // Host screen: lets a player back in from a phone that cannot prove their seat (a new phone,
  // cleared storage, an old page). The host picks them from the room's players after checking who
  // it is; their seat then opens to one phone for a minute (SeatAsk shows it).
  let { link, players }: { link: HostLink; players: readonly { pid: string; name: string }[] } = $props();
  let picking = $state(false);
  const people = $derived(players.filter((p) => !p.pid.startsWith(BOT_PID) && !link.removed(p.pid)));
</script>

{#if people.length}
  <Button size="sm" variant="secondary" onclick={() => (picking = true)} tip="Lets a player back in from another phone, once you see who it is">New phone</Button>
{/if}
{#if picking}
  <Popup title="Whose phone?" onclose={() => (picking = false)}>
    <p>Pick the player in front of you. For a minute, their seat opens to the next phone that joins.</p>
    {#each people as p (p.pid)}
      <Button variant="secondary" onclick={() => { link.recoverSeat(p.pid, p.name); picking = false; }}>{p.name}</Button>
    {/each}
  </Popup>
{/if}
