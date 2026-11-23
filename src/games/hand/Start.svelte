<script lang="ts">
  import { gameName } from '../../app.config';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import HowTo from '../../components/HowTo.svelte';
  import RoomBanner from '../../components/room/RoomBanner.svelte';
  import ConnectionLink from '../../components/room/ConnectionLink.svelte';
  import { back, go } from '../../lib/router.svelte';
  import { unlockAudio } from '../../lib/sound';
  import { host } from './host.svelte';
  import { phone } from './player.svelte';
  import { loadGame } from './store';
  import Rules from './Rules.svelte';

  // A room this screen is still hosting (stepped away, or reloaded): Return goes back to it.
  const openRoom = $derived(host.game ?? loadGame());
  const rejoin = $derived(phone.me?.code && phone.me.joined ? phone.me : null);
  function hostHere() {
    unlockAudio();
    go('/hand/host');
  }
</script>

<Screen title={gameName('hand')} onback={() => back('/')} backLabel="Home">
  {#snippet trailing()}<HowTo><Rules /></HowTo>{/snippet}
  <div class="start">
    {#if openRoom}
      <RoomBanner title="Room {openRoom.code} is open" detail="{openRoom.phase === 'lobby' ? 'In the lobby' : 'Game in progress'} on this device" action="Return" label="Return to room {openRoom.code}" onclick={hostHere} />
    {:else if rejoin}
      <RoomBanner title="You're in room {rejoin.code}" detail="as {rejoin.name}" action="Rejoin" label="Rejoin room {rejoin.code} as {rejoin.name}" onclick={() => go(`/hand/join?code=${rejoin.code}`)} />
    {/if}
    <Button size="lg" onclick={hostHere}>{openRoom ? `Host on this screen: room ${openRoom.code}` : 'Host on this screen'}</Button>
    <Button size="lg" variant="secondary" onclick={() => go('/hand/join')}>Join a game</Button>
    <p class="muted">3 to 10 players, each on their own phone, and a screen everyone can see.</p>
    <ConnectionLink />
  </div>
</Screen>

<style>
  .start { display: grid; gap: var(--s-3); }
</style>
