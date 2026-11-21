<script lang="ts">
  import { gameName } from '../../app.config';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import Segmented from '../../components/Segmented.svelte';
  import Toggle from '../../components/Toggle.svelte';
  import RulesCard from '../../components/RulesCard.svelte';
  import Teams from './Teams.svelte';
  import PackList from '../../components/PackList.svelte';
  import { boardEntry } from './find';
  import Rules from './Rules.svelte';
  import { quizBoards } from '../../lib/content';
  import { unlockAudio } from '../../lib/sound';
  import { loadSetup, saveSetup } from './store';
  import { points, rowValues, standings, type Game, type Options } from './logic';
  import { teamName } from './look';
  import { describeEmpty, emptyTiles, tidyBoard } from './board';
  import { pointsSummary } from './pointsSummary';

  let { saved, onstart, onresume, onroster, onhome, onedit, onmake }: {
    saved: Game | null;
    onstart: (o: Options) => void;
    onresume: () => void;
    /** Team changes made here, for the saved game (only when there are some). */
    onroster: (teams: string[]) => void;
    onhome: () => void;
    /** Opens a board's editor, on category `cat` when given. */
    onedit: (boardId: string, cat?: number) => void;
    onmake: () => void;
  } = $props();

  const prefs = loadSetup();
  let boards = $state.raw(quizBoards());
  // A saved game's own teams are the list here: changes to it join that game on Resume.
  // svelte-ignore state_referenced_locally
  const live = saved && saved.phase !== 'win' ? saved : null;
  let names = $state(live ? [...live.teams, ...prefs.names.slice(live.teams.length)] : prefs.names);
  let count = $state(live ? live.teams.length : prefs.count);
  // svelte-ignore state_referenced_locally
  let picked = $state(boards.some((b) => b.id === prefs.boardId) ? [prefs.boardId as string] : boards.slice(0, 1).map((b) => b.id));
  const boardId = $derived(picked[0] ?? null);
  let scale = $state<'x1' | 'x2'>(prefs.double ? 'x2' : 'x1');
  let penalty = $state(prefs.penalty);

  $effect(() => saveSetup({ names: $state.snapshot(names), count, boardId, double: scale === 'x2', penalty }));

  const board = $derived(boards.find((b) => b.id === boardId) ?? null);
  const rows = $derived(board?.categories[0]?.clues.length ?? 5);
  const range = (double: boolean) => { const v = rowValues(rows, double); return `${v[0]}–${points(v[v.length - 1])}`; };
  const scales = $derived([{ value: 'x1' as const, label: range(false) }, { value: 'x2' as const, label: range(true) }]);
  const inProgress = $derived(saved && saved.phase !== 'win' ? saved : null);

  /** Hands the team changes to the saved game, when there are any. */
  function keepRoster() {
    if (!inProgress) return;
    const teams = names.slice(0, count).map(teamName);
    if (teams.length !== inProgress.teams.length || teams.some((t, i) => t !== inProgress.teams[i])) onroster(teams);
  }
  // A board with empty tiles is kept as a draft: it can be edited but not played yet.
  const gaps = $derived(board ? emptyTiles(board).length : 0);
  const blocked = $derived(!board ? 'Pick a pack' : gaps ? `Fill ${gaps} empty ${gaps === 1 ? 'tile' : 'tiles'} first` : '');

  // With a game saved, starting over takes a second tap so nobody wipes the scores by accident.
  let confirming = $state(false);
  let confirmTimer: ReturnType<typeof setTimeout> | undefined;
  let confirmAt = 0;
  function startOver() {
    // A double tap must not count as the confirming second tap.
    if (confirming && performance.now() - confirmAt < 400) return;
    if (!confirming) {
      confirming = true;
      confirmAt = performance.now();
      clearTimeout(confirmTimer);
      confirmTimer = setTimeout(() => (confirming = false), 4000);
      return;
    }
    clearTimeout(confirmTimer);
    start();
  }

  function start() {
    if (!board || blocked) return;
    unlockAudio();
    onstart({ teams: names.slice(0, count).map(teamName), board: tidyBoard(board), double: scale === 'x2', penalty });
  }
</script>

<Screen title={gameName('quiz')} onback={() => { keepRoster(); onhome(); }} backLabel="Home">
  {#snippet trailing()}<Rules />{/snippet}
<div class="setup">
  {#if inProgress}
    {@const top = standings(inProgress)}
    <div class="resume pop-in" role="status">
      <b>Game in progress · {inProgress.board.name}</b>
      <span>{top.slice(0, 4).map((r) => `${r.name} ${points(r.score)}`).join(' · ')}{top.length > 4 ? ` · +${top.length - 4} more` : ''}</span>
      <small>Team changes join this game. The pack and points apply to the next one.</small>
    </div>
  {/if}

  <Teams bind:names bind:count locked={inProgress ? (inProgress.teams.length === 1 ? 'solo' : 'teams') : null} />

  <PackList game="quiz" entries={boards.map(boardEntry)} bind:selected={picked} single noun="clues" placeholder="Search packs and clues" makeHint="Start blank, paste one, or ask the wizard"
    onedit={(id) => onedit(id)} {onmake} onimported={() => (boards = quizBoards())} />
  {#if board && gaps}
    <div class="gaps" role="status">
      <p><b>{board.name}</b> is a draft with {gaps === 1 ? 'one empty tile' : `${gaps} empty tiles`}: {describeEmpty(board, rowValues(rows, scale === 'x2'))}.</p>
      <Button variant="secondary" size="sm" onclick={() => onedit(board.id, emptyTiles(board)[0]?.category)}>{gaps === 1 ? 'Fill it in' : 'Fill them in'}</Button>
    </div>
  {/if}
</div>

  {#snippet actions()}
    <RulesCard compact title="Points" summary={pointsSummary(rows, scale === 'x2', penalty)}>
      <div class="field">
        <span class="lbl">Points per row</span>
        <Segmented bind:value={scale} options={scales} label="Points per row" />
      </div>
      <Toggle bind:checked={penalty} label="Wrong answers lose points" hint="A team that guesses wrong loses the tile's value" />
    </RulesCard>
    {#if inProgress}
      <Button size="lg" onclick={() => { unlockAudio(); keepRoster(); onresume(); }}>Resume game</Button>
      <Button variant={confirming ? 'danger' : 'secondary'} onclick={startOver} disabled={!!blocked}>
        {blocked || (confirming ? 'Tap again to end it and start over' : 'Start a new game')}
      </Button>
    {:else}
      <Button size="lg" onclick={start} disabled={!!blocked}>{blocked || (count === 1 ? 'Start solo game' : 'Start game')}</Button>
    {/if}
  {/snippet}
</Screen>

<style>
  .setup { display: contents; }
  .setup :global(h3) {
    color: var(--text-dim); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.08em; font-family: var(--font-body); font-weight: 700;
  }
  .resume {
    display: flex; flex-direction: column; gap: 2px; padding: var(--s-4); border-radius: var(--r-lg); border: 2px solid var(--accent);
    background: color-mix(in srgb, var(--accent) 16%, var(--bg-raised));
  }
  .resume b { font-family: var(--font-display); font-size: 1.15rem; }
  .resume span { color: var(--text-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .resume small { margin-top: var(--s-1); color: var(--text-dim); font-size: 0.85rem; line-height: 1.3; }
  .field { display: flex; flex-direction: column; gap: var(--s-1); }
  .lbl { font-weight: 600; font-size: 0.92rem; color: var(--text-dim); padding-left: var(--s-1); }
  .gaps {
    display: flex; flex-direction: column; align-items: flex-start; gap: var(--s-2); padding: var(--s-3) var(--s-4); border-radius: var(--r-md);
    background: color-mix(in srgb, var(--c-pass) 14%, var(--surface)); border: 1.5px solid color-mix(in srgb, var(--c-pass) 50%, transparent);
  }
  .gaps p { margin: 0; }
</style>
