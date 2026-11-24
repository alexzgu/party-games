<script lang="ts">
  import { gameName } from '../../app.config';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import HowTo from '../../components/HowTo.svelte';
  import Rules from './Rules.svelte';
  import RoomBanner from '../../components/room/RoomBanner.svelte';
  import ConnectionLink from '../../components/room/ConnectionLink.svelte';
  import { back, go } from '../../lib/router.svelte';
  import { unlockAudio } from '../../lib/sound';
  import { host } from './host.svelte';
  import { phone } from './player.svelte';
  import { loadGame } from './store';

  // Pick a side: this device shows the game to the room, or it is one player's phone.
  const openRoom = host.game ?? loadGame();
  const rejoin = phone.me?.code && phone.me.joined ? phone.me : null;

  function hostHere() {
    unlockAudio();
    go('/snark/host');
  }
</script>

<Screen title={gameName('snark')} onback={() => back('/')} backLabel="Home">
  {#snippet trailing()}<HowTo><Rules /></HowTo>{/snippet}

  {#if openRoom}
    <RoomBanner title="Room {openRoom.code} is open" detail="{openRoom.phase === 'lobby' ? 'In the lobby' : 'Game in progress'} on this device" action="Return" label="Return to room {openRoom.code}" onclick={hostHere} tip="Goes back to the room open on this device" />
  {:else if rejoin}
    <RoomBanner title="You're in room {rejoin.code}" detail="as {rejoin.name}" action="Rejoin" label="Rejoin room {rejoin.code} as {rejoin.name}" onclick={() => go(`/snark/join?code=${rejoin.code}`)} tip="Takes you back into that room under your name" />
  {/if}

  <div class="choices">
    <button class="choice" onclick={hostHere}>
      <span class="emoji" aria-hidden="true">📺</span>
      <span class="what">{openRoom ? `Room ${openRoom.code}` : 'Host'}</span>
      <span class="why">A laptop on the TV, or a phone in the middle of the table. It shows the code, the answers and the scores.</span>
    </button>
    <button class="choice" onclick={() => go('/snark/join')}>
      <span class="emoji" aria-hidden="true">📱</span>
      <span class="what">Join</span>
      <span class="why">Answer and vote on your own phone. You need the 4-letter code from the host screen.</span>
    </button>
  </div>

  <p class="faint note">3 to 8 players, each on their own phone. Phones and the host screen need the internet to find each other.</p>
  <ConnectionLink />
</Screen>

<style>
  .choices { display: grid; gap: var(--s-3); }
  .choice {
    display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto; column-gap: var(--s-4); row-gap: 2px;
    align-items: center; text-align: left; padding: var(--s-5) var(--s-4); min-height: 120px;
    border-radius: var(--r-lg); border: 2px solid var(--line); background: var(--surface);
    transition: transform var(--dur-fast) var(--ease-out), border-color var(--dur-fast) ease;
  }
  .choice:active { transform: scale(0.98); border-color: var(--accent); }
  .emoji { grid-row: span 2; font-size: 2.6rem; line-height: 1; }
  .what { font-family: var(--font-display); font-weight: 800; font-size: 1.45rem; color: var(--text); }
  .why { color: var(--text-dim); font-size: 0.95rem; line-height: 1.35; }
  .note { font-size: 0.9rem; line-height: 1.45; }
</style>
