<script lang="ts">
  import { gameName } from '../../app.config';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import Stepper from '../../components/Stepper.svelte';
  import RulesCard from '../../components/RulesCard.svelte';
  import Rules from './Rules.svelte';
  import Players from './Players.svelte';
  import PackList from '../../components/PackList.svelte';
  import { packEntry } from './find';
  import { gibberishPacks } from '../../lib/content';
  import { unlockAudio } from '../../lib/sound';
  import { loadPlayers, loadSetup, savePlayers, saveSetup } from './store';
  import { MIN_PLAYERS, TARGET_RANGE, TIMER_CHOICES, standings, type GameState } from './logic';
  import { timerLabel } from './ui';
  import { rulesSummary } from './rulesSummary';
  import { reseating, unchanged, type Reseat } from '../../lib/players';

  let { saved, onstart, onresume, onroster, onmake, onedit, onhome }: {
    saved: GameState | null;
    onstart: (names: string[], opts: { target: number; seconds: number; packIds: string[] }) => void;
    onresume: () => void;
    /** Player changes made here, for the saved game (only when there are some). */
    onroster: (r: Reseat) => void;
    onmake: () => void;
    onedit: (packId: string) => void;
    onhome: () => void;
  } = $props();

  const prefs = loadSetup();
  const allPacks = gibberishPacks();
  let packs = $state.raw(allPacks);
  // A saved game's own players are the list here: changes to it join that game on Resume.
  // svelte-ignore state_referenced_locally
  const live = saved && saved.phase !== 'win' ? saved : null;
  let names = $state(live ? live.players.map((p) => p.name) : loadPlayers());
  let seats = $state(live ? live.players.map((_, i) => i) : []);
  let seconds = $state(prefs.seconds);
  let target = $state(prefs.target);
  // First visit: every built-in pack except the adults-only one.
  let selected = $state((prefs.packIds ?? allPacks.filter((p) => p.id !== 'after-dark').map((p) => p.id)).filter((id) => allPacks.some((p) => p.id === id)));

  $effect(() => savePlayers($state.snapshot(names)));
  $effect(() => saveSetup({ packIds: $state.snapshot(selected), seconds, target }));

  const cards = $derived(packs.filter((p) => selected.includes(p.id)).reduce((n, p) => n + p.cards.length, 0));
  const missing = $derived(
    names.length < MIN_PLAYERS ? 'Add players'
    : cards === 0 ? 'Pick packs' : '',
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
    onstart(names, { target, seconds, packIds: selected });
  }
</script>

<Screen fill title={gameName('gibberish')} onback={() => { keepRoster(); onhome(); }} backLabel="Home">
  {#snippet trailing()}<Rules {target} />{/snippet}
<div class="setup">
  <PackList game="gibberish" entries={packs.map(packEntry)} bind:selected noun="cards" placeholder="Search packs and cards" makeHint="Paste a list or ask the wizard"
    topName="players" topNeeded={names.length < MIN_PLAYERS} {onedit} {onmake} onimported={() => (packs = gibberishPacks())}>
    {#snippet notice()}
      {#if inProgress}
        {@const lead = standings(inProgress).slice(0, 3)}
        <div class="resume pop-in" role="status">
          <span><b>Game in progress</b> · {lead.map((r) => `${r.player.name} ${r.player.score}`).join(' · ')}{inProgress.players.length > 3 ? ' …' : ''}</span>
          <small>Player changes join this game. Packs and rules apply to the next one.</small>
        </div>
      {/if}
    {/snippet}
    {#snippet top()}
      <Players bind:names bind:seats />
    {/snippet}
  </PackList>

</div>

  {#snippet actions()}
    <RulesCard compact summary={rulesSummary(seconds, target)}>
      <div class="timer" role="radiogroup" aria-label="Seconds per card">
        <span class="label">Seconds per card</span>
        <div class="seg">
          {#each TIMER_CHOICES as s (s)}
            <button role="radio" aria-checked={seconds === s} class:on={seconds === s} onclick={() => (seconds = s)}>{timerLabel(s)}</button>
          {/each}
        </div>
      </div>
      <Stepper label="Points to win" bind:value={target} min={TARGET_RANGE[0]} max={TARGET_RANGE[1]} />
    </RulesCard>
    {#if inProgress}
      <Button size="lg" disabled={names.length < MIN_PLAYERS} onclick={() => { unlockAudio(); keepRoster(); onresume(); }} tip={names.length < MIN_PLAYERS ? undefined : 'Carries on with the game saved on this device'}>{names.length < MIN_PLAYERS ? missing : 'Resume game'}</Button>
      {#if confirming}<p class="faint" role="status">This ends the saved game.</p>{/if}
      <Button variant={confirming ? 'danger' : 'secondary'} onclick={startOver} disabled={!!missing} tip={missing ? undefined : 'Ends the saved game; asks for a second tap first'}>
        {missing || (confirming ? 'Start over' : 'New game')}
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
  /* Compact, always shown above the players (they can be folded away). */
  .resume {
    display: flex; flex-direction: column; gap: 2px; margin: var(--s-1) 0 var(--s-3); padding: var(--s-2) var(--s-3);
    border-radius: var(--r-md); border: 2px solid var(--accent); background: color-mix(in srgb, var(--accent) 18%, var(--bg-raised));
  }
  .resume span { color: var(--text-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .resume b { color: var(--text); font-family: var(--font-display); }
  .resume small { color: var(--text-dim); font-size: 0.8rem; line-height: 1.3; }
  .timer { background: var(--surface); border-radius: var(--r-md); padding: var(--s-3) var(--s-3) var(--s-3) var(--s-4); display: flex; flex-direction: column; gap: var(--s-2); }
  .label { font-weight: 600; }
  .seg { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; background: var(--bg-sunk); border-radius: var(--r-pill); padding: 4px; }
  .seg button { min-height: 44px; border: 0; border-radius: var(--r-pill); background: transparent; color: var(--text-dim); font-weight: 700; }
  .seg button.on { background: var(--accent); color: var(--on-accent); }
</style>
