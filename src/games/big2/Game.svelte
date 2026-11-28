<script lang="ts">
  // Big 2 entry. Sub-routes: #/big2 (host or join), #/big2/host, #/big2/join?code=ABCD,
  // #/big2/settings (the rules).
  import { route, back } from '../../lib/router.svelte';
  import { brokerFromAddress } from '../../lib/room/broker';
  import StartRoom from '../../components/room/StartRoom.svelte';
  import Host from './Host.svelte';
  import Phone from './Phone.svelte';
  import HostSettings from './HostSettings.svelte';
  import { host } from './host.svelte';
  import { phone } from './player.svelte';
  import { loadGame } from './store';
  import Rules from './Rules.svelte';

  const sub = $derived(route.path.split('/')[2]);
  // Before any child screen opens a link, so host and phones use the broker the address names.
  brokerFromAddress(route.params);
</script>

<div class="game">
  {#if sub === 'host'}<Host />
  {:else if sub === 'join'}<Phone />
  {:else if sub === 'settings'}<HostSettings onback={() => back('/big2/host')} />
  {:else}<StartRoom game="big2" open={host.game ?? loadGame()} me={phone.me} rules={Rules}
    about="2 to 4 players, each holding their cards on their own phone, and a screen everyone can see as the table." />{/if}
</div>

<style>
  .game { --accent: var(--c-big2); display: contents; }
</style>
