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
  import { ClipPlayer, unlockMusic, type Prepared } from './audio';
  import { lookupMany, NetError } from './itunes';
  import { pendingPreview, preparePreview } from './previews';
  import { sfx } from '../../lib/sound';
  import { haptic } from '../../lib/haptics';
  import { keepAwake } from '../../lib/wakelock';
  import { record } from '../../lib/history';
  import type { Song } from '../../lib/content';
  import type { Track } from './match';
  import * as rules from './logic';
  import type { GameState } from './logic';
  import type { ClipStatus } from './ui';

  // Runs a game from the first Play to the win. Every step goes through `step`, which saves it.
  // At the start every song's preview link is looked up in a few batched calls; each song's
  // preview is then downloaded and decoded just before it is needed (the next one during the
  // reveal), so Play answers at once.
  let { game, commit, onleave, onhome, demo = '', demoStatus = 'ready', demoTrack = null }: {
    game: GameState;
    commit: (next: GameState) => void;
    onleave: () => void;
    onhome: () => void;
    demo?: string;
    demoStatus?: ClipStatus;
    demoTrack?: Track | null;
  } = $props();

  /** Seconds of the song the reveal plays, from the clip's start. */
  const PAYOFF_S = 10;

  // svelte-ignore state_referenced_locally
  const dealer = makeDealer(game.packIds);
  const player = new ClipPlayer();
  // svelte-ignore state_referenced_locally
  let status = $state<ClipStatus>(demo ? demoStatus : 'loading');
  // svelte-ignore state_referenced_locally
  let progress = $state(demo ? 0.4 : 0);
  // svelte-ignore state_referenced_locally
  let net = $state<'looking' | 'ok' | 'offline' | 'failed'>(demo === 'ready-offline' ? 'offline' : demo ? 'ok' : 'looking');
  let note = $state('');
  let current = $state<Prepared | null>(null);
  // svelte-ignore state_referenced_locally
  let payoff = $state(demo === 'reveal');
  const tracks = new Map<number, Track | null>();
  const preps = new Map<number, Promise<Prepared | null>>();
  let preloadFailed = $state(false);
  /** The upcoming song whose preview is loaded and ready. */
  let readyNext = $state(0);

  // `game` is the parent's state: after commit it reads the new value at once.
  const step = (next: GameState) => commit(next);

  onMount(() => {
    keepAwake(true);
    if (!demo) void connect();
    return () => { player.stop(); keepAwake(false); };
  });

  /** Looks up every song in the chosen packs (batched), then loads the current one. */
  async function connect() {
    net = 'looking';
    try {
      const found = await lookupMany(dealer.appleIds());
      for (const [id, t] of found) {
        tracks.set(id, t);
        if (!t?.preview) dealer.drop(String(id));
      }
      net = 'ok';
      if (!game.song && game.phase === 'ready') step(rules.replaceSong(game, dealer.next(game.dealt)));
      await loadForPhase();
    } catch (e) {
      net = connectionProblem(e);
    }
  }

  function connectionProblem(error: unknown) {
    return (error instanceof NetError && error.offline) || !navigator.onLine ? 'offline' : 'failed';
  }

  /** After a load or reload: whatever the current screen needs next. */
  async function loadForPhase() {
    if (game.phase === 'ready' || game.phase === 'listen' || game.phase === 'reveal') await loadCurrent();
    if (game.phase === 'reveal' || game.phase === 'scores') preload();
  }

  async function trackFor(song: Song): Promise<Track | null> {
    if (tracks.has(song.apple)) return tracks.get(song.apple) ?? null;
    const t = (await lookupMany([song.apple])).get(song.apple) ?? null;
    tracks.set(song.apple, t);
    return t;
  }

  function prep(song: Song): Promise<Prepared | null> {
    return pendingPreview(preps, song.apple, () => preparePreview(song, trackFor, async () => {
      const track = (await lookupMany([song.apple], true)).get(song.apple) ?? null;
      tracks.set(song.apple, track);
      return track;
    }));
  }

  async function loadCurrent() {
    const song = game.song;
    if (!song) return;
    if (current?.apple !== song.apple) { current = null; status = 'loading'; }
    try {
      const p = await prep(song);
      if (game.song?.apple !== song.apple) return;
      if (!p) { unplayable(song); return; }
      current = p;
      net = 'ok';
      if (status === 'loading' || status === 'error') status = 'ready';
    } catch (e) {
      if (game.song?.apple !== song.apple) return;
      status = 'error';
      net = connectionProblem(e);
    }
  }

  /** The next song's preview loads while the room cheers; one that will not load is swapped now. */
  async function preload() {
    const song = game.upcoming;
    if (!song) return;
    preloadFailed = false;
    try {
      const prepared = await prep(song);
      if (game.upcoming?.apple !== song.apple) return;
      if (prepared) {
        readyNext = song.apple;
      } else {
        dealer.drop(rules.songKey(song));
        step(rules.replaceUpcoming(game, dealer.next(game.dealt)));
        void preload();
      }
    } catch {
      if (game.upcoming?.apple === song.apple) preloadFailed = true;
    }
  }

  /** A song whose preview will not play: skipped with no penalty, another dealt at once. */
  function unplayable(song: Song) {
    console.warn(`Earworm: no playable preview for Apple track ${song.apple}; skipped.`);
    dealer.drop(rules.songKey(song));
    if (game.phase !== 'ready' && game.phase !== 'listen') return;
    step(rules.replaceSong(game, dealer.next(game.dealt), true));
    note = game.song ? 'That song wouldn’t play, so here’s another.' : 'No more songs that play here. Pick other packs.';
    void loadCurrent();
  }

  function playClip(seconds: number) {
    if (!current) return;
    note = '';
    status = 'playing';
    progress = 0;
    player.play(current.buffer, current.start, seconds, {
      progress: (f) => (progress = f),
      ended: () => (status = 'done'),
      blocked: () => (status = 'blocked'),
    });
  }

  function play() {
    unlockMusic();
    step(rules.listen(game));
    playClip(rules.CLIPS[0]);
  }

  function again() {
    unlockMusic();
    playClip(rules.clipSeconds(game));
  }

  function longer() {
    unlockMusic();
    const n = rules.longer(game);
    step(n);
    playClip(rules.clipSeconds(n));
  }

  /** The reveal: the song plays on from the clip's start while everyone sees what it was. */
  function hearIt() {
    if (!current) return;
    unlockMusic();
    payoff = true;
    player.play(current.buffer, current.start, PAYOFF_S, { ended: () => (payoff = false) });
  }

  function stopMusic() {
    player.stop();
    payoff = false;
  }

  function reveal(next: GameState) {
    step(rules.setUpcoming(next, game.upcoming ?? dealer.next(next.dealt)));
    hearIt();
    void preload();
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

  /** Another song, back on the ready screen: nobody is asked who named one the room has not heard. */
  function skipSong() {
    const s = dealer.next(game.dealt);
    if (!s) { note = 'No other songs in these packs.'; return; }
    note = '';
    player.stop();
    step(rules.replaceSong(game, s));
    void loadCurrent();
  }

  function next() {
    stopMusic();
    const n = rules.next(game);
    if (n.phase === 'win') {
      sfx.win();
      haptic.end();
      if (!demo) record(rules.gameRecord(n, packNames(n.packIds)));
    }
    step(n);
    if (n.phase === 'ready' && !n.song) step(rules.replaceSong(n, dealer.next(n.dealt)));
    if (game.phase === 'ready') void loadCurrent();
  }

  function undo() {
    stopMusic();
    step(rules.undo(game));
    status = current ? 'done' : 'loading';
  }

  function rematch() {
    const r = rules.rematch(game);
    step(r.song ? r : rules.replaceSong(r, dealer.next(r.dealt)));
    void loadCurrent();
  }

  function unblock() {
    unlockMusic();
    playClip(rules.clipSeconds(game));
  }

  function leave() {
    player.stop();
    onleave();
  }

  const shownTrack = $derived(demo ? demoTrack : current?.apple === game.song?.apple ? current?.track ?? null : (game.song ? tracks.get(game.song.apple) ?? null : null));
  const canPlay = $derived(!!game.song && (demo ? true : net === 'ok' && !!current && current.apple === game.song.apple));
  const connection = $derived(net === 'offline' || net === 'failed' ? net : '');
  const problem = $derived(connection || (game.song || net === 'looking' ? '' : 'empty'));
  const upcomingReady = $derived(demo || !game.upcoming || readyNext === game.upcoming.apple);
</script>

<div class="game" class:live={game.phase === 'listen' || game.phase === 'reveal'}>
  {#if game.phase === 'ready'}
    <Ready {game} {canPlay} {problem} looking={net === 'looking'} {note} onplay={play} onretry={connect} onleave={leave} />
  {:else if game.phase === 'listen'}
    <Stage status={connection ? 'error' : status} {progress} onunblock={unblock} />
    <Listen {game} status={connection ? 'error' : status} {note} {connection} onretry={connect} onagain={again} onlonger={longer} onaward={award} onnobody={nobody} onskip={skipSong} onleave={leave} />
  {:else if game.phase === 'reveal'}
    <TapToFinish><Reveal {game} track={shownTrack} playing={payoff} demo={!!demo} onhear={hearIt} onstop={stopMusic} onnext={next} onundo={undo} /></TapToFinish>
  {:else if game.phase === 'scores'}
    <TapToFinish><Scores {game} loading={!upcomingReady && !preloadFailed} retry={preloadFailed} onretry={preload} onnext={next} onleave={leave} /></TapToFinish>
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
  /* Laptop or TV: the record or the reveal's picture on the left, the controls on the right. */
  @media (min-width: 900px) and (orientation: landscape) {
    .game.live { max-width: 1180px; display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(340px, 1fr); grid-template-rows: auto 1fr; column-gap: var(--s-5); align-content: start; }
    .game.live :global(.stage), .game.live :global(.media) { grid-column: 1; grid-row: 1 / span 2; max-width: none; align-self: start; margin-top: var(--s-2); }
  }
</style>
