<script lang="ts">
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import HowTo from '../../components/HowTo.svelte';
  import ConnectionLink from '../../components/room/ConnectionLink.svelte';
  import { gameName } from '../../app.config';
  import { go, route } from '../../lib/router.svelte';
  import { brokerFromAddress } from '../../lib/room/broker';
  import Host from './Host.svelte';
  import Phone from './Phone.svelte';
  import HostSettings from './HostSettings.svelte';
  import Rules from './Rules.svelte';
  import { host } from './host.svelte';
  import { loadGame } from './store';

  const sub = $derived(route.path.split('/')[2]);
  // A room this screen is still hosting (stepped away, or reloaded): the host button goes back to it.
  const openRoom = $derived(sub ? null : host.game ?? loadGame());
  // Before any child screen opens a link, so host and phones use the broker the address names.
  brokerFromAddress(route.params);
</script>

<div class="game">
  {#if sub === 'host'}<Host />
  {:else if sub === 'join'}<Phone />
  {:else if sub === 'settings'}<HostSettings />
  {:else}
    <Screen title={gameName('brawl')}>
      {#snippet trailing()}<HowTo><Rules /></HowTo>{/snippet}
      <div class="start">
        {#if openRoom}<p class="open" role="status"><b>Room {openRoom.code} is open</b> on this screen{openRoom.phase === 'lobby' ? ', in the lobby' : ', game in progress'}.</p>{/if}
        <Button size="lg" onclick={() => go('/brawl/host')} label={openRoom ? `Return to room ${openRoom.code}` : undefined}>{openRoom ? 'Return' : 'Host on this screen'}</Button>
        <Button size="lg" variant="secondary" onclick={() => go('/brawl/join')}>Join a game</Button>
        <p class="muted">3 to 8 players, each on their own phone.</p>
        <ConnectionLink />
      </div>
    </Screen>
  {/if}
</div>

<style>
  .game {
    --accent: var(--c-brawl);
  --ink-paper: #fff;
  --ink-black: #17141f;
  --ink-red: #b91c36;
  --ink-orange: #aa470b;
  --ink-green: #18713b;
  --ink-blue: #1648ad;
  --ink-purple: #6926a3;
  --ink-pink: #a31a72;
  --ink-brown: #713f2a;
    display: contents;
  }
  .start { display: grid; gap: var(--s-3); }
  .open { padding: var(--s-3) var(--s-4); border-radius: var(--r-md); border: 2px solid var(--accent); background: color-mix(in srgb, var(--accent) 14%, var(--surface)); }
</style>
