<script lang="ts">
  import Setup from './Setup.svelte';
  import Round from './Round.svelte';
  import MyDecks from './MyDecks.svelte';
  import DeckEditor from './DeckEditor.svelte';
  import MakeDeck from './MakeDeck.svelte';
  import { route, go } from '../../lib/router.svelte';
  import { game, setRound } from './state.svelte';
  import { demoRound } from './demo';

  // Heads Down's router: #/forehead (setup), /play, /decks, /deck?id=…, /make?into=…
  const sub = $derived(route.path.split('/').filter(Boolean)[1] ?? '');
  const demo = route.params.get('demo');
  const rot = Number(route.params.get('rot')) || undefined;
  if (demo && route.path === '/forehead/play') setRound(demoRound(demo));

  // A round mid-play is never lost: Back (or coming back from Home) returns to it, paused.
  const playing = $derived(game.round?.phase === 'play');
  const view = $derived(sub === 'play' || (sub === '' && playing) ? 'play' : sub);

  $effect(() => {
    if (sub === '' && playing) {
      game.interrupt = true;
      go('/forehead/play');
    }
  });

</script>

<div class="forehead">
  {#if view === 'play'}
    <Round demo={demo} rotation={rot} />
  {:else if view === 'decks'}
    <MyDecks />
  {:else if view === 'deck'}
    {#key route.params.get('id')}
      <DeckEditor id={route.params.get('id') ?? 'new'} />
    {/key}
  {:else if view === 'make'}
    <MakeDeck into={route.params.get('into')} {demo} />
  {:else}
    <Setup />
  {/if}
</div>

<style>
  .forehead { --accent: var(--c-forehead); min-height: 100dvh; }
</style>
