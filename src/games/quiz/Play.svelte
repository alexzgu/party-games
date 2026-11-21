<script lang="ts">
  import { onMount } from 'svelte';
  import Board from './Board.svelte';
  import Clue from './Clue.svelte';
  import Win from './Win.svelte';
  import Strip from './Strip.svelte';
  import FixScore from './FixScore.svelte';
  import Timer from './Timer.svelte';
  import { timer } from './timer.svelte';
  import TapToFinish from './TapToFinish.svelte';
  import { sfx, unlockAudio } from '../../lib/sound';
  import { haptic } from '../../lib/haptics';
  import { keepAwake } from '../../lib/wakelock';
  import { record } from '../../lib/history';
  import * as rules from './logic';
  import type { Game } from './logic';

  // Runs a game from the board to the win screen. Every step goes through `commit`, which saves
  // it, so a reload resumes on the same screen. The win (or an early end with points on the
  // board) is written to History exactly once, at the moment the game moves to its win screen.
  let { game, commit, onleave, onnew, onhome, demo = '' }: {
    game: Game;
    commit: (next: Game) => void;
    onleave: () => void;
    /** Throw the game away and go back to setup (only once it is over or held nothing). */
    onnew: () => void;
    onhome: () => void;
    demo?: string;
  } = $props();

  let fixing = $state(-1);
  let flash = $state<{ team: number; delta: number; n: number } | null>(null);
  let flashes = 0;
  const pop = (team: number, delta: number) => (flash = { team, delta, n: ++flashes });

  onMount(() => {
    keepAwake(true);
    return () => keepAwake(false);
  });

  function open(tile: number) {
    unlockAudio();
    sfx.go();
    haptic.light();
    commit(rules.openTile(game, tile));
  }

  function answer() {
    sfx.reveal();
    commit(rules.showAnswer(game));
  }

  function wrong(team: number) {
    const value = rules.tileValue(game, game.open!.tile);
    const marking = !game.open!.wrong.includes(team);
    if (marking) { sfx.pass(); haptic.pass(); } else sfx.tap();
    commit(rules.toggleWrong(game, team));
    pop(team, marking ? -value : value);
  }

  function award(team: number) {
    const value = rules.tileValue(game, game.open!.tile);
    const next = rules.award(game, team);
    if (next === game) return;
    if (team >= 0) { sfx.correct(); haptic.correct(); } else { sfx.pass(); haptic.pass(); }
    commit(next);
    if (team >= 0) pop(team, value);
    else if (rules.solo(game) && game.penalty) pop(0, -value); // a solo miss costs the tile
  }

  function undo() {
    const last = game.log.at(-1);
    if (!last) return;
    sfx.tap();
    commit(rules.undo(game));
    if (last.kind === 'adjust') pop(last.team, -last.delta);
    else if (last.winner >= 0) pop(last.winner, -rules.tileValue(game, last.tile));
    else if (rules.solo(game) && last.wrong.length) pop(0, rules.tileValue(game, last.tile));
  }

  function adjust(delta: number) {
    sfx.tick();
    commit(rules.adjust(game, fixing, delta));
    pop(fixing, delta);
  }

  /** Board cleared (`early` false) or ended by the host. Nothing scored and ended: just close it. */
  function end(early: boolean) {
    if (early && !rules.anyScored(game)) { onnew(); return; }
    const n = rules.finish(game, early);
    if (!demo) record(rules.gameRecord(n));
    sfx.win();
    haptic.end();
    commit(n);
  }
</script>

<!-- Many teams on a clue (more so with ✗ marks) can outgrow an upright phone screen: there the
     page scrolls. The timer, unless the host dragged it away, sits in its own place under the
     scores, so it never covers a tile, a clue or a button. -->
<div class="play" class:over={game.phase === 'win'} class:tall={game.phase !== 'board' && game.teams.length > 8}>
  <TapToFinish>
    {#if game.phase === 'win'}
      <Win {game} {onnew} {onhome} />
    {:else}
      <div class="main">
        {#if game.phase === 'board'}
          <Board {game} onopen={open} onundo={undo} onend={() => end(true)} onwin={() => end(false)} {onleave} />
        {:else}
          {#key game.open?.tile}
            <Clue {game} onanswer={answer} onaward={award} onwrong={wrong} onback={() => commit(rules.closeTile(game))} />
          {/key}
        {/if}
      </div>
      <div class="side"><Strip {game} {flash} onfix={(t) => (fixing = t)} /></div>
    {/if}
  </TapToFinish>
  {#if timer.shown && game.phase !== 'win'}
    <Timer clue={game.open?.tile ?? null} />
  {/if}
</div>
{#if fixing >= 0 && game.phase !== 'win'}
  <FixScore {game} team={fixing} onadjust={adjust} onclose={() => (fixing = -1)} />
{/if}

<style>
  .play {
    height: 100dvh; display: flex; flex-direction: column; gap: clamp(8px, 1.4vmin, 18px);
    padding: calc(var(--safe-top) + clamp(8px, 1.4vmin, 20px)) calc(var(--safe-right) + clamp(8px, 1.6vmin, 28px))
      calc(var(--safe-bottom) + clamp(8px, 1.4vmin, 20px)) calc(var(--safe-left) + clamp(8px, 1.6vmin, 28px));
    -webkit-user-select: none; user-select: none;
  }
  .play.over { height: auto; min-height: 100dvh; }
  .main, .side { display: contents; }
  .play > :global(.docked) { align-self: center; }
  @media (max-width: 699px) { .play.tall { height: auto; min-height: 100dvh; } }
  /* Short and wide but not a phone on its side: the page grows and scrolls. */
  @media (max-height: 560px) { .play { height: auto; min-height: 100dvh; } }
  /* A phone on its side: the board or the clue on the left at full height; the scores down the
     right, with the timer's place under them. */
  @media (orientation: landscape) and (max-height: 500px) {
    .play, .play.tall {
      height: 100dvh; display: grid; grid-template-columns: minmax(0, 1fr) clamp(236px, 28vw, 300px);
      grid-template-rows: minmax(0, 1fr) auto;
    }
    .play.over { display: flex; height: auto; }
    .main { display: flex; flex-direction: column; grid-column: 1; grid-row: 1 / -1; min-height: 0; min-width: 0; }
    .side { display: flex; flex-direction: column; grid-column: 2; grid-row: 1; min-height: 0; overflow-y: auto; }
    .play > :global(.docked) { grid-column: 2; grid-row: 2; justify-self: center; }
  }
</style>
