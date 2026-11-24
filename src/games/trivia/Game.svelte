<script lang="ts">
  // Smarty Pants entry. Sub-routes: #/trivia (host, join or solo), #/trivia/host,
  // #/trivia/join?code=ABCD, #/trivia/solo (one phone alone), #/trivia/settings (packs and rules),
  // #/trivia/pack?id=<pack> (see and edit a pack), #/trivia/make.
  import { route, go, back } from '../../lib/router.svelte';
  import { brokerFromAddress } from '../../lib/room/broker';
  import Host from './Host.svelte';
  import Phone from './Phone.svelte';
  import Solo from './Solo.svelte';
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
    back('/trivia/settings');
  }
</script>

<div class="game">
  {#if sub === 'host'}<Host />
  {:else if sub === 'join'}<Phone />
  {:else if sub === 'solo'}<Solo />
  {:else if sub === 'settings'}
    <HostSettings onback={() => back('/trivia/host')} onedit={(id) => go(`/trivia/pack?id=${encodeURIComponent(id)}`)} onmake={() => go('/trivia/make')} />
  {:else if sub === 'pack'}<PackEditor id={route.params.get('id') ?? ''} onback={() => back('/trivia/settings')} />
  {:else if sub === 'make'}<Make onsaved={packMade} onback={() => back('/trivia/settings')} />
  {:else}<Start />{/if}
</div>

<style>
  .game { --accent: var(--c-trivia); display: contents; }
</style>
