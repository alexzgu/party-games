<script lang="ts">
  import { gameName } from '../../app.config';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import HowTo from '../../components/HowTo.svelte';
  import Rules from './Rules.svelte';
  import Connection from '../../components/room/Connection.svelte';
  import { go } from '../../lib/router.svelte';
  import { unlockAudio } from '../../lib/sound';
  import { host } from './host.svelte';
  import { phone } from './player.svelte';
  import { loadGame } from './store';

  // Pick a side: this device shows the game to the room, or it is one player's phone.
  const openRoom = host.game ?? loadGame();
  const rejoin = phone.me?.code && phone.me.joined ? phone.me : null;
  let showConn = $state(false);

  function hostHere() {
    unlockAudio();
    go('/snark/host');
  }
</script>

<Screen title={gameName('snark')} onback={() => go('/', true)} backLabel="Home">
  {#snippet trailing()}<HowTo><Rules /></HowTo>{/snippet}

  {#if openRoom}
    <div class="banner pop-in" role="status">
      <span><b>Room {openRoom.code} is open</b><span class="muted">{openRoom.phase === 'lobby' ? 'In the lobby' : 'Game in progress'} on this device</span></span>
      <Button size="sm" onclick={hostHere}>Back to it</Button>
    </div>
  {:else if rejoin}
    <div class="banner pop-in" role="status">
      <span><b>You're in room {rejoin.code}</b><span class="muted">as {rejoin.name}</span></span>
      <Button size="sm" onclick={() => go(`/snark/join?code=${rejoin.code}`)}>Rejoin</Button>
    </div>
  {/if}

  <div class="choices">
    <button class="choice" onclick={hostHere}>
      <span class="emoji" aria-hidden="true">📺</span>
      <span class="what">Host on this screen</span>
      <span class="why">A laptop on the TV, or a phone in the middle of the table. It shows the code, the answers and the scores.</span>
    </button>
    <button class="choice" onclick={() => go('/snark/join')}>
      <span class="emoji" aria-hidden="true">📱</span>
      <span class="what">Join a game</span>
      <span class="why">Answer and vote on your own phone. You need the 4-letter code from the host screen.</span>
    </button>
  </div>

  <p class="faint note">3 to 8 players, each on their own phone. Phones and the host screen need the internet to find each other. <button class="link" onclick={() => (showConn = true)}>Connection settings</button></p>
</Screen>

{#if showConn}<Connection onclose={() => (showConn = false)} />{/if}

<style>
  .banner {
    display: flex; align-items: center; justify-content: space-between; gap: var(--s-3);
    padding: var(--s-4); border-radius: var(--r-lg); border: 2px solid var(--accent);
    background: color-mix(in srgb, var(--accent) 16%, var(--bg-raised));
  }
  .banner > span { display: flex; flex-direction: column; min-width: 0; }
  .banner b { font-family: var(--font-display); font-size: 1.15rem; }
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
  .link { background: none; padding: 0; color: var(--accent); font-weight: 600; text-decoration: underline; text-underline-offset: 3px; }
</style>
