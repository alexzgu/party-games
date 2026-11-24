<script lang="ts">
  // Would You Rather entry, for now: #/rather/make and #/rather/pack?id=<pack> open the pack
  // screens; anything else shows the game's name. A stand-in kept tiny on purpose: the room game
  // (host, join, settings with the pack list) replaces this file.
  import Screen from '../../components/Screen.svelte';
  import { gameName } from '../../app.config';
  import { back, route } from '../../lib/router.svelte';
  import PackEditor from './PackEditor.svelte';
  import Make from './Make.svelte';

  const sub = $derived(route.path.split('/')[2]);
</script>

<div class="game">
  {#if sub === 'pack'}<PackEditor id={route.params.get('id') ?? ''} onback={() => back('/rather')} />
  {:else if sub === 'make'}<Make onsaved={() => back('/rather')} onback={() => back('/rather')} />
  {:else}<Screen title={gameName('rather')} onback={() => back('/games')} backLabel="Games"><p class="muted">Coming soon.</p></Screen>
  {/if}
</div>

<style>
  .game {
    --accent: var(--c-rather);
    display: contents;
  }
</style>
