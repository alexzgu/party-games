<script lang="ts">
  import { gameName } from '../../app.config';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import Stepper from '../../components/Stepper.svelte';
  import Segmented from '../../components/Segmented.svelte';
  import Toggle from '../../components/Toggle.svelte';
  import Rules from './Rules.svelte';
  import RulesCard from '../../components/RulesCard.svelte';
  import { rulesSummary } from './rulesSummary';
  import { reseating, unchanged, type Reseat } from '../../lib/players';
  import Players from './Players.svelte';
  import PackPicker from './PackPicker.svelte';
  import { quickPacks } from '../../lib/content';
  import { unlockAudio } from '../../lib/sound';
  import { loadPlayers, loadSetup, savePlayers, saveSetup } from './store';
  import { MIN_PLAYERS, SECONDS_CHOICES, TARGET_RANGE, standings, type GameOptions, type GameState } from './logic';

  let { saved, onstart, onresume, onroster, onmake, onedit, onhome }: {
    saved: GameState | null;
    onstart: (names: string[], opts: GameOptions) => void;
    onresume: () => void;
    /** Player changes made here, for the saved game (only when there are some). */
    onroster: (r: Reseat) => void;
    onmake: () => void;
    onedit: (packId: string) => void;
    onhome: () => void;
  } = $props();

  const prefs = loadSetup();
  let packs = $state.raw(quickPacks());
  // A saved game's own players are the list here: changes to it join that game on Resume.
  // svelte-ignore state_referenced_locally
  const live = saved && saved.phase !== 'win' ? saved : null;
  let names = $state(live ? live.players.map((p) => p.name) : loadPlayers());
  let seats = $state(live ? live.players.map((_, i) => i) : []);
  let seconds = $state(prefs.seconds);
  let target = $state(prefs.target);
  let steal = $state(prefs.steal);
  let stealUsesTurn = $state(prefs.stealUsesTurn);
  // First visit: every built-in pack except the adults-only one.
  // svelte-ignore state_referenced_locally
  let selected = $state((prefs.packIds ?? packs.filter((p) => p.id !== 'after-dark').map((p) => p.id)).filter((id) => packs.some((p) => p.id === id)));

  $effect(() => savePlayers($state.snapshot(names)));
  $effect(() => saveSetup({ packIds: $state.snapshot(selected), seconds, target, steal, stealUsesTurn }));

  const SECONDS = SECONDS_CHOICES.map((s) => ({ value: s as number, label: `${s}s` }));
  const prompts = $derived(packs.filter((p) => selected.includes(p.id)).reduce((n, p) => n + p.prompts.length, 0));
  const missing = $derived(
    names.length < MIN_PLAYERS ? `Add ${MIN_PLAYERS - names.length} more player${MIN_PLAYERS - names.length > 1 ? 's' : ''}`
    : prompts === 0 ? 'Pick at least one pack' : '',
  );
  const inProgress = $derived(saved && saved.phase !== 'win' ? saved : null);

  /** Hands the player changes to the saved game, when there are any and enough players are left. */
  function keepRoster() {
    if (!inProgress || names.length < MIN_PLAYERS) return;
    const r = reseating(names, seats, inProgress.players.length);
    if (unchanged(r, inProgress.players.map((p) => p.name))) return;
    onroster(r);
    seats = names.map((_, i) => i);
  }

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
    onstart($state.snapshot(names), { target, seconds, steal, stealUsesTurn, packIds: $state.snapshot(selected) });
  }
</script>

<Screen title={gameName('quick')} onback={() => { keepRoster(); onhome(); }} backLabel="Home">
  {#snippet trailing()}<Rules {seconds} {target} {steal} {stealUsesTurn} />{/snippet}
<div class="setup">
  {#if inProgress}
    {@const top = standings(inProgress).slice(0, 3)}
    <div class="resume pop-in" role="status">
      <b>Game in progress</b>
      <span>{top.map((r) => `${r.player.name} ${r.player.score}`).join(' · ')}{inProgress.players.length > 3 ? ' …' : ''}</span>
      <small>Player changes join this game. Packs and rules apply to the next one.</small>
    </div>
  {/if}

  <Players bind:names bind:seats />
  <PackPicker {packs} bind:selected {onmake} {onedit} onimported={() => (packs = quickPacks())} />

  <RulesCard summary={rulesSummary(seconds, target, steal, stealUsesTurn)}>
    <div class="secs">
      <span class="label">Seconds on the clock</span>
      <Segmented label="Seconds on the clock" options={SECONDS} bind:value={seconds} />
    </div>
    <Stepper label="Points to win" bind:value={target} min={TARGET_RANGE[0]} max={TARGET_RANGE[1]} />
    <Toggle label="Steal" hint="A miss goes to the next player, same prompt" bind:checked={steal} />
    {#if steal}<Toggle label="A steal uses the stealer's turn" hint="Play then skips them and goes to the player after" bind:checked={stealUsesTurn} />{/if}
  </RulesCard>
</div>

  {#snippet actions()}
    {#if inProgress}
      <Button size="lg" disabled={names.length < MIN_PLAYERS} onclick={() => { unlockAudio(); keepRoster(); onresume(); }}>{names.length < MIN_PLAYERS ? missing : 'Resume game'}</Button>
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
  .resume small { margin-top: var(--s-1); color: var(--text-dim); font-size: 0.85rem; line-height: 1.3; }
  .secs { background: var(--surface); border-radius: var(--r-md); padding: var(--s-3) var(--s-3) var(--s-3) var(--s-4); display: flex; flex-direction: column; gap: var(--s-2); }
  .label { font-weight: 600; }
</style>
