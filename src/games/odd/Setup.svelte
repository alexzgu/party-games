<script lang="ts">
  import { gameName } from '../../app.config';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import Stepper from '../../components/Stepper.svelte';
  import Toggle from '../../components/Toggle.svelte';
  import RulesCard from '../../components/RulesCard.svelte';
  import PackList from '../../components/PackList.svelte';
  import Rules from './Rules.svelte';
  import Players from './Players.svelte';
  import { rulesSummary } from './rulesSummary';
  import { deckEntry } from '../forehead/find';
  import { wordDecks } from '../../lib/content';
  import { defaultPicks } from './deal';
  import { unlockAudio } from '../../lib/sound';
  import { loadPlayers, loadSetup, savePlayers, saveSetup } from './store';
  import { MIN_PLAYERS, ROUNDS_RANGE, standings, type GameOptions, type GameState } from './logic';

  // Players, Heads Down.'s packs (picked here, remembered for this game only; made and edited in
  // Heads Down.) and the options. A saved game in progress offers Resume.
  let { saved, onstart, onresume, onhome }: {
    saved: GameState | null;
    onstart: (names: string[], opts: GameOptions) => void;
    onresume: () => void;
    onhome: () => void;
  } = $props();

  const prefs = loadSetup();
  let decks = $state.raw(wordDecks());
  let names = $state(loadPlayers());
  let rounds = $state(prefs.rounds);
  let hint = $state(prefs.hint);
  let oddNeverStarts = $state(prefs.oddNeverStarts);
  // First visit: every built-in pack except the adults-only one.
  // svelte-ignore state_referenced_locally
  let selected = $state((prefs.packIds ?? defaultPicks(decks)).filter((id) => decks.some((d) => d.id === id)));

  $effect(() => savePlayers($state.snapshot(names)));
  $effect(() => saveSetup({ packIds: $state.snapshot(selected), rounds, hint, oddNeverStarts }));

  const words = $derived(decks.filter((d) => selected.includes(d.id)).reduce((n, d) => n + d.words.length, 0));
  const missing = $derived(names.length < MIN_PLAYERS ? 'Add players' : words === 0 ? 'Pick packs' : '');
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
    onstart($state.snapshot(names), { rounds, hint, oddNeverStarts, packIds: $state.snapshot(selected) });
  }
</script>

<Screen fill title={gameName('odd')} onback={onhome} backLabel="Games">
  {#snippet trailing()}<Rules {hint} {oddNeverStarts} />{/snippet}
<div class="setup">
  <PackList game="forehead" toolsKey="odd:packs" entries={decks.map(deckEntry)} bind:selected noun="words" placeholder="Search packs and words"
    makeHint="" footNote="These are Heads Down. packs. Make and edit them there."
    topName="players" topNeeded={names.length < MIN_PLAYERS} guard={400} onimported={() => (decks = wordDecks())}>
    {#snippet notice()}
      {#if inProgress}
        {@const lead = standings(inProgress).slice(0, 3)}
        <div class="resume pop-in" role="status">
          <span><b>Round {inProgress.log.length + (inProgress.phase === 'scores' ? 0 : 1)} of {inProgress.rounds}</b> · {lead.map((r) => `${r.player.name} ${r.player.score}`).join(' · ')}{inProgress.players.length > 3 ? ' …' : ''}</span>
          <small>Resume keeps that game's players. Changes here apply to the next game.</small>
        </div>
      {/if}
    {/snippet}
    {#snippet top()}
      <Players bind:names />
    {/snippet}
  </PackList>
</div>

  {#snippet actions()}
    <RulesCard compact summary={rulesSummary(rounds, hint, oddNeverStarts)}>
      <Stepper label="Rounds" bind:value={rounds} min={ROUNDS_RANGE[0]} max={ROUNDS_RANGE[1]} />
      <Toggle label="Hint" hint="The odd one out is told which pack the word is from" bind:checked={hint} />
      <Toggle label="Odd one never starts" hint="The first clue never comes from the odd one out" bind:checked={oddNeverStarts} />
    </RulesCard>
    {#if inProgress}
      <Button size="lg" onclick={() => { unlockAudio(); onresume(); }} tip="Carries on with the game saved on this device">Resume</Button>
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
  .resume {
    display: flex; flex-direction: column; gap: 2px; margin: var(--s-1) 0 var(--s-3); padding: var(--s-2) var(--s-3);
    border-radius: var(--r-md); border: 2px solid var(--accent); background: color-mix(in srgb, var(--accent) 18%, var(--bg-raised));
  }
  .resume span { color: var(--text-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .resume b { color: var(--text); font-family: var(--font-display); }
  .resume small { color: var(--text-dim); font-size: 0.8rem; line-height: 1.3; }
</style>
