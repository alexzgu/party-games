<script lang="ts">
  import Button from '../../components/Button.svelte';
  import TapToFinish from '../../components/room/TapToFinish.svelte';
  import Timer from '../../components/room/Timer.svelte';
  import Avatar from '../../components/room/Avatar.svelte';
  import CardFan from '../../components/cards/CardFan.svelte';
  import { RANKS } from '../../lib/cards/deck';
  import Books from './Books.svelte';
  import Standings from './Standings.svelte';
  import { nameIn, nextLine, said, seatStatus } from './labels';
  import type { View } from './view';

  // The table, made to read from across a room: whose turn it is or the outcome of the ask in play,
  // large; every player with a fan of backs, their count and their books; the pool and the last
  // few outcomes in the middle. Nobody's cards show. Then the end.
  let { v, online, onnext, onagain, onclose }: {
    v: View; online?: ReadonlySet<string>; onnext: () => void; onagain: () => void; onclose: () => void;
  } = $props();
  const name = $derived(nameIn(v));
  const down = $derived(v.players.reduce((n, p) => n + p.books.length, 0));
  const shownN = $derived(new Set(v.shown?.map((e) => e.n) ?? []));
  const earlier = $derived(v.log.filter((e) => !shownN.has(e.n)).slice(-4).reverse());
  const after = $derived(nextLine(v, name));
</script>

<main class="stage">
  <TapToFinish>
    {#if v.phase === 'over'}
      <Standings {v} size="lg" />
      <div class="next">
        <Button size="lg" onclick={onagain} tip="Back to the lobby with the same players for a fresh deal">Lobby</Button>
        <Button size="lg" variant="secondary" onclick={onclose} tip="Sends every phone back to the start, after asking">Close</Button>
      </div>
    {:else}
      <div class="head">
        {#key v.at}
          <div class="now pop-in" role="status">
            {#if v.phase === 'show' && v.shown}
              {#each v.shown as e (e.n)}<h2>{said(e, name)}</h2>{/each}
              {#if after}<p class="note">{after}</p>{/if}
            {:else if v.turn}
              <h2><span class="who">{name(v.turn)}</span>’s turn</h2>
              <p class="note">Tap a card, a player, then Ask on your phone.</p>
            {/if}
          </div>
        {/key}
        {#if v.paused}<b class="paused">Paused</b>{/if}
        <Timer left={v.left} total={v.total} paused={v.paused} size={64} />
      </div>
      <div class="board">
        <ul class="table" aria-label="The table">
          {#each v.players as p, i (p.pid)}
            {@const status = seatStatus(v, p.pid, online)}
            <li class:turn={v.turn === p.pid} class:out={p.out || p.watching}>
              <div class="who-row">
                <Avatar name={p.name} color={i} size={32} dim={online ? !online.has(p.pid) : false} />
                <strong>{p.name}</strong>
                {#if status}<span class="status">{status}</span>{/if}
              </div>
              {#if !p.out && !p.watching}<CardFan backs={p.cards} size="sm" />{/if}
              <Books books={p.books} />
            </li>
          {/each}
        </ul>
        <aside class="middle">
          <div class="pool">
            {#if v.pool}<CardFan backs={v.pool} size="md" />{:else}<span class="empty">Empty</span>{/if}
            <span>Pool</span>
          </div>
          <p class="count">{down} of {RANKS} books down</p>
          {#if earlier.length}
            <ol class="log" aria-label="Before that">
              {#each earlier as e (e.n)}<li>{said(e, name)}</li>{/each}
            </ol>
          {/if}
        </aside>
      </div>
      {#if v.phase === 'show'}<div class="next"><Button size="lg" onclick={onnext}>Next</Button></div>{/if}
    {/if}
  </TapToFinish>
</main>

<style>
  .stage { flex: 1; display: grid; align-content: start; gap: var(--s-3); width: min(100%, 1400px); margin-inline: auto; padding-bottom: var(--s-3); }
  .head { display: flex; align-items: center; gap: var(--s-3); min-height: 5.5rem; }
  .now { flex: 1; min-width: 0; display: grid; gap: var(--s-1); }
  h2 { font-size: clamp(1.3rem, 2.6vw, 2.4rem); line-height: 1.15; overflow-wrap: anywhere; }
  .who { color: var(--accent); }
  .note { color: var(--text-dim); font-size: clamp(1rem, 1.5vw, 1.3rem); }
  .paused { color: var(--c-pass); font: 800 clamp(1rem, 2vw, 1.6rem) / 1 var(--font-display); }
  .board { display: grid; grid-template-columns: minmax(0, 1fr) minmax(240px, 300px); gap: var(--s-4); align-items: start; }
  .table { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--s-2); grid-template-columns: repeat(auto-fill, minmax(min(100%, 270px), 1fr)); }
  .table li { display: grid; gap: var(--s-2); align-content: start; padding: var(--s-2) var(--s-3); border: 3px solid var(--line); border-radius: var(--r-md); background: var(--surface); min-width: 0; }
  .table li.turn { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, var(--surface)); }
  .table li.out { opacity: 0.6; }
  .who-row { display: flex; align-items: center; gap: var(--s-2); min-width: 0; }
  .who-row strong { flex: 1; min-width: 0; overflow-wrap: anywhere; line-height: 1.2; }
  .status { flex: none; color: var(--text-dim); font-size: 0.9rem; font-weight: 700; }
  .turn .status { color: var(--accent); }
  .middle { display: grid; gap: var(--s-2); justify-items: center; padding: var(--s-3); border-radius: var(--r-md); background: var(--bg-sunk); }
  .pool { display: grid; justify-items: center; gap: var(--s-1); font-weight: 700; color: var(--text-dim); }
  .empty { display: grid; place-items: center; width: var(--card-w-md); aspect-ratio: 5 / 7; border: 2px dashed var(--line-strong); border-radius: var(--r-sm); font-size: 0.8rem; }
  .count { color: var(--text-dim); font-weight: 600; }
  .log { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--s-1); width: 100%; color: var(--text-dim); font-size: 0.95rem; }
  .log li { padding-top: var(--s-1); border-top: 1px solid var(--line); overflow-wrap: anywhere; }
  .next { display: grid; width: min(100%, 420px); margin-inline: auto; }
  @media (max-width: 860px) { .board { grid-template-columns: 1fr; } }
</style>
