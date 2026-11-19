<script lang="ts">
  import Screen from '../components/Screen.svelte';
  import Popup from '../components/Popup.svelte';
  import Button from '../components/Button.svelte';
  import { GAMES, gameName, type GameId } from '../app.config';
  import { history, removeEntry, clearHistory, type HistoryEntry } from '../lib/history';

  // Every finished round or game on this phone, newest first, filterable by game.
  let entries = $state(history());
  let filter = $state<GameId | 'all'>('all');
  let open = $state<HistoryEntry | null>(null);
  let confirmClear = $state(false);

  const shown = $derived(filter === 'all' ? entries : entries.filter((e) => e.game === filter));
  const accent = (g: GameId) => GAMES.find((x) => x.id === g)!.accent;
  const emoji = (g: GameId) => GAMES.find((x) => x.id === g)!.emoji;

  const day = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
  const when = (at: number) => `${day.format(at)} · ${time.format(at)}`;

  function del(id: string) {
    removeEntry(id);
    entries = history();
    open = null;
  }
</script>

<Screen title="History" accent="var(--text)">
  <div class="filters" role="radiogroup" aria-label="Game">
    <button role="radio" aria-checked={filter === 'all'} class:on={filter === 'all'} onclick={() => (filter = 'all')}>All</button>
    {#each GAMES as g (g.id)}
      <button role="radio" aria-checked={filter === g.id} class:on={filter === g.id} style:--accent={g.accent} onclick={() => (filter = g.id)}>{g.emoji} {g.name}</button>
    {/each}
  </div>

  {#if shown.length === 0}
    <p class="muted empty">Nothing yet. Finished rounds and games show up here, with the scores.</p>
  {:else}
    <ul class="list">
      {#each shown as e (e.id)}
        <li>
          <button class="row" style:--accent={accent(e.game)} onclick={() => (open = e)}>
            <span class="emoji" aria-hidden="true">{emoji(e.game)}</span>
            <span class="txt">
              <span class="title">{e.title}</span>
              {#if e.finished === false}<span class="early">Ended early</span>{/if}
              <span class="faint">{when(e.at)}{e.packs.length ? ' · ' + e.packs.join(', ') : ''}</span>
            </span>
          </button>
        </li>
      {/each}
    </ul>
    <div class="clear"><Button variant="ghost" onclick={() => (confirmClear = true)}>Clear history</Button></div>
  {/if}
</Screen>

{#if open}
  <Popup title={gameName(open.game)} onclose={() => (open = null)}>
    <p class="faint">{when(open.at)}</p>
    <p class="big">{open.title}</p>
    {#if open.finished === false}<p class="early-note">Ended early: these are the scores when it stopped.</p>{/if}
    <ol class="scores">
      {#each open.scores as s, i (i)}
        <li><span>{s.name}</span><b>{s.score}</b></li>
      {/each}
    </ol>
    {#if open.packs.length}<p class="faint">Packs: {open.packs.join(', ')}</p>{/if}
    {#if open.details?.length}
      <ul class="details">{#each open.details as d, i (i)}<li>{d}</li>{/each}</ul>
    {/if}
    <Button variant="ghost" onclick={() => del(open!.id)}>Delete this entry</Button>
  </Popup>
{/if}

{#if confirmClear}
  <Popup title="Clear history?" onclose={() => (confirmClear = false)}>
    <p class="muted">Deletes every entry on this phone. Packs and settings stay.</p>
    <div class="stack">
      <Button variant="danger" onclick={() => { clearHistory(); entries = []; confirmClear = false; }}>Clear all</Button>
      <Button variant="ghost" onclick={() => (confirmClear = false)}>Keep it</Button>
    </div>
  </Popup>
{/if}

<style>
  .filters { display: flex; gap: var(--s-2); overflow-x: auto; padding-bottom: var(--s-2); margin-bottom: var(--s-3); scrollbar-width: none; }
  .filters button {
    flex: none; padding: 10px 14px; border-radius: var(--r-pill); background: var(--surface);
    border: 1.5px solid var(--line); color: var(--text-dim); font-weight: 700; white-space: nowrap;
  }
  .filters button.on { border-color: var(--accent, var(--text)); color: var(--text); background: color-mix(in srgb, var(--accent, var(--text)) 16%, var(--surface)); }
  .empty { text-align: center; margin-top: var(--s-6); }
  .list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: var(--s-2); }
  .row {
    width: 100%; display: flex; gap: var(--s-3); align-items: center; text-align: left; padding: var(--s-3) var(--s-4);
    background: var(--surface); border: 1.5px solid var(--line); border-left: 4px solid var(--accent); border-radius: var(--r-md); color: var(--text);
  }
  .emoji { font-size: 1.5rem; }
  .txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .title { font-weight: 700; }
  .early {
    align-self: flex-start; padding: 1px 8px; border-radius: var(--r-pill);
    font-size: 0.72rem; font-weight: 700; color: var(--c-pass); border: 1px solid color-mix(in srgb, var(--c-pass) 50%, transparent);
  }
  .early-note { color: var(--c-pass); font-size: 0.9rem; margin: calc(-1 * var(--s-2)) 0 var(--s-3); }
  .clear { margin-top: var(--s-4); display: flex; justify-content: center; }
  .big { font-size: 1.2rem; font-weight: 800; margin: var(--s-2) 0 var(--s-3); }
  .scores { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 6px; margin-bottom: var(--s-3); }
  .scores li { display: flex; justify-content: space-between; padding: 8px 12px; background: var(--bg-sunk); border-radius: var(--r-sm); }
  .details { padding-left: 1.1em; margin-bottom: var(--s-3); color: var(--text-dim); display: flex; flex-direction: column; gap: 4px; }
</style>
