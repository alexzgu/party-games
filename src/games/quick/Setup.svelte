<script lang="ts">
  import { gameName } from '../../app.config';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import Stepper from '../../components/Stepper.svelte';
  import Segmented from '../../components/Segmented.svelte';
  import Toggle from '../../components/Toggle.svelte';
  import HowTo from '../../components/HowTo.svelte';
  import Players from './Players.svelte';
  import PackPicker from './PackPicker.svelte';
  import { quickPacks } from '../../lib/content';
  import { unlockAudio } from '../../lib/sound';
  import { loadPlayers, loadSetup, savePlayers, saveSetup } from './store';
  import { MIN_PLAYERS, SECONDS_CHOICES, TARGET_RANGE, standings, type GameOptions, type GameState } from './logic';

  let { saved, onstart, onresume, onmake, onedit, onhome }: {
    saved: GameState | null;
    onstart: (names: string[], opts: GameOptions) => void;
    onresume: () => void;
    onmake: () => void;
    onedit: (packId: string) => void;
    onhome: () => void;
  } = $props();

  const prefs = loadSetup();
  const packs = quickPacks();
  let names = $state(loadPlayers());
  let seconds = $state(prefs.seconds);
  let target = $state(prefs.target);
  let steal = $state(prefs.steal);
  // First visit: every built-in pack except the adults-only one.
  let selected = $state((prefs.packIds ?? packs.filter((p) => p.id !== 'after-dark').map((p) => p.id)).filter((id) => packs.some((p) => p.id === id)));

  $effect(() => savePlayers($state.snapshot(names)));
  $effect(() => saveSetup({ packIds: $state.snapshot(selected), seconds, target, steal }));

  const SECONDS = SECONDS_CHOICES.map((s) => ({ value: s as number, label: `${s}s` }));
  const prompts = $derived(packs.filter((p) => selected.includes(p.id)).reduce((n, p) => n + p.prompts.length, 0));
  const missing = $derived(
    names.length < MIN_PLAYERS ? `Add ${MIN_PLAYERS - names.length} more player${MIN_PLAYERS - names.length > 1 ? 's' : ''}`
    : prompts === 0 ? 'Pick at least one pack' : '',
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
    onstart($state.snapshot(names), { target, seconds, steal, packIds: $state.snapshot(selected) });
  }
</script>

<Screen title={gameName('quick')} onback={onhome} backLabel="Home">
  {#snippet trailing()}
    <HowTo>
      <ol>
        <li>Pass the phone round. The phone says whose turn it is.</li>
        <li>On your turn, tap to see your prompt, like <b>“Name 3 things you'd find in a fridge”</b>. The clock starts at once: {seconds} seconds.</li>
        <li>Say three answers out loud before the buzzer. Everyone else listens.</li>
        <li>The room decides: <b>Got 3</b> is a point, <b>Didn't</b> is not. Got them early? Tap <b>Got all 3</b> to stop the clock.</li>
        {#if steal}<li><b>Steal:</b> miss it and the next player gets the same prompt and a fresh clock. Three <i>different</i> answers steal the point.</li>{/if}
        <li>Wrong call? Undo takes back the last decision.</li>
        <li>First to {target} points wins.</li>
      </ol>
    </HowTo>
  {/snippet}
<div class="setup">
  {#if inProgress}
    {@const top = standings(inProgress).slice(0, 3)}
    <div class="resume pop-in" role="status">
      <b>Game in progress</b>
      <span>{top.map((r) => `${r.player.name} ${r.player.score}`).join(' · ')}{inProgress.players.length > 3 ? ' …' : ''}</span>
    </div>
  {/if}

  <Players bind:names />
  <PackPicker {packs} bind:selected {onmake} {onedit} />

  <section class="opts" aria-labelledby="opts-h">
    <h3 id="opts-h">Rules</h3>
    <div class="secs">
      <span class="label">Seconds on the clock</span>
      <Segmented label="Seconds on the clock" options={SECONDS} bind:value={seconds} />
    </div>
    <Stepper label="Points to win" bind:value={target} min={TARGET_RANGE[0]} max={TARGET_RANGE[1]} />
    <Toggle label="Steal" hint="A miss goes to the next player, same prompt" bind:checked={steal} />
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
  .resume {
    display: flex; flex-direction: column; text-align: left; padding: var(--s-4); border-radius: var(--r-lg);
    border: 2px solid var(--accent); background: color-mix(in srgb, var(--accent) 18%, var(--bg-raised)); min-height: 72px;
  }
  .resume b { font-family: var(--font-display); font-size: 1.2rem; }
  .resume span { color: var(--text-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .opts { display: flex; flex-direction: column; gap: var(--s-2); }
  .secs { background: var(--surface); border-radius: var(--r-md); padding: var(--s-3) var(--s-3) var(--s-3) var(--s-4); display: flex; flex-direction: column; gap: var(--s-2); }
  .label { font-weight: 600; }
</style>
