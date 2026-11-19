<script lang="ts">
  import { onMount } from 'svelte';
  import Stage from './Stage.svelte';
  import Ready from './Ready.svelte';
  import Listen from './Listen.svelte';
  import Reveal from './Reveal.svelte';
  import Scores from './Scores.svelte';
  import Win from './Win.svelte';
  import TapToFinish from './TapToFinish.svelte';
  import { makeDealer, packNames } from './deal';
  import { Clip, PERMANENT_ERRORS, type ClipStatus } from './clip';
  import { loadYouTube, makePlayer } from './youtube';
  import { loadBroken, markBroken } from './store';
  import { unlockAudio, sfx } from '../../lib/sound';
  import { haptic } from '../../lib/haptics';
  import { keepAwake } from '../../lib/wakelock';
  import { record } from '../../lib/history';
  import type { Song } from '../../lib/content';
  import * as rules from './logic';
  import type { GameState } from './logic';

  // Runs a game from the first Play to the win. Every step goes through `step`, which saves it.
  // One YouTube player lives here for the whole game (Stage); the screens only drive it.
  let { game, commit, onleave, onhome, demo = '', demoStatus = 'cued' }: {
    game: GameState;
    commit: (next: GameState) => void;
    onleave: () => void;
    onhome: () => void;
    demo?: string;
    demoStatus?: ClipStatus;
  } = $props();

  /** Seconds the reveal lets the video play on. */
  const PAYOFF_S = 8;
  /** How long YouTube may take to load before the game says it cannot reach it. */
  const READY_TIMEOUT_MS = 20000;

  // svelte-ignore state_referenced_locally
  const dealer = makeDealer(game.packIds, loadBroken());
  // svelte-ignore state_referenced_locally
  let status = $state<ClipStatus>(demo ? demoStatus : 'idle');
  // svelte-ignore state_referenced_locally
  let progress = $state(demo ? 0.4 : 0);
  // svelte-ignore state_referenced_locally
  let problem = $state<'' | 'offline' | 'failed'>(demo === 'ready-offline' ? 'offline' : '');
  let note = $state('');
  let clip = $state<Clip | null>(null);

  // `game` is the parent's state: after commit it reads the new value at once.
  const step = (next: GameState) => commit(next);

  onMount(() => {
    keepAwake(true);
    if (!game.song && game.phase === 'ready') step(rules.replaceSong(game, dealer.next(game.dealt)));
    return () => { clip?.dispose(); keepAwake(false); };
  });

  async function connect(host: HTMLElement) {
    const slow = setTimeout(() => { if (!clip) problem = navigator.onLine ? 'failed' : 'offline'; }, READY_TIMEOUT_MS);
    try {
      const YT = await loadYouTube();
      const player = await makePlayer(YT, host, { onError: (code) => clip?.fail(code), onState: () => clip?.changed() });
      clip = new Clip(player, { status: onStatus, progress: (f) => (progress = f), error: onError });
      problem = '';
      cueForPhase();
    } catch {
      problem = navigator.onLine ? 'failed' : 'offline';
    } finally {
      clearTimeout(slow);
    }
  }

  const cue = (s: Song | null, offset = 0) => { if (s && clip) clip.cue(s.youtube, s.start + offset); };

  /** After a load or reload: the player gets whatever the current screen needs next. */
  function cueForPhase() {
    if (game.phase === 'ready' || game.phase === 'listen') cue(game.song);
    else if (game.phase === 'reveal') cue(game.song, rules.clipSeconds(game));
    else if (game.phase === 'scores') cue(game.upcoming);
  }

  function onStatus(s: ClipStatus) {
    status = s;
    // The reveal video ended (or was skipped): load the next song while the room cheers.
    if (s === 'done' && game.phase === 'reveal') cue(game.upcoming);
  }

  /** YouTube would not play a song: never deal it again, swap in another, no penalty. */
  function onError(code: number, id: string) {
    console.warn(`Earworm: YouTube error ${code} for video ${id}; skipped.`);
    if (PERMANENT_ERRORS.includes(code)) markBroken(id);
    dealer.drop(id);
    if (id === game.upcoming?.youtube && game.phase !== 'ready' && game.phase !== 'listen') {
      step(rules.replaceUpcoming(game, dealer.next(game.dealt)));
      if (game.phase === 'scores') cue(game.upcoming);
      return;
    }
    if (id !== game.song?.youtube || (game.phase !== 'ready' && game.phase !== 'listen')) return;
    const was = game.phase;
    step(rules.replaceSong(game, dealer.next(game.dealt), true));
    note = game.song ? 'YouTube wouldn’t play that one, so here’s another.' : 'No more songs that play here. Pick other packs.';
    cue(game.song);
    // The room is waiting: carry on with the new song at once.
    if (was === 'listen' && game.song) clip?.play(rules.clipSeconds(game));
  }

  function play() {
    unlockAudio();
    note = '';
    clip?.play(rules.CLIPS[0]);
    step(rules.listen(game));
  }

  function again() {
    note = '';
    clip?.play(rules.clipSeconds(game));
  }

  function longer() {
    note = '';
    const n = rules.longer(game);
    clip?.play(rules.clipSeconds(n));
    step(n);
  }

  function reveal(next: GameState) {
    clip?.payoff(PAYOFF_S);
    step(rules.setUpcoming(next, game.upcoming ?? dealer.next(next.dealt)));
  }

  function award(i: number) {
    haptic.correct();
    sfx.correct();
    reveal(rules.award(game, i));
  }

  function nobody() {
    haptic.pass();
    reveal(rules.nobody(game));
  }

  function skipSong() {
    const s = dealer.next(game.dealt);
    if (!s) { note = 'No other songs in these packs.'; return; }
    note = '';
    clip?.stop();
    step(rules.replaceSong(game, s));
    cue(s);
  }

  function next() {
    if (game.phase === 'reveal') clip?.stop();
    const n = rules.next(game);
    if (n.phase === 'win') {
      sfx.win();
      haptic.end();
      if (!demo) record(rules.gameRecord(n, packNames(n.packIds)));
    }
    step(n);
    if (n.phase === 'ready' && clip?.videoId !== n.song?.youtube) cue(n.song);
    if (n.phase === 'ready' && !n.song) step(rules.replaceSong(n, dealer.next(n.dealt)));
  }

  function undo() {
    clip?.stop();
    step(rules.undo(game));
    cue(game.song);
  }

  function rematch() {
    const r = rules.rematch(game);
    step(r.song ? r : rules.replaceSong(r, dealer.next(r.dealt)));
    cue(game.song);
  }

  function watch() {
    unlockAudio();
    clip?.payoff(PAYOFF_S);
  }

  function leave() {
    clip?.stop();
    onleave();
  }

  const mode = $derived(game.phase === 'listen' ? 'covered' : game.phase === 'reveal' ? 'shown' : 'hidden');
  const canPlay = $derived(!!game.song && (demo ? true : status !== 'idle' && status !== 'error' && !!clip));
</script>

<div class="game" class:live={mode !== 'hidden'}>
  <Stage {mode} {status} {progress} demo={!!demo} onhost={connect} onskip={() => clip?.stop()} onwatch={game.phase === 'reveal' ? watch : undefined} />
  {#if game.phase === 'ready'}
    <Ready {game} {canPlay} problem={problem || (game.song ? '' : 'empty')} {note} onplay={play} onretry={() => location.reload()} onleave={leave} />
  {:else if game.phase === 'listen'}
    <Listen {game} {status} {note} onagain={again} onlonger={longer} onaward={award} onnobody={nobody} onskip={skipSong} onleave={leave} />
  {:else if game.phase === 'reveal'}
    <TapToFinish><Reveal {game} onnext={next} onundo={undo} /></TapToFinish>
  {:else if game.phase === 'scores'}
    <TapToFinish><Scores {game} loading={!demo && !!game.upcoming && (status === 'idle' || clip?.videoId !== game.upcoming.youtube)} onnext={next} onleave={leave} /></TapToFinish>
  {:else}
    <TapToFinish><Win {game} onrematch={rematch} onnew={leave} {onhome} /></TapToFinish>
  {/if}
</div>

<style>
  .game { min-height: 100dvh; }
  .game.live {
    display: flex; flex-direction: column;
    max-width: 640px; margin: 0 auto; gap: var(--s-3);
    padding: calc(var(--safe-top) + var(--s-3)) calc(var(--safe-right) + var(--s-4)) 0 calc(var(--safe-left) + var(--s-4));
    -webkit-user-select: none; user-select: none;
  }
  /* Laptop or TV: the player on the left, the controls on the right. */
  @media (min-width: 900px) and (orientation: landscape) {
    .game.live { max-width: 1180px; display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(340px, 1fr); grid-template-rows: auto 1fr; column-gap: var(--s-5); align-content: start; }
    .game.live > :global(.stage) { grid-column: 1; grid-row: 1 / span 2; max-width: none; align-self: start; margin-top: var(--s-2); }
  }
</style>
