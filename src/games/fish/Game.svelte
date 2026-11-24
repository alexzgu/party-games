<script lang="ts">
  // Go Fish entry. Sub-routes: #/fish (host or join), #/fish/host, #/fish/join?code=ABCD,
  // #/fish/settings (the rules).
  import { route, back } from '../../lib/router.svelte';
  import { brokerFromAddress } from '../../lib/room/broker';
  import Host from './Host.svelte';
  import Phone from './Phone.svelte';
  import HostSettings from './HostSettings.svelte';
  import Start from './Start.svelte';

  const sub = $derived(route.path.split('/')[2]);
  // Before any child screen opens a link, so host and phones use the broker the address names.
  brokerFromAddress(route.params);
</script>

<div class="game">
  {#if sub === 'host'}<Host />
  {:else if sub === 'join'}<Phone />
  {:else if sub === 'settings'}<HostSettings onback={() => back('/fish/host')} />
  {:else}<Start />{/if}
</div>

<style>
  .game { --accent: var(--c-fish); display: contents; }
</style>
