<script lang="ts">
  // Sketchy entry. Sub-routes: #/sketch (host or join), #/sketch/host, #/sketch/join?code=ABCD,
  // #/sketch/settings (mode, packs, timers), #/sketch/pack?id=<pack> (see and edit a pack), #/sketch/make.
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
    back('/sketch/settings');
  }
</script>

<div class="game">
  {#if sub === 'host'}<Host />
  {:else if sub === 'join'}<Phone />
  {:else if sub === 'settings'}
    <HostSettings onback={() => back('/sketch/host')} onedit={(id) => go(`/sketch/pack?id=${encodeURIComponent(id)}`)} onmake={() => go('/sketch/make')} />
  {:else if sub === 'pack'}<PackEditor id={route.params.get('id') ?? ''} onback={() => back('/sketch/settings')} />
  {:else if sub === 'make'}<Make onsaved={packMade} onback={() => back('/sketch/settings')} />
  {:else}
    <Screen title={gameName('sketch')} onback={() => back('/games')} backLabel="Games">
      {#snippet trailing()}<HowTo><Rules /></HowTo>{/snippet}
      <div class="start">
        {#if openRoom}<p class="open" role="status"><b>Room {openRoom.code} is open</b> on this screen{openRoom.phase === 'lobby' ? ', in the lobby' : ', game in progress'}.</p>{/if}
        <Button size="lg" onclick={() => go('/sketch/host')} label={openRoom ? `Return to room ${openRoom.code}` : undefined} tip={openRoom ? 'Goes back to the room open on this screen' : 'Opens a room here and shows its code for phones to join'}>{openRoom ? 'Return' : 'Host'}</Button>
        <Button size="lg" variant="secondary" onclick={() => go('/sketch/join')} tip="Type in a room code to play on this device">Join</Button>
        <p class="muted">3 to 10 players, each on their own phone. Two modes: Telephone and Draw & guess.</p>
        <ConnectionLink />
      </div>
    </Screen>
  {/if}
</div>

<style>
  .game { --accent: var(--c-sketch); display: contents; }
  /* White paper on the light scheme's pale page: a hairline keeps its edge. */
  .game :global(canvas) { box-shadow: 0 0 0 1px var(--line-strong); }
  .start { display: grid; gap: var(--s-3); }
  .open { padding: var(--s-3) var(--s-4); border-radius: var(--r-md); border: 2px solid var(--accent); background: color-mix(in srgb, var(--accent) 14%, var(--surface)); }
</style>
