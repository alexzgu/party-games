<script lang="ts">
  // Bad Hand entry. Sub-routes: #/hand (host or join), #/hand/host, #/hand/join?code=ABCD,
  // #/hand/settings (packs and rules), #/hand/pack?id=<pack> (see and edit a pack), #/hand/make.
  import { route, go, back } from '../../lib/router.svelte';
  import { brokerFromAddress } from '../../lib/room/broker';
  import Host from './Host.svelte';
  import Phone from './Phone.svelte';
  import HostSettings from './HostSettings.svelte';
  import PackEditor from './PackEditor.svelte';
  import Make from './Make.svelte';
  import Start from './Start.svelte';
  import { loadSettings } from './store';
  import { host } from './host.svelte';

  const sub = $derived(route.path.split('/')[2]);
  // Before any child screen opens a link, so host and phones use the broker the address names.
  brokerFromAddress(route.params);

  /** A pack just made joins the picked ones (like an expansion), and settings show it. */
  function packMade(id: string) {
    const s = loadSettings();
    host.settings({ ...s, packs: [...new Set([...s.packs, id])] });
    back('/hand/settings');
  }
</script>

<div class="game">
  {#if sub === 'host'}<Host />
  {:else if sub === 'join'}<Phone />
  {:else if sub === 'settings'}
    <HostSettings onback={() => back('/hand/host')} onedit={(id) => go(`/hand/pack?id=${encodeURIComponent(id)}`)} onmake={() => go('/hand/make')} />
  {:else if sub === 'pack'}<PackEditor id={route.params.get('id') ?? ''} onback={() => back('/hand/settings')} />
  {:else if sub === 'make'}<Make onsaved={packMade} onback={() => back('/hand/settings')} />
  {:else}<Start />{/if}
</div>

<style>
  .game { --accent: var(--c-hand); display: contents; }
</style>
