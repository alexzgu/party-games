<script lang="ts">
  import { onMount } from 'svelte';
  import FitText from '../../components/FitText.svelte';
  import Popup from '../../components/Popup.svelte';
  import Button from '../../components/Button.svelte';
  import TopBar from './TopBar.svelte';
  import Rules from './Rules.svelte';
  import { saveTimer, timer } from './timer.svelte';
  import { anyScored, boardCleared, tileAt, undoLabel, type Game } from './logic';
  import { teamColor } from './look';

  // The board: categories across, values down. Used tiles go dim (with a dot in the colour of
  // the team that won them). Undo, full screen and ending the game live in the header.
  let { game, onopen, onundo, onend, onwin, onleave }: {
    game: Game;
    onopen: (tile: number) => void;
    onundo: () => void;
    onend: () => void;
    onwin: () => void;
    onleave: () => void;
  } = $props();

  /** Used tiles → the team that won each (-1 for nobody). */
  const used = $derived(new Map(game.log.flatMap((e) => (e.kind === 'tile' ? [[e.tile, e.winner] as const] : []))));
  const cleared = $derived(boardCleared(game));
  const undoText = $derived(undoLabel(game));
  let confirmEnd = $state(false);

  // Taps this soon after the board appears are the tail of a double tap on the clue screen
  // (a team button can sit right over a tile), so they must not open a tile.
  const shownAt = performance.now();
  const tap = (tile: number) => { if (performance.now() - shownAt >= 400) onopen(tile); };

  // Full screen for a laptop on the TV; hidden where the browser has none (iPhone).
  const canFull = typeof document !== 'undefined' && !!document.fullscreenEnabled;
  let full = $state(typeof document !== 'undefined' && !!document.fullscreenElement);
  onMount(() => {
    const sync = () => (full = !!document.fullscreenElement);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  });
  function toggleFull() {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  }
</script>

<div class="board fade-in">
  <TopBar backLabel="Back to setup (game is saved)" onback={onleave}>
    {#snippet title()}<h2 class="name">{game.board.name}</h2>{/snippet}
    {#snippet tools()}
      <button class="tool" onclick={onundo} disabled={!undoText} aria-label={undoText ? `Undo: ${undoText}` : 'Nothing to undo'}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="wide-only">Undo</span>
      </button>
      {#if canFull}
        <button class="tool wide-only" onclick={toggleFull} aria-label={full ? 'Leave full screen' : 'Full screen'}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            {#if full}<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
            {:else}<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>{/if}
          </svg>
        </button>
      {/if}
      <button class="tool" class:on={timer.shown} aria-pressed={timer.shown} onclick={() => { timer.shown = !timer.shown; saveTimer(); }}
        aria-label={timer.shown ? 'Hide the timer' : 'Show the timer'}>⏱</button>
      <Rules />
      <button class="tool" onclick={() => (confirmEnd = true)} data-tip="Ends the game now, after asking">End</button>
    {/snippet}
  </TopBar>

  <div class="grid" style:--cols={game.board.categories.length} style:--rows={game.values.length}>
    {#each game.board.categories as c, ci (ci)}
      <div class="cat"><FitText text={c.name} max={46} min={9} /></div>
    {/each}
    {#each game.values as v, r (r)}
      {#each game.board.categories as c, ci (ci)}
        {@const t = tileAt(game, ci, r)}
        {@const winner = used.get(t)}
        {#if winner === undefined}
          <button class="tile" onclick={() => tap(t)} aria-label="{c.name} for {v}"><span class="val">{v}</span></button>
        {:else}
          <div class="tile used" aria-label="{c.name} {v}, played">
            <span class="val">{v}</span>
            {#if winner >= 0}<i class="dot" style:background={teamColor(winner)}></i>{/if}
          </div>
        {/if}
      {/each}
    {/each}

    {#if cleared}
      <div class="cleared fade-in">
        <div class="done pop-in">
          <p class="big">Board cleared!</p>
          <Button size="lg" onclick={onwin}>🏆 See who won</Button>
          <Button variant="ghost" size="sm" onclick={onundo} tip="Takes back the last thing scored">Undo: {undoText}</Button>
        </div>
      </div>
    {/if}
  </div>
</div>

{#if confirmEnd}
  <Popup title="End the game?" onclose={() => (confirmEnd = false)}>
    <p class="muted note">
      {#if anyScored(game)}The team ahead now wins. It goes in History as ended early.{:else}Nothing has been scored yet, so this just closes the board.{/if}
    </p>
    <div class="stack">
      <Button variant="danger" onclick={() => { confirmEnd = false; onend(); }}>End game</Button>
      <Button variant="ghost" onclick={() => (confirmEnd = false)}>Keep playing</Button>
    </div>
  </Popup>
{/if}

<style>
  .board { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: clamp(8px, 1.2vmin, 16px); }
  .name {
    font-size: clamp(1.1rem, 2.6vmin, 2rem); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text);
  }
  .grid {
    position: relative; flex: 1; min-height: 0;
    display: grid; gap: clamp(4px, 0.9vmin, 12px);
    grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
    grid-template-rows: minmax(0, 1.15fr) repeat(var(--rows), minmax(0, 1fr));
  }
  @media (max-height: 560px) { .grid { grid-template-rows: minmax(48px, 1.15fr) repeat(var(--rows), minmax(48px, 1fr)); } }
  /* A phone on its side: the board has the full height beside the scores, so the rows share it. */
  @media (orientation: landscape) and (max-height: 500px) { .grid { grid-template-rows: minmax(0, 1.15fr) repeat(var(--rows), minmax(0, 1fr)); } }
  .cat {
    min-height: 0; padding: clamp(4px, 1vmin, 14px); border-radius: clamp(6px, 1vmin, 14px);
    background: color-mix(in srgb, var(--accent) 16%, var(--bg-raised));
    border: 1.5px solid color-mix(in srgb, var(--accent) 45%, transparent);
    color: var(--text); text-transform: uppercase;
  }
  .tile {
    container-type: size; position: relative; min-height: 0; min-width: 0; padding: 0;
    display: grid; place-items: center; border-radius: clamp(6px, 1vmin, 14px);
    background: linear-gradient(180deg, var(--surface-hi), var(--surface));
    border: 1.5px solid color-mix(in srgb, var(--accent) 22%, var(--line));
    box-shadow: inset 0 1px 0 color-mix(in srgb, var(--text) 8%, transparent);
    transition: transform var(--dur-fast) var(--ease-out), border-color var(--dur-fast) ease;
  }
  button.tile:hover { border-color: var(--accent); }
  button.tile:active { transform: scale(0.95); }
  .val {
    font-family: var(--font-display); font-weight: 800; letter-spacing: -0.03em; line-height: 1;
    font-size: min(50cqh, 32cqi); color: var(--accent); font-variant-numeric: tabular-nums;
    text-shadow: 0 0 0.45em color-mix(in srgb, var(--accent) 40%, transparent);
  }
  .tile.used { background: var(--bg-sunk); border-color: var(--line); box-shadow: none; }
  .tile.used .val { color: var(--text-faint); opacity: 0.3; text-shadow: none; }
  .dot { position: absolute; right: 12%; bottom: 14%; width: max(7px, 9cqmin); height: max(7px, 9cqmin); border-radius: 50%; opacity: 0.85; }

  .cleared {
    position: absolute; inset: 0; display: grid; grid-template-rows: minmax(0, 1fr); place-items: center; border-radius: var(--r-lg);
    background: color-mix(in srgb, var(--bg) 72%, transparent);
  }
  .done {
    display: flex; flex-direction: column; align-items: center; gap: var(--s-3); width: min(92%, 460px); max-height: 100%; overflow-y: auto;
    padding: var(--s-5); border-radius: var(--r-lg); background: var(--bg-raised); border: 2px solid var(--accent); box-shadow: var(--shadow);
  }
  /* The last thing scored can be one long word: it wraps inside the card, which scrolls on a low screen. */
  .done > :global(*) { flex: none; }
  .done :global(.btn) { max-width: 100%; padding-block: var(--s-1); overflow-wrap: anywhere; }
  .big { font-family: var(--font-display); font-weight: 800; font-size: clamp(1.8rem, 5vmin, 3rem); color: var(--accent); }
  .note { margin-bottom: var(--s-4); }
  /* Beats the top bar's own .tool display rule. */
  .board .wide-only { display: none; }
  @media (min-width: 700px) { .board .wide-only { display: inline-flex; } }
</style>
