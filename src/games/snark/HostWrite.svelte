<script lang="ts">
  import Avatar from '../../components/room/Avatar.svelte';
  import Timer from '../../components/room/Timer.svelte';
  import { HOUSE, isFinalRound, player, present, promptCount, tasksFor, type Game } from './logic';

  // Everyone is typing on their phone; the room sees who is still writing.
  let { game, online, left, total }: { game: Game; online: ReadonlySet<string>; left: number | null; total: number } = $props();

  const final = $derived(isFinalRound(game));
  const lines = $derived(game.items[0]?.kind === 'lines');
  const nameIn = (pid: string) => (pid === HOUSE ? 'the house' : player(game, pid)?.name ?? '?');
  const pairs = $derived(lines ? game.items.map((it) => (it.kind === 'final' ? '' : `${nameIn(it.a)} vs ${nameIn(it.b)}`)) : []);
  const title = $derived(lines ? 'Three-line duels' : final ? 'One prompt for everyone' : 'Write your answers');
  const sub = $derived(lines ? 'Check your phone: one prompt per duel, up to three short lines each.'
    : final ? 'Same prompt on every phone. Make it count: every vote is worth points.'
    : `Check your phone: two prompts each${game.round === 2 ? ', and points count double this round' : ''}.`);
  const writers = $derived(present(game).filter((p) => p.active));
  const late = $derived(present(game).filter((p) => !p.active));
  const doneCount = $derived(writers.filter((p) => tasksFor(game, p.pid).length === 0).length);
</script>

<div class="write">
  <div class="top">
    <div>
      <h1 class="pop-in">{title}</h1>
      <p class="sub">{sub}</p>
      {#if pairs.length}
        <ul class="pairs" aria-label="Duels">{#each pairs as p, k (k)}<li>{p}</li>{/each}</ul>
      {/if}
    </div>
    <Timer {left} {total} paused={game.paused !== null} size={112} />
  </div>

  <p class="tally" aria-live="polite">{doneCount} of {writers.length} done</p>
  <ul class="grid">
    {#each writers as p (p.pid)}
      {@const todo = tasksFor(game, p.pid).length}
      {@const all = promptCount(game, p.pid)}
      {@const here = online.has(p.pid)}
      <li class:done={todo === 0} class="pop-in">
        <Avatar name={p.name} color={p.color} size={56} dim={!here && todo > 0} />
        <span class="who">
          <span class="name">{p.name}</span>
          <span class="state">
            {#if todo === 0}✓ Done{:else if !here}Away (phone off){:else}✎ Writing{all > 1 ? ` · ${all - todo} of ${all} done` : ''}{/if}
          </span>
        </span>
      </li>
    {/each}
  </ul>
  {#if late.length}<p class="late faint">Joining next round: {late.map((p) => p.name).join(', ')}</p>{/if}
</div>

<style>
  .write { flex: 1; display: flex; flex-direction: column; gap: var(--s-4); width: min(100%, 1100px); margin: 0 auto; padding: var(--s-4) 0; }
  .top { display: flex; align-items: center; justify-content: space-between; gap: var(--s-4); }
  h1 { font-size: clamp(calc(2 * var(--rem-far)), 6.5vmin, calc(4 * var(--rem-far))); line-height: 1.05; }
  .sub { color: var(--text-dim); font-size: clamp(var(--rem-far), 2.6vmin, calc(1.5 * var(--rem-far))); margin-top: var(--s-2); }
  .pairs { list-style: none; margin: var(--s-3) 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--s-2); }
  .pairs li { padding: 4px 14px; border-radius: var(--r-pill); background: var(--overlay); font-weight: 700; font-size: clamp(calc(0.95 * var(--rem-far)), 2vmin, calc(1.2 * var(--rem-far))); }
  .tally { font-weight: 700; color: var(--text-dim); font-size: clamp(var(--rem-far), 2.2vmin, calc(1.3 * var(--rem-far))); }
  .grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr)); gap: var(--s-3); }
  li {
    display: flex; align-items: center; gap: var(--s-3); padding: clamp(10px, 2vmin, 20px) var(--s-4); border-radius: var(--r-lg);
    background: var(--surface); border: 2px solid var(--line); transition: border-color var(--dur) ease, background var(--dur) ease;
  }
  li.done { border-color: var(--c-good); background: color-mix(in srgb, var(--c-good) 12%, var(--surface)); }
  .who { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .name { font-weight: 800; font-size: clamp(calc(1.15 * var(--rem-far)), 3vmin, calc(1.7 * var(--rem-far))); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .state { color: var(--text-dim); font-weight: 700; font-size: clamp(calc(0.9 * var(--rem-far)), 2vmin, calc(1.1 * var(--rem-far))); }
  li.done .state { color: var(--c-good); }
  .late { font-size: 1rem; }
</style>
