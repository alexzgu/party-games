<script lang="ts">
  // Snark Tank entry. Sub-routes: #/snark (host or join), #/snark/host (the host screen),
  // #/snark/join?code=ABCD (a player's phone), #/snark/settings (rounds, timers, packs),
  // #/snark/pack?id=<pack> (see and edit a pack), #/snark/make (paste a new pack).
  // ?peer=host:port on any of them switches this device to another matchmaking broker.
  import { route, go, back } from '../../lib/router.svelte';
  import { brokerFromAddress } from '../../lib/room/broker';
  import Start from './Start.svelte';
  import Host from './Host.svelte';
  import Phone from './Phone.svelte';
  import HostSettings from './HostSettings.svelte';
  import PackEditor from './PackEditor.svelte';
  import Make from './Make.svelte';
  import { loadSettings, saveSettings } from './store';
  import { host } from './host.svelte';

  brokerFromAddress(route.params);
  const sub = $derived(route.path.split('/').filter(Boolean)[1] ?? '');

  function packMade(id: string) {
    const s = loadSettings();
    const next = { ...s, packIds: [...new Set([...s.packIds, id])] };
    saveSettings(next);
    host.settings(next);
    back('/snark/settings');
  }
</script>

<div class="snark">
  {#if sub === 'host'}
    <Host />
  {:else if sub === 'join'}
    <Phone />
  {:else if sub === 'settings'}
    <HostSettings onback={() => back('/snark/host')} onedit={(id) => go(`/snark/pack?id=${encodeURIComponent(id)}`)} onmake={() => go('/snark/make')} />
  {:else if sub === 'pack'}
    <PackEditor id={route.params.get('id') ?? ''} onback={() => back('/snark/settings')} />
  {:else if sub === 'make'}
    <Make onsaved={packMade} onback={() => back('/snark/settings')} />
  {:else}
    <Start />
  {/if}
</div>

<style>
  .snark { --accent: var(--c-snark); display: contents; }
</style>
