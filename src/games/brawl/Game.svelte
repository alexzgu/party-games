<script lang="ts">
  // Doodle Brawl entry. Sub-routes: #/brawl (host or join), #/brawl/host, #/brawl/join?code=ABCD,
  // #/brawl/settings (packs and draw time), #/brawl/pack?id=<pack> (see and edit a pack), #/brawl/make.
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import HowTo from '../../components/HowTo.svelte';
  import ConnectionLink from '../../components/room/ConnectionLink.svelte';
  import { gameName } from '../../app.config';
  import { back, go, route } from '../../lib/router.svelte';
  import { brokerFromAddress } from '../../lib/room/broker';
  import Host from './Host.svelte';
  import Phone from './Phone.svelte';
  import HostSettings from './HostSettings.svelte';
  import PackEditor from './PackEditor.svelte';
  import Make from './Make.svelte';
  import Rules from './Rules.svelte';
  import { host } from './host.svelte';
  import { loadGame, loadSettings } from './store';

  const sub = $derived(route.path.split('/')[2]);
  // A room this screen is still hosting (stepped away, or reloaded): the host button goes back to it.
  const openRoom = $derived(sub ? null : host.game ?? loadGame());
  // Before any child screen opens a link, so host and phones use the broker the address names.
  brokerFromAddress(route.params);

  /** A pack just made joins the picked ones, and settings show it. */
  function packMade(ids: string[]) {
    const s = loadSettings();
    host.settings({ ...s, packs: [...new Set([...s.packs, ...ids])] });
    back('/brawl/settings');
  }
</script>

<div class="game">
  {#if sub === 'host'}<Host />
  {:else if sub === 'join'}<Phone />
  {:else if sub === 'settings'}
    <HostSettings onback={() => back('/brawl/host')} onedit={(id) => go(`/brawl/pack?id=${encodeURIComponent(id)}`)} onmake={() => go('/brawl/make')} />
  {:else if sub === 'pack'}<PackEditor id={route.params.get('id') ?? ''} onback={() => back('/brawl/settings')} />
  {:else if sub === 'make'}<Make onsaved={packMade} onback={() => back('/brawl/settings')} />
  {:else}
    <Screen title={gameName('brawl')}>
      {#snippet trailing()}<HowTo><Rules /></HowTo>{/snippet}
      <div class="start">
        {#if openRoom}<p class="open" role="status"><b>Room {openRoom.code} is open</b> on this screen{openRoom.phase === 'lobby' ? ', in the lobby' : ', game in progress'}.</p>{/if}
        <Button size="lg" onclick={() => go('/brawl/host')} label={openRoom ? `Return to room ${openRoom.code}` : undefined} tip={openRoom ? 'Goes back to the room open on this screen' : 'Opens a room here and shows its code for phones to join'}>{openRoom ? 'Return' : 'Host on this screen'}</Button>
        <Button size="lg" variant="secondary" onclick={() => go('/brawl/join')} tip="Type in a room code to play on this device">Join a game</Button>
        <p class="muted">3 to 8 players, each on their own phone.</p>
        <ConnectionLink />
      </div>
    </Screen>
  {/if}
</div>

<style>
  .game {
    --accent: var(--c-brawl);
    display: contents;
  }
  .start { display: grid; gap: var(--s-3); }
  .open { padding: var(--s-3) var(--s-4); border-radius: var(--r-md); border: 2px solid var(--accent); background: color-mix(in srgb, var(--accent) 14%, var(--surface)); }
</style>
