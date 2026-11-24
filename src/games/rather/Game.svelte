<script lang="ts">
  // Would You Rather entry. Sub-routes: #/rather (host, join or one phone), #/rather/host,
  // #/rather/join?code=ABCD, #/rather/aloud (one phone read aloud), #/rather/settings (packs and
  // rules), #/rather/pack?id=<pack> (see and edit a pack), #/rather/make.
  import { route, go, back } from '../../lib/router.svelte';
  import { brokerFromAddress } from '../../lib/room/broker';
  import Host from './Host.svelte';
  import Phone from './Phone.svelte';
  import Aloud from './Aloud.svelte';
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
  function packMade(ids: string[]) {
    const s = loadSettings();
    host.settings({ ...s, packs: [...new Set([...s.packs, ...ids])] });
    back('/rather/settings');
  }
</script>

<div class="game">
  {#if sub === 'host'}<Host />
  {:else if sub === 'join'}<Phone />
  {:else if sub === 'aloud'}<Aloud />
  {:else if sub === 'settings'}
    <HostSettings onback={() => back('/rather/host')} onedit={(id) => go(`/rather/pack?id=${encodeURIComponent(id)}`)} onmake={() => go('/rather/make')} />
  {:else if sub === 'pack'}<PackEditor id={route.params.get('id') ?? ''} onback={() => back('/rather/settings')} />
  {:else if sub === 'make'}<Make onsaved={packMade} onback={() => back('/rather/settings')} />
  {:else}<Start />{/if}
</div>

<style>
  .game { --accent: var(--c-rather); display: contents; }
</style>
