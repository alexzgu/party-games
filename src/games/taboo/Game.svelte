<script lang="ts">
  // Don't Say It: routes between setup, a pack's cards (#/taboo/pack?id=…), a new pack
  // (#/taboo/new) and the saved game's phase. Every step goes through `set`, which saves,
  // so a reload resumes exactly here (a turn in progress resumes paused).
  import Setup from './Setup.svelte';
  import PackEditor from './PackEditor.svelte';
  import Handoff from './Handoff.svelte';
  import Turn from './Turn.svelte';
  import Summary from './Summary.svelte';
  import Scores from './Scores.svelte';
  import Win from './Win.svelte';
  import TapToFinish from './TapToFinish.svelte';
  import { route, go, back } from '../../lib/router.svelte';
  import { sfx, unlockAudio } from '../../lib/sound';
  import { keepAwake } from '../../lib/wakelock';
  import { record } from '../../lib/history';
  import { tabooPacks } from '../../lib/content';
  import { drawCard } from './deck';
  import { clearGame, loadConfig, loadGame, saveGame } from './persist';
  import { demoGame } from './demo';
  import { summarize, summarizeEarly } from './summary';
  import { finishTurn, fixMark, markCard, newGame, nextTurn, rematch, startTurn, tick, timeUp, type Config, type Game, type Mark } from './state';

  const sub = $derived(route.path.split('/').filter(Boolean)[1] ?? '');
  const demo = route.params.get('demo');

  let game = $state.raw<Game | null>(demo ? demoGame(demo) : loadGame());
  // A turn already running when the page opens is a reload or a return: it starts paused.
  // Only that one turn; later turns start running.
  // svelte-ignore state_referenced_locally
  let resumedTurn = $state(game?.phase === 'turn' && !demo);
  let error = $state('');

  function set(g: Game | null) {
    game = g;
    if (g?.phase !== 'turn') resumedTurn = false;
    if (demo) return;
    if (g) saveGame(g);
    else clearGame();
  }

  $effect(() => {
    keepAwake(!!game && sub === '');
    return () => keepAwake(false);
  });

  let unlocked = false;
  function firstTouch() {
    if (unlocked) return;
    unlocked = true;
    unlockAudio();
  }

  const packNames = (ids: string[]) => tabooPacks().filter((p) => ids.includes(p.id)).map((p) => p.name);

  function start(cfg: Config) {
    unlockAudio();
    set(newGame(cfg));
  }

  function begin(g: Game) {
    unlockAudio();
    const card = drawCard(g.packIds, g.played);
    if (!card) {
      error = 'Every card in the chosen packs has been played this game. End the game to pick more packs.';
      return;
    }
    error = '';
    sfx.go();
    set(startTurn(g, card));
  }

  function mark(m: Exclude<Mark, 'time'>) {
    const g = game!;
    set(markCard(g, m, drawCard(g.packIds, g.played)));
  }

  function done(g: Game) {
    const n = finishTurn(g);
    set(n);
    if (n.phase === 'win' && !demo) record(summarize(n, packNames(n.packIds)));
  }

  const home = () => go('/');
  /** Clears a game that is over (already in History) to go back to setup. */
  const close = () => set(null);
  /**
   * The only way a game in progress is thrown away ("End game" in the menu): it goes in History
   * as ended early once a card has been marked. Pausing to go home keeps it saved instead.
   */
  function end() {
    const g = game;
    if (!g) return;
    const early = demo ? null : summarizeEarly(g, packNames(g.packIds));
    if (early) record(early);
    set(null);
  }
</script>

<svelte:window onpointerdown={firstTouch} />

<div class="taboo-game">
  {#if sub === 'pack' || sub === 'new'}
    {#key route.params.get('id')}
      <PackEditor id={sub === 'new' ? null : (route.params.get('id') ?? '')} onback={() => back('/taboo')} />
    {/key}
  {:else if !game}
    <Setup config={loadConfig()} onstart={start} />
  {:else if game.phase === 'handoff'}
    {@const g = game}
    {#key g.turns.length}
      <TapToFinish><Handoff game={g} {error} onstart={() => begin(g)} onhome={home} onend={end} /></TapToFinish>
    {/key}
  {:else if game.phase === 'turn'}
    {#key game.turns.length}
      <Turn game={game} startPaused={resumedTurn} onmark={mark} ontimeup={() => set(timeUp(game!))} ontick={(ms) => set(tick(game!, ms))} onhome={home} onend={end} />
    {/key}
  {:else if game.phase === 'summary'}
    {@const g = game}
    <TapToFinish><Summary game={g} onfix={(i) => set(fixMark(game!, i))} ondone={() => done(game!)} onhome={home} onend={end} /></TapToFinish>
  {:else if game.phase === 'scores'}
    {@const g = game}
    <TapToFinish><Scores game={g} onnext={() => set(nextTurn(g))} onhome={home} onend={end} /></TapToFinish>
  {:else if game.phase === 'win'}
    {@const g = game}
    <TapToFinish><Win game={g} onrematch={() => set(rematch(g))} onsetup={close} onhome={() => { close(); home(); }} /></TapToFinish>
  {/if}
</div>

<style>
  .taboo-game { --accent: var(--c-taboo); }
</style>
