<script lang="ts">
  import { onMount } from 'svelte';
  import Handoff from './Handoff.svelte';
  import Turn from './Turn.svelte';
  import Steal from './Steal.svelte';
  import Win from './Win.svelte';
  import TapToFinish from './TapToFinish.svelte';
  import { makeDealer, packNames } from './deal';
  import { unlockAudio, sfx } from '../../lib/sound';
  import { haptic } from '../../lib/haptics';
  import { keepAwake } from '../../lib/wakelock';
  import { record } from '../../lib/history';
  import * as rules from './logic';
  import type { GameState } from './logic';

  // Runs a game from the first hand-off to the win. Every step goes through `commit`, which saves it.
  let { game, commit, onleave, onhome, demo = '' }: {
    game: GameState;
    commit: (next: GameState) => void;
    onleave: () => void;
    onhome: () => void;
    demo?: string;
  } = $props();

  // svelte-ignore state_referenced_locally
  const dealer = makeDealer(game.packIds);
  // A clock already running when this view opens means a reload or a resume: start paused.
  // Any later step clears it.
  // svelte-ignore state_referenced_locally
  let startPaused = $state(game.phase === 'live' && (!demo || demo === 'paused'));
  let error = $state('');
  /** Every prompt was played this game: the next one starts them over (said on the hand-off). */
  const usedUp = $derived(game.phase === 'handoff' && dealer.usedUp(game.dealt));

  function step(next: GameState) {
    startPaused = false;
    commit(next);
  }

  onMount(() => {
    keepAwake(true);
    return () => keepAwake(false);
  });

  function begin() {
    unlockAudio();
    const g = usedUp ? rules.reshuffle(game) : game;
    const prompt = dealer.next(g.dealt);
    if (!prompt) {
      error = 'The chosen packs have no prompts. Go back and pick a pack.';
      return;
    }
    error = '';
    sfx.go();
    step(rules.reveal(g, prompt));
  }

  function stealGo() {
    unlockAudio();
    sfx.go();
    step(rules.startSteal(game));
  }

  function judged(got: boolean) {
    if (got) { sfx.correct(); haptic.correct(); } else { sfx.pass(); haptic.pass(); }
    step(rules.judge(game, got));
  }

  function toWin() {
    const n = rules.finish(game);
    sfx.win();
    haptic.end();
    if (!demo) record(rules.gameRecord(n, packNames(n.packIds)));
    step(n);
  }
</script>

{#if game.phase === 'handoff'}
  <TapToFinish><Handoff {game} onbegin={begin} onwin={toWin} onundo={() => step(rules.undo(game))} {onleave} {error} notice={usedUp ? 'Every prompt in these packs has been played. They come round again, shuffled.' : ''} /></TapToFinish>
{:else if game.phase === 'live' || game.phase === 'judge'}
  {#key `${game.prompt}|${game.actor}|${game.stealing}`}
    <Turn
      {game}
      {startPaused}
      frozen={!!demo}
      onjudge={judged}
      ontimeup={() => step(rules.timeUp(game))}
      ontick={(ms) => step(rules.tickTimer(game, ms))}
      {onleave}
    />
  {/key}
{:else if game.phase === 'steal'}
  <TapToFinish><Steal {game} onbegin={stealGo} onundo={() => step(rules.undo(game))} {onleave} /></TapToFinish>
{:else}
  <TapToFinish><Win {game} onrematch={() => step(rules.rematch(game))} onnew={onleave} {onhome} /></TapToFinish>
{/if}
