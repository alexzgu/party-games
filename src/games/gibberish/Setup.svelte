<script lang="ts">
  import { gameName } from '../../app.config';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import Stepper from '../../components/Stepper.svelte';
  import Players from './Players.svelte';
  import PackPicker from './PackPicker.svelte';
  import { gibberishPacks } from '../../lib/content';
  import { unlockAudio } from '../../lib/sound';
  import { loadPlayers, loadSetup, savePlayers, saveSetup } from './store';
  import { MIN_PLAYERS, TARGET_RANGE, TIMER_CHOICES, standings, type GameState } from './logic';
  import { timerLabel } from './ui';

  let { saved, onstart, onresume, onmake, onhome }: {
    saved: GameState | null;
    onstart: (names: string[], opts: { target: number; seconds: number; packIds: string[] }) => void;
    onresume: () => void;
    onmake: () => void;
    onhome: () => void;
  } = $props();

  const prefs = loadSetup();
  const allPacks = gibberishPacks();
  let packs = $state(allPacks);
  let names = $state(loadPlayers());
  let seconds = $state(prefs.seconds);
  let target = $state(prefs.target);
  // First visit: every built-in pack except the adults-only one.
  let selected = $state((prefs.packIds ?? allPacks.filter((p) => p.id !== 'after-dark').map((p) => p.id)).filter((id) => allPacks.some((p) => p.id === id)));

  $effect(() => savePlayers($state.snapshot(names)));
  $effect(() => saveSetup({ packIds: $state.snapshot(selected), seconds, target }));

  const cards = $derived(packs.filter((p) => selected.includes(p.id)).reduce((n, p) => n + p.cards.length, 0));
  const missing = $derived(
    names.length < MIN_PLAYERS ? `Add ${MIN_PLAYERS - names.length} more player${MIN_PLAYERS - names.length > 1 ? 's' : ''}`
    : cards === 0 ? 'Pick at least one pack' : '',
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
    unlockAudio();
    onstart(names, { target, seconds, packIds: selected });
  }
</script>

<Screen title={gameName('gibberish')} onback={onhome} backLabel="Home">
<div class="setup">
  {#if inProgress}
    {@const top = standings(inProgress).slice(0, 3)}
    <div class="resume pop-in" role="status">
      <span class="r-text">
        <b>Game in progress</b>
        <span>{top.map((r) => `${r.player.name} ${r.player.score}`).join(' · ')}{inProgress.players.length > 3 ? ' …' : ''}</span>
      </span>
    </div>
  {:else}
    <p class="intro">Read nonsense out loud. First to hear the real thing scores.</p>
    <p class="example" aria-label="Example: Eye Scream sounds like Ice Cream"><span>“Eye Scream”</span> <b aria-hidden="true">→</b> <span>Ice Cream</span></p>
  {/if}

  <Players bind:names />
  <PackPicker bind:packs bind:selected {onmake} />

  <section class="opts" aria-labelledby="opts-h">
    <h3 id="opts-h">Rules</h3>
    <div class="timer" role="radiogroup" aria-label="Seconds per card">
      <span class="label">Seconds per card</span>
      <div class="seg">
        {#each TIMER_CHOICES as s (s)}
          <button role="radio" aria-checked={seconds === s} class:on={seconds === s} onclick={() => (seconds = s)}>{timerLabel(s)}</button>
        {/each}
      </div>
    </div>
    <Stepper label="Points to win" bind:value={target} min={TARGET_RANGE[0]} max={TARGET_RANGE[1]} />
  </section>

</div>

  {#snippet actions()}
    {#if inProgress}
      <Button size="lg" onclick={() => { unlockAudio(); onresume(); }}>Resume game</Button>
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
  .intro { color: var(--text-dim); }
  .example { margin-top: calc(-1 * var(--s-2)); font-family: var(--font-display); font-weight: 700; font-size: 1.1rem; color: var(--text-faint); }
  .example b { color: var(--accent); margin: 0 var(--s-1); }
  .example span:last-child { color: var(--c-gold); }
  .resume {
    display: flex; align-items: center; justify-content: space-between; gap: var(--s-3); text-align: left;
    padding: var(--s-4); border-radius: var(--r-lg); border: 2px solid var(--accent);
    background: color-mix(in srgb, var(--accent) 18%, var(--bg-raised)); min-height: 72px;
  }
  .r-text { display: flex; flex-direction: column; min-width: 0; }
  .r-text b { font-family: var(--font-display); font-size: 1.2rem; }
  .r-text span { color: var(--text-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .opts { display: flex; flex-direction: column; gap: var(--s-2); }
  .timer { background: var(--surface); border-radius: var(--r-md); padding: var(--s-3) var(--s-3) var(--s-3) var(--s-4); display: flex; flex-direction: column; gap: var(--s-2); }
  .label { font-weight: 600; }
  .seg { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; background: var(--bg-sunk); border-radius: var(--r-pill); padding: 4px; }
  .seg button { min-height: 44px; border: 0; border-radius: var(--r-pill); background: transparent; color: var(--text-dim); font-weight: 700; }
  .seg button.on { background: var(--accent); color: var(--on-accent); }
</style>
