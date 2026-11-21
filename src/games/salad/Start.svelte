<script lang="ts">
  import { gameName } from '../../app.config';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import HowTo from '../../components/HowTo.svelte';
  import Connection from '../../components/room/Connection.svelte';
  import { back, go } from '../../lib/router.svelte';
  import { unlockAudio } from '../../lib/sound';
  import { host } from './host.svelte';
  import { phone } from './player.svelte';
  import { loadGame } from './store';
  import Rules from './Rules.svelte';

  const openRoom = $derived(host.game ?? loadGame());
  const rejoin = $derived(phone.me?.code && phone.me.joined ? phone.me : null);
  let connection = $state(false);

  function hostHere() {
    unlockAudio();
    go('/salad/host');
  }
</script>

<Screen title={gameName('salad')} onback={() => back('/')} backLabel="Home">
  {#snippet trailing()}<HowTo><Rules /></HowTo>{/snippet}

  {#if openRoom}
    <Button variant="secondary" onclick={hostHere}>Return to room {openRoom.code}</Button>
  {:else if rejoin}
    <Button variant="secondary" onclick={() => go(`/salad/join?code=${rejoin.code}`)}>Rejoin {rejoin.code} as {rejoin.name}</Button>
  {/if}

  <button class="choice" onclick={hostHere}>
    <b>Host on this screen</b>
    <span>Show the room code, clues, guesses and scores on a screen everyone can see.</span>
  </button>
  <button class="choice" onclick={() => go('/salad/join')}>
    <b>Join a game</b>
    <span>Give clues and type guesses on your phone. Use the four-letter code from the host.</span>
  </button>

  <p class="muted">2–8 players, each on their own phone.</p>
  <Button variant="ghost" onclick={() => (connection = true)}>Connection settings</Button>
</Screen>

{#if connection}<Connection onclose={() => (connection = false)} />{/if}

<style>
  .choice {
    display: grid; gap: var(--s-2); padding: var(--s-4) var(--s-5); min-height: 104px;
    background: var(--surface); border: 2px solid var(--line); border-radius: var(--r-lg); text-align: left;
  }
  .choice b { font-family: var(--font-display); font-size: 1.4rem; color: var(--accent); }
  .choice span { color: var(--text-dim); }
</style>
