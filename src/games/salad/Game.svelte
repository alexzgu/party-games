<script lang="ts">
  import { route } from '../../lib/router.svelte';
  import { brokerFromAddress } from '../../lib/room/broker';
  import Host from './Host.svelte';
  import HostSettings from './HostSettings.svelte';
  import Phone from './Phone.svelte';
  import Start from './Start.svelte';

  if (!route.params.has('demo')) brokerFromAddress(route.params);
  $effect(() => {
    if (!route.params.has('demo')) brokerFromAddress(route.params);
  });
  const sub = $derived(route.path.split('/').filter(Boolean)[1]);
</script>

<div class="salad">
  {#key `${sub}:${route.params.get('demo') ?? ''}`}
    {#if sub === 'host'}
      <Host />
    {:else if sub === 'join'}
      <Phone />
    {:else if sub === 'settings'}
      <HostSettings />
    {:else}
      <Start />
    {/if}
  {/key}
</div>

<style>
  .salad { --accent: var(--c-salad); display: contents; }
</style>
