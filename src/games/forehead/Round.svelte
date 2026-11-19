<script lang="ts">
  import Ready from './Ready.svelte';
  import Play from './Play.svelte';
  import Results from './Results.svelte';
  import { back, go } from '../../lib/router.svelte';
  import { score, type EndReason, type Round } from './round';
  import { deckLabel, game, prefs, recordScore, selectedDecks, setRound } from './state.svelte';
  import { releaseDevice, startRound } from './flow';

  // The round itself: get ready → play → results, driven by the saved round's phase so a
  // reload lands back on the same step.
  let { demo = null, rotation }: { demo?: string | null; rotation?: number } = $props();

  /** True once this screen ran the countdown; otherwise Play opens paused (reload or return). */
  let fresh = $state(false);
  const r = $derived(game.round);

  $effect(() => {
    if (!game.round) go('/forehead', true);
  });
  $effect(() => () => releaseDevice());

  function begin() {
    fresh = true;
    setRound({ ...game.round!, phase: 'play' });
  }

  function cancel() {
    setRound(null);
    releaseDevice();
    back('/forehead');
  }

  function ended(fin: Round) {
    fresh = false;
    setRound(fin);
    recordScore({ id: fin.id, score: score(fin.shown), total: fin.shown.length, decks: deckLabel(selectedDecks(fin.deckIds)) });
    releaseDevice();
  }

  function again() {
    const last = game.round!;
    startRound(last.deckIds, last.seconds, prefs.control, true);
  }

  const demoPlay = $derived.by(() => {
    const ending: Record<string, EndReason> = { timesup: 'time', out: 'out' };
    return demo && demo !== 'play'
      ? { flash: demo === 'flash', ending: ending[demo], pause: demo === 'pause' ? ('confirm' as const) : undefined }
      : demo ? {} : undefined;
  });
</script>

{#if r?.phase === 'ready'}
  {#key r.id}
    <Ready round={r} ongo={begin} oncancel={cancel} demoCount={demo === 'count' ? 3 : null} {rotation} />
  {/key}
{:else if r?.phase === 'play'}
  {#key r.id}
    <Play onend={ended} paused={!fresh && !demo} {rotation} demo={demoPlay} />
  {/key}
{:else if r}
  <Results round={r} onagain={again} ondecks={() => back('/forehead')} onhome={() => go('/')} />
{/if}
