<script lang="ts">
  import { onMount } from 'svelte';
  import Handoff from './Handoff.svelte';
  import Secret from './Secret.svelte';
  import Clues from './Clues.svelte';
  import Vote from './Vote.svelte';
  import Reveal from './Reveal.svelte';
  import Scores from './Scores.svelte';
  import Win from './Win.svelte';
  import { makeDealer, packNames, pickedDecks } from './deal';
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
  const deal = makeDealer(pickedDecks(game.packIds));
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

  /** A new word from the picked packs into `step`, or a note when the packs have none left. */
  function withWord(step: (s: rules.Secret) => GameState) {
    const secret = deal(game.used);
    if (!secret) { error = 'The picked packs have no words now. Go back and pick a pack.'; return; }
    error = '';
    unlockAudio();
    sfx.go();
    commit(step(secret));
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
  <Scores {game} {error} onnext={() => withWord((s) => rules.nextRound(game, s))} {onleave} />
{:else}
  <Win {game} {error} onagain={() => withWord((s) => rules.rematch(game, s))} onsetup={onleave} {onhome} />
{/if}
