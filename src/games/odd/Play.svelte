<script lang="ts">
  import { onMount } from 'svelte';
  import Handoff from './Handoff.svelte';
  import Secret from './Secret.svelte';
  import Clues from './Clues.svelte';
  import Vote from './Vote.svelte';
  import Reveal from './Reveal.svelte';
  import Scores from './Scores.svelte';
  import Win from './Win.svelte';
  import { nextWord, packNames } from './deal';
  import { setupPicks } from './store';
  import { sfx, unlockAudio } from '../../lib/sound';
  import { haptic } from '../../lib/haptics';
  import { keepAwake } from '../../lib/wakelock';
  import { record } from '../../lib/history';
  import * as rules from './logic';
  import type { GameState } from './logic';

  // Runs a game from the first hand-off to the win. Every step goes through `commit`, which saves
  // it. Whether a secret is on screen lives here only, never in the saved game, so a reload
  // always lands on a hand-off.
  let { game, commit, onleave, onhome, demo = '' }: {
    game: GameState;
    commit: (next: GameState) => void;
    onleave: () => void;
    onhome: () => void;
    demo?: string;
  } = $props();

  // svelte-ignore state_referenced_locally
  let showing = $state(demo.startsWith('secret'));
  let error = $state('');

  onMount(() => {
    keepAwake(true);
    return () => keepAwake(false);
  });

  function show() {
    unlockAudio();
    sfx.tap();
    haptic.light();
    showing = true;
  }

  function hideSecret() {
    showing = false;
    commit(rules.hide(game));
  }

  function passBack() {
    const prev = rules.passBack(game);
    if (prev) commit(prev);
    else onleave();
  }

  function picked(seat: number) {
    sfx.reveal();
    haptic.light();
    commit(rules.vote(game, seat));
  }

  function settle(guessed: boolean | null) {
    if (guessed === true || (guessed === null && !rules.caught(game.round))) { sfx.correct(); haptic.correct(); } else { sfx.pass(); haptic.pass(); }
    const next = rules.settle(game, guessed);
    if (next.phase === 'win') win(next);
    else commit(next);
  }

  function win(next: GameState) {
    sfx.win();
    haptic.end();
    if (!demo) record(rules.gameRecord(next, packNames(next.packIds)));
    commit(next);
  }

  /**
   * A new word into `step`: from the game's packs, or, once those are gone, from the setup's
   * current picks, which become the game's packs. Only when both are empty is there nothing to deal.
   */
  function withWord(step: (s: GameState, secret: rules.Secret) => GameState) {
    const next = nextWord(game, setupPicks());
    if (!next) { error = 'These packs are gone. Start a new game.'; return; }
    error = '';
    unlockAudio();
    sfx.go();
    commit(step({ ...game, packIds: next.packIds }, next.secret));
  }
</script>

{#if game.phase === 'pass'}
  {#if showing}
    <Secret secret={rules.secretFor(game, game.seat)} name={game.players[game.seat].name} onhide={hideSecret} onback={() => (showing = false)} />
  {:else}
    <Handoff {game} onshow={show} onback={passBack} />
  {/if}
{:else if game.phase === 'clues'}
  <Clues {game} onvote={() => commit(rules.toVote(game))} {onleave} />
{:else if game.phase === 'vote'}
  <Vote {game} onpick={picked} {onleave} />
{:else if game.phase === 'reveal'}
  <Reveal {game} onshow={() => { sfx.reveal(); commit(rules.showWord(game)); }} onsettle={settle} {onleave} />
{:else if game.phase === 'scores'}
  <Scores {game} {error} onnext={() => withWord(rules.nextRound)} {onleave} />
{:else}
  <Win {game} {error} onagain={() => withWord(rules.rematch)} onsetup={onleave} {onhome} />
{/if}
