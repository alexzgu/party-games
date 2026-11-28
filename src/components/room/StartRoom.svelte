<script lang="ts">
  import type { Component } from 'svelte';
  import { gameName, type GameId } from '../../app.config';
  import Screen from '../Screen.svelte';
  import Button from '../Button.svelte';
  import HowTo from '../HowTo.svelte';
  import RoomBanner from './RoomBanner.svelte';
  import ConnectionLink from './ConnectionLink.svelte';
  import { back, go } from '../../lib/router.svelte';
  import { unlockAudio } from '../../lib/sound';
  import type { Me } from '../../lib/room/phone-link.svelte';

  // A table game's first screen (Go Fish, Big 2): Host or Join, and Return to a room this device
  // still hosts (stepped away, or reloaded) or Rejoin one this phone is seated in.
  let { game, open, me, about, rules: Rules }: {
    game: GameId; open: { code: string; phase: string } | null; me: Me | null; about: string; rules: Component;
  } = $props();
  const rejoin = $derived(me?.code && me.joined ? me : null);
  function hostHere() {
    unlockAudio();
    go(`/${game}/host`);
  }
</script>

<Screen title={gameName(game)} onback={() => back('/games')} backLabel="Games">
  {#snippet trailing()}<HowTo><Rules /></HowTo>{/snippet}
  <div class="start">
    {#if open}
      <RoomBanner title="Room {open.code} is open" detail="{open.phase === 'lobby' ? 'In the lobby' : 'Game in progress'} on this device" action="Return" label="Return to room {open.code}" onclick={hostHere} tip="Goes back to the room open on this device" />
    {:else if rejoin}
      <RoomBanner title="You're in room {rejoin.code}" detail="as {rejoin.name}" action="Rejoin" label="Rejoin room {rejoin.code} as {rejoin.name}" onclick={() => go(`/${game}/join?code=${rejoin.code}`)} tip="Takes you back into that room under your name" />
    {/if}
    <Button size="lg" onclick={hostHere} tip={open ? 'Goes back to the room open on this device' : 'Opens a room here and shows its code for phones to join'}>{open ? `Room ${open.code}` : 'Host'}</Button>
    <Button size="lg" variant="secondary" onclick={() => go(`/${game}/join`)} tip="Type in a room code to play on this device">Join</Button>
    <p class="muted">{about}</p>
    <ConnectionLink />
  </div>
</Screen>

<style>
  .start { display: grid; gap: var(--s-3); }
</style>
