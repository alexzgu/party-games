<script lang="ts">
  import { gameName } from '../../app.config';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import Segmented from '../../components/Segmented.svelte';
  import Toggle from '../../components/Toggle.svelte';
  import Teams from './Teams.svelte';
  import BoardPicker from './BoardPicker.svelte';
  import Rules from './Rules.svelte';
  import { quizBoards } from '../../lib/content';
  import { unlockAudio } from '../../lib/sound';
  import { loadSetup, saveSetup } from './store';
  import { points, rowValues, standings, type Game, type Options } from './logic';
  import { teamName } from './look';
  import { describeEmpty, emptyTiles, tidyBoard } from './board';

  let { saved, onstart, onresume, onhome, onedit, onmake }: {
    saved: Game | null;
    onstart: (o: Options) => void;
    onresume: () => void;
    onhome: () => void;
    onedit: (boardId: string) => void;
    onmake: () => void;
  } = $props();

  const prefs = loadSetup();
  const boards = quizBoards();
  let names = $state(prefs.names);
  let count = $state(prefs.count);
  let boardId = $state(boards.some((b) => b.id === prefs.boardId) ? prefs.boardId : (boards[0]?.id ?? null));
  let scale = $state<'x1' | 'x2'>(prefs.double ? 'x2' : 'x1');
  let penalty = $state(prefs.penalty);

  $effect(() => saveSetup({ names: $state.snapshot(names), count, boardId, double: scale === 'x2', penalty }));

  const board = $derived(boards.find((b) => b.id === boardId) ?? null);
  const rows = $derived(board?.categories[0]?.clues.length ?? 5);
  const range = (double: boolean) => { const v = rowValues(rows, double); return `${v[0]}–${points(v[v.length - 1])}`; };
  const scales = $derived([{ value: 'x1' as const, label: range(false) }, { value: 'x2' as const, label: range(true) }]);
  const inProgress = $derived(saved && saved.phase !== 'win' ? saved : null);
  // A board with empty tiles is kept as a draft: it can be edited but not played yet.
  const gaps = $derived(board ? emptyTiles(board).length : 0);
  const blocked = $derived(!board ? 'Pick a board' : gaps ? `Fill ${gaps} empty ${gaps === 1 ? 'tile' : 'tiles'} first` : '');

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

<Screen title={gameName('quiz')} onback={onhome} backLabel="Home">
  {#snippet trailing()}<Rules />{/snippet}
<div class="setup">
  {#if inProgress}
    {@const top = standings(inProgress)}
    <div class="resume pop-in" role="status">
      <b>Game in progress · {inProgress.board.name}</b>
      <span>{top.slice(0, 4).map((r) => `${r.name} ${points(r.score)}`).join(' · ')}{top.length > 4 ? ` · +${top.length - 4} more` : ''}</span>
    </div>
  {/if}

  <Teams bind:names bind:count />
  <BoardPicker {boards} bind:selected={boardId} {onedit} {onmake} />
  {#if board && gaps}
    <div class="gaps" role="status">
      <p><b>{board.name}</b> is a draft: {gaps === 1 ? 'one tile is' : `${gaps} tiles are`} empty ({describeEmpty(board, rowValues(rows, scale === 'x2'))}).</p>
      <Button variant="secondary" size="sm" onclick={() => onedit(board.id)}>Fill them in</Button>
    </div>
  {/if}

  <section class="opts" aria-labelledby="opts-h">
    <h3 id="opts-h">Points</h3>
    <Segmented bind:value={scale} options={scales} label="Points per row" />
    <Toggle bind:checked={penalty} label="Wrong answers lose points" hint="A team that guesses wrong loses the tile's value" />
  </section>
</div>

  {#snippet actions()}
    {#if inProgress}
      <Button size="lg" onclick={() => { unlockAudio(); onresume(); }}>Resume game</Button>
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
  .opts { display: flex; flex-direction: column; gap: var(--s-2); }
  .gaps {
    display: flex; flex-direction: column; align-items: flex-start; gap: var(--s-2); padding: var(--s-3) var(--s-4); border-radius: var(--r-md);
    background: color-mix(in srgb, var(--c-pass) 14%, var(--surface)); border: 1.5px solid color-mix(in srgb, var(--c-pass) 50%, transparent);
  }
  .gaps p { margin: 0; }
</style>
