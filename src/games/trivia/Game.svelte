<script lang="ts">
  // Smarty Pants entry, for now: #/trivia/make and #/trivia/pack?id=<pack> open the pack
  // screens; anything else shows the game's name. A stand-in kept tiny on purpose: the room game
  // (host, join, solo, settings with the pack list) replaces this file.
  import Screen from '../../components/Screen.svelte';
  import { gameName } from '../../app.config';
  import { back, route } from '../../lib/router.svelte';
  import PackEditor from './PackEditor.svelte';
  import Make from './Make.svelte';

  const sub = $derived(route.path.split('/')[2]);
</script>

<div class="game">
  {#if sub === 'pack'}<PackEditor id={route.params.get('id') ?? ''} onback={() => back('/trivia')} />
  {:else if sub === 'make'}<Make onsaved={() => back('/trivia')} onback={() => back('/trivia')} />
  {:else}<Screen title={gameName('trivia')} onback={() => back('/games')} backLabel="Games"><p class="muted">Coming soon.</p></Screen>
  {/if}
</div>

<style>
  .game {
    --accent: var(--c-trivia);
    display: contents;
  }
</style>
