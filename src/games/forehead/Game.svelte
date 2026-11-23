<script lang="ts">
  import Setup from './Setup.svelte';
  import Round from './Round.svelte';
  import DeckEditor from './DeckEditor.svelte';
  import MakeDeck from './MakeDeck.svelte';
  import Lab from './lab/Lab.svelte';
  import Calibrate from './Calibrate.svelte';
  import { route, go } from '../../lib/router.svelte';
  import { game, setRound } from './state.svelte';
  import { demoRound } from './demo';
  import { tapToSkip } from './skip';

  // Heads Down's router: #/forehead (setup), /play, /deck?id=…, /make?into=…, /calibrate, /lab (Tilt lab, unlinked).
  // The old pack list, /decks, is setup now.
  const sub = $derived(route.path.split('/').filter(Boolean)[1] ?? '');
  const demo = route.params.get('demo');
  const rot = Number(route.params.get('rot')) || undefined;
  if (demo && route.path === '/forehead/play') setRound(demoRound(demo));

  // A round mid-play is never lost: Back (or coming back from Home) returns to it, paused.
  const playing = $derived(game.round?.phase === 'play');
  const view = $derived(sub === 'play' || (sub === '' && playing) ? 'play' : sub);

  // Entrance animations finish on a tap, except during the countdown and the round itself.
  const skip = tapToSkip();
  const skippable = $derived(view !== 'play' || game.round?.phase === 'results');

  $effect(() => {
    if (sub === 'decks') go('/forehead', true);
  });
  $effect(() => {
    if (sub === '' && playing) {
      game.interrupt = true;
      go('/forehead/play');
    }
  });

</script>

<div class="forehead" onpointerdowncapture={skippable ? skip.onpointerdowncapture : undefined} onclickcapture={skippable ? skip.onclickcapture : undefined}>
  {#if view === 'play'}
    <Round demo={demo} rotation={rot} />
  {:else if view === 'deck'}
    {#key route.params.get('id')}
      <DeckEditor id={route.params.get('id') ?? 'new'} />
    {/key}
  {:else if view === 'calibrate'}
    <Calibrate />
  {:else if view === 'lab'}
    <Lab />
  {:else if view === 'make'}
    <MakeDeck into={route.params.get('into')} pasting={route.params.get('tab') === 'paste'} {demo} />
  {:else}
    <Setup />
  {/if}
</div>

<style>
  .forehead { --accent: var(--c-forehead); min-height: 100dvh; }
</style>
