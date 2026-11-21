<script lang="ts">
  // Spectrum: routes between setup, "make a pack" (#/dial/make), a pack's cards (#/dial/pack?id=…)
  // and the saved game's phase.
  // Every step goes through `set`, which saves, so a reload resumes exactly here.
  import Setup from './Setup.svelte';
  import Make from './Make.svelte';
  import PackEditor from './PackEditor.svelte';
  import Handoff from './Handoff.svelte';
  import ReaderView from './ReaderView.svelte';
  import TeamView from './TeamView.svelte';
  import StealView from './StealView.svelte';
  import Reveal from './Reveal.svelte';
  import Win from './Win.svelte';
  import { route, go, back } from '../../lib/router.svelte';
  import { unlockAudio } from '../../lib/sound';
  import { keepAwake } from '../../lib/wakelock';
  import { drawCard } from './deck';
  import { nextTarget } from './targets';
  import { clearGame, loadConfig, loadGame, saveGame } from './persist';
  import { demoGame, demoItems } from './demo';
  import { summarize, summarizeEarly } from './summary';
  import { record } from '../../lib/history';
  import { spectrumPacks } from '../../lib/content';
  import {
    beginRound, callSide, lockIn, markRevealed, newGame, nextTurn, redraw, rematch, setClue, setGuess, showTeam,
    type Config, type Game,
  } from './state';

  const sub = $derived(route.path.split('/').filter(Boolean)[1] ?? '');
  const demo = route.params.get('demo');

  let game = $state.raw<Game | null>(demo ? demoGame(demo) : loadGame());
  // Not saved on purpose: after a reload the reader passes a gate again before the target shows.
  let readerOpen = $state(demo === 'reader');

  function set(g: Game | null) {
    game = g;
    if (demo) return;
    if (g) saveGame(g);
    else clearGame();
  }

  $effect(() => {
    keepAwake(!!game && sub !== 'make');
    return () => keepAwake(false);
  });

  let unlocked = false;
  function firstTouch() {
    if (unlocked) return;
    unlocked = true;
    unlockAudio();
  }

  function start(cfg: Config) {
    unlockAudio();
    set(newGame(cfg));
  }

  function openReader(g: Game) {
    const card = drawCard(g.packIds, g.played);
    if (!card) return;
    set(beginRound(g, card, nextTarget()));
    readerOpen = true;
  }

  function newCard(g: Game) {
    const card = drawCard(g.packIds, g.played);
    if (card) set(redraw(g, card));
  }

  function next(g: Game) {
    readerOpen = false;
    const n = nextTurn(g);
    set(n);
    if (n.phase === 'win' && !demo) record(summarize(n, packNames(n.packIds)));
  }

  const packNames = (ids: string[]) => spectrumPacks().filter((p) => ids.includes(p.id)).map((p) => p.name);

  const home = () => go('/');
  /** Clears a game that is over (already in History) to go back to setup. */
  const close = () => set(null);
  /**
   * The only way a game in progress is thrown away ("End game" in the menu): it goes in History
   * as ended early when at least one result was shown. Pausing to go home keeps it saved instead.
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

<div class="dial-game">
  <div class="glow" aria-hidden="true"></div>
  {#if sub === 'make'}
    <Make initial={demo === 'triage' ? demoItems : []} onback={() => back('/dial')} onuse={() => go('/dial', true)} />
  {:else if sub === 'pack'}
    {#key route.params.get('id')}
      <PackEditor id={route.params.get('id') ?? ''} onback={() => back('/dial')} />
    {/key}
  {:else if !game}
    <Setup config={loadConfig()} onstart={start} onmake={() => go('/dial/make')} />
  {:else if game.phase === 'handoff'}
    {@const g = game}
    {#key g.roundNo}
      <Handoff
        game={g}
        team={g.active}
        kicker="Round {g.roundNo + 1} · your turn"
        steps={[
          { icon: 'phone', text: 'Pick a reader. Hand them the phone.' },
          { icon: 'hide', text: 'Everyone else: eyes off the screen.' },
        ]}
        button="I'm the reader · show me"
        onready={() => openReader(g)}
        onclose={home}
      />
    {/key}
  {:else if game.phase === 'reader' && game.round}
    {@const g = game}
    {@const r = game.round}
    {#if !readerOpen}
      <Handoff
        game={g}
        team={g.active}
        kicker="Round {g.roundNo} · reader only"
        steps={[
          { icon: 'eye', text: 'Only the reader looks at the next screen.' },
          { icon: 'hide', text: 'Everyone else: look away now.' },
        ]}
        button="I'm the reader · show me"
        onready={() => (readerOpen = true)}
        onclose={home}
      />
    {:else}
      <ReaderView game={g} round={r} onredraw={() => newCard(g)} onclue={(c) => set(setClue(game!, c))}
        onhide={() => set(showTeam(game!))} onhome={home} onend={end} />
    {/if}
  {:else if game.phase === 'team' && game.round}
    {@const g = game}
    <TeamView game={g} round={g.round!} onguess={(v) => set(setGuess(game!, v))} onlock={(v) => set(lockIn(game!, v))} onhome={home} onend={end} />
  {:else if game.phase === 'steal' && game.round}
    {@const g = game}
    <StealView game={g} round={g.round!} oncall={(s) => set(callSide(g, s))} onhome={home} onend={end} />
  {:else if game.phase === 'reveal' && game.round}
    {@const g = game}
    <Reveal game={g} round={g.round!} onrevealed={() => set(markRevealed(game!))} onnext={() => next(game!)} onhome={home} onend={end} />
  {:else if game.phase === 'win'}
    {@const g = game}
    <Win game={g} onrematch={() => set(rematch(g))} onsetup={close} onhome={() => { close(); home(); }} />
  {/if}
</div>

<style>
  .dial-game { --accent: var(--c-dial); }
  /* The page glow in this game's colour (the body's own glow uses the global accent). */
  .glow {
    position: fixed; inset: 0; z-index: -1; pointer-events: none;
    background:
      radial-gradient(120% 60% at 50% -10%, color-mix(in srgb, var(--c-dial) 16%, transparent), transparent 70%),
      var(--bg);
  }
</style>
