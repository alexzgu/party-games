<script lang="ts">
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import HowTo from '../../components/HowTo.svelte';
  import Connection from '../../components/room/Connection.svelte';
  import { gameName } from '../../app.config';
  import { go, route } from '../../lib/router.svelte';
  import { brokerFromAddress } from '../../lib/room/broker';
  import Host from './Host.svelte';
  import Phone from './Phone.svelte';
  import HostSettings from './HostSettings.svelte';
  import Rules from './Rules.svelte';

  const sub = $derived(route.path.split('/')[2]);
  let connection = $state(false);
  $effect(() => brokerFromAddress(route.params));
</script>

<div class="game">
  {#if sub === 'host'}<Host />
  {:else if sub === 'join'}<Phone />
  {:else if sub === 'settings'}<HostSettings />
  {:else}
    <Screen title={gameName('brawl')}>
      {#snippet trailing()}<HowTo><Rules /></HowTo>{/snippet}
      <div class="start">
        <Button size="lg" onclick={() => go('/brawl/host')}>Host on this screen</Button>
        <Button size="lg" variant="secondary" onclick={() => go('/brawl/join')}>Join a game</Button>
        <Button variant="secondary" onclick={() => (connection = true)}>Connection settings</Button>
      </div>
    </Screen>
  {/if}
</div>
{#if connection}<Connection onclose={() => (connection = false)} />{/if}

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
</style>
