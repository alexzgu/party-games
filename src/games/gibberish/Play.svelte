<script lang="ts">
  import { onMount } from 'svelte';
  import Handoff from './Handoff.svelte';
  import Card from './Card.svelte';
  import Reveal from './Reveal.svelte';
  import Win from './Win.svelte';
  import TapToFinish from './TapToFinish.svelte';
  import { makeDealer } from './deal';
  import { unlockAudio, sfx } from '../../lib/sound';
  import { haptic } from '../../lib/haptics';
  import { keepAwake } from '../../lib/wakelock';
  import { record } from '../../lib/history';
  import { gibberishPacks } from '../../lib/content';
  import * as rules from './logic';
  import type { GameState } from './logic';

  // Runs a game from hand-off to win. Every step goes through `commit`, which saves it.
  let {
    game,
    commit,
    onleave,
    onhome,
    demo = '',
  }: {
    game: GameState;
    commit: (next: GameState) => void;
    onleave: () => void;
    onhome: () => void;
    demo?: string;
  } = $props();

  // svelte-ignore state_referenced_locally
  const dealer = makeDealer(game.packIds);
  // A card already on screen when this view opens means a reload or a resume: start paused.
  // Any later step clears it, so a skipped card after that starts running.
  // svelte-ignore state_referenced_locally
  let startPaused = $state(game.phase === 'card' && !demo.startsWith('card'));
  let error = $state('');

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
    const card = dealer.next(game.dealt);
    if (!card) {
      error = 'The chosen packs have no cards. Go back and pick a pack.';
      return;
    }
    error = '';
    sfx.go();
    step(rules.showCard(game, card));
  }

  function skip() {
    const card = dealer.next(game.dealt);
    if (card) step(rules.showCard(game, card));
  }

  function award(i: number) {
    unlockAudio();
    sfx.correct();
    setTimeout(() => sfx.reveal(), 260);
    haptic.correct();
    step(rules.award(game, i));
  }

  function nobody() {
    sfx.pass();
    haptic.pass();
    step(rules.noPoint(game, 'nobody'));
  }

  function next() {
    const n = rules.next(game);
    if (n.phase === 'win') {
      sfx.win();
      haptic.end();
      if (!demo) record(rules.gameRecord(n, gibberishPacks().filter((p) => n.packIds.includes(p.id)).map((p) => p.name)));
    }
    step(n);
  }
</script>

{#if game.phase === 'handoff'}
  <TapToFinish><Handoff {game} onbegin={begin} {onleave} {error} /></TapToFinish>
{:else if game.phase === 'card'}
  {#key game.card}
    <Card
      {game}
      {startPaused}
      showCategory={demo === 'card-category'}
      peek={demo === 'card-peek'}
      onaward={award}
      onnobody={nobody}
      ontimeout={() => step(rules.noPoint(game, 'timeout'))}
      onskip={skip}
      {onleave}
      ontick={(ms) => step(rules.tickTimer(game, ms))}
    />
  {/key}
{:else if game.phase === 'reveal'}
  <TapToFinish><Reveal {game} onnext={next} onundo={() => step(rules.undo(game))} {onleave} /></TapToFinish>
{:else}
  <TapToFinish><Win {game} onrematch={() => step(rules.rematch(game))} onnew={onleave} {onhome} /></TapToFinish>
{/if}
