<script lang="ts">
  import { gameName } from '../../app.config';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import Stepper from '../../components/Stepper.svelte';
  import HowTo from '../../components/HowTo.svelte';
  import Players from './Players.svelte';
  import PackPicker from './PackPicker.svelte';
  import { songPacks } from '../../lib/content';
  import { unlockMusic } from './audio';
  import { loadPlayers, loadSetup, savePlayers, saveSetup } from './store';
  import { CLIPS, MIN_PLAYERS, POINTS, TARGET_RANGE, standings, type GameState } from './logic';

  let { saved, notice = '', onstart, onresume, onnew, onedit, onhome }: {
    saved: GameState | null;
    /** A one-off note (a saved game from the old version could not carry on). */
    notice?: string;
    onstart: (names: string[], opts: { target: number; packIds: string[] }) => void;
    onresume: () => void;
    onnew: () => void;
    onedit: (packId: string) => void;
    onhome: () => void;
  } = $props();

  const prefs = loadSetup();
  const packs = songPacks();
  let names = $state(loadPlayers());
  let target = $state(prefs.target);
  // First visit: every built-in pack.
  let selected = $state((prefs.packIds ?? packs.filter((p) => !p.custom).map((p) => p.id)).filter((id) => packs.some((p) => p.id === id)));

  $effect(() => savePlayers($state.snapshot(names)));
  $effect(() => saveSetup({ packIds: $state.snapshot(selected), target }));

  const songs = $derived(packs.filter((p) => selected.includes(p.id)).reduce((n, p) => n + p.songs.length, 0));
  const missing = $derived(
    names.length < MIN_PLAYERS ? `Add ${MIN_PLAYERS - names.length} more player${MIN_PLAYERS - names.length > 1 ? 's' : ''}`
    : songs === 0 ? 'Pick a pack with songs' : '',
  );
  const inProgress = $derived(saved && saved.phase !== 'win' ? saved : null);

  // With a game saved, starting over takes a second tap so nobody wipes the scores by accident.
  let confirming = $state(false);
  let confirmTimer: ReturnType<typeof setTimeout> | undefined;

  function startOver() {
    if (!confirming) {
      confirming = true;
      clearTimeout(confirmTimer);
      confirmTimer = setTimeout(() => (confirming = false), 4000);
      return;
    }
    clearTimeout(confirmTimer);
    start();
  }

  function start() {
    unlockMusic();
    onstart(names, { target, packIds: selected });
  }
</script>

<Screen title={gameName('song')} onback={onhome} backLabel="Home">
  {#snippet trailing()}
    <HowTo>
      <ol>
        <li>One phone or laptop plays a few seconds of a song. Turn the volume up.</li>
        <li>Everyone shouts the song's title. The host taps whoever said it first.</li>
        <li>Faster is worth more: <b>{POINTS[0]} points</b> on the {CLIPS[0]}-second clip, {POINTS[1]} if it takes {CLIPS[1]} seconds, {POINTS[2]} at {CLIPS[2]}. “Longer” plays more of it.</li>
        <li>Nobody knows it? Tap “Nobody”. Then the answer shows and the song plays on for a moment.</li>
        <li>First to {target} points wins.</li>
      </ol>
      <p>The clips are Apple Music’s 30-second song previews, so this game needs internet. The game picks the catchiest moment of each one by itself.</p>
      <p>Add your own songs from a pack’s pencil: paste YouTube or Apple Music links or a list of titles, read a YouTube playlist, or ask Claude for a theme.</p>
    </HowTo>
  {/snippet}
<div class="setup">
  {#if notice}<p class="notice" role="status">{notice}</p>{/if}
  {#if inProgress}
    {@const top = standings(inProgress).slice(0, 3)}
    <div class="resume pop-in" role="status">
      <b>Game in progress</b>
      <span>{top.map((r) => `${r.player.name} ${r.player.score}`).join(' · ')}{inProgress.players.length > 3 ? ' …' : ''}</span>
    </div>
  {/if}

  <Players bind:names />
  <PackPicker {packs} bind:selected {onnew} {onedit} />

  <section class="opts" aria-labelledby="opts-h">
    <h3 id="opts-h">Rules</h3>
    <Stepper label="Points to win" bind:value={target} min={TARGET_RANGE[0]} max={TARGET_RANGE[1]} />
    <p class="net"><span aria-hidden="true">📶</span> Needs internet: clips are song previews from Apple Music.</p>
  </section>
</div>

  {#snippet actions()}
    {#if inProgress}
      <Button size="lg" onclick={() => { unlockMusic(); onresume(); }}>Resume game</Button>
      <Button variant={confirming ? 'danger' : 'secondary'} onclick={startOver} disabled={!!missing}>
        {missing || (confirming ? 'Tap again to end it and start over' : 'Start a new game')}
      </Button>
    {:else}
      <Button size="lg" onclick={start} disabled={!!missing}>{missing || 'Start game'}</Button>
    {/if}
  {/snippet}
</Screen>

<style>
  .setup { display: contents; }
  .setup :global(h3) {
    color: var(--text-dim); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.08em; font-family: var(--font-body); font-weight: 700;
  }
  .resume {
    display: flex; flex-direction: column; gap: 2px; text-align: left;
    padding: var(--s-4); border-radius: var(--r-lg); border: 2px solid var(--accent);
    background: color-mix(in srgb, var(--accent) 18%, var(--bg-raised));
  }
  .resume b { font-family: var(--font-display); font-size: 1.2rem; }
  .resume span { color: var(--text-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .notice { margin: 0; padding: var(--s-3) var(--s-4); border-radius: var(--r-md); background: var(--surface); border: 1.5px solid var(--line-strong); color: var(--text-dim); }
  .opts { display: flex; flex-direction: column; gap: var(--s-2); }
  .net { color: var(--text-dim); font-size: 0.92rem; display: flex; gap: var(--s-2); align-items: baseline; }
</style>
