<script lang="ts">
  import Button from '../../components/Button.svelte';
  import TapToFinish from '../../components/room/TapToFinish.svelte';
  import Timer from '../../components/room/Timer.svelte';
  import Avatar from '../../components/room/Avatar.svelte';
  import CardFan from '../../components/cards/CardFan.svelte';
  import DealResult from './DealResult.svelte';
  import Standings from './Standings.svelte';
  import TablePlay from './TablePlay.svelte';
  import { nameIn, said, seatStatus } from './labels';
  import type { View } from './view';

  // The table, made to read from across a room: whose turn it is, large; every player in seat
  // order with a fan of backs, their count and points; the play to beat face up in the middle and
  // the last few events beside it. Nobody's hand shows. Between deals the result; then the end.
  let { v, online, onnext, onagain, onclose }: {
    v: View; online?: ReadonlySet<string>; onnext: () => void; onagain: () => void; onclose: () => void;
  } = $props();
  const name = $derived(nameIn(v));
  const recent = $derived(v.log.filter((e) => e.k !== 'deal').slice(-4).reverse());
</script>

<main class="stage">
  <TapToFinish>
    {#if v.phase === 'over'}
      <Standings {v} size="lg" />
      <div class="next">
        <Button size="lg" onclick={onagain} tip="Back to the lobby with the same players for a fresh game">Lobby</Button>
        <Button size="lg" variant="secondary" onclick={onclose} tip="Sends every phone back to the start, after asking">Close</Button>
      </div>
    {:else}
      <div class="head">
        {#key v.at}
          <div class="now pop-in" role="status">
            {#if v.phase === 'result'}
              <h2>Deal {v.deal} of {v.deals} done</h2>
              <p class="note">Deal {v.deal + 1} comes next.</p>
            {:else if v.turn}
              <h2><span class="who">{name(v.turn)}</span>’s turn</h2>
              <p class="note">Deal {v.deal} of {v.deals} · {v.table ? 'Beat the table, or pass.' : 'A new trick: any play.'}</p>
            {/if}
          </div>
        {/key}
        {#if v.paused}<b class="paused">Paused</b>{/if}
        <Timer left={v.left} total={v.total} paused={v.paused} size={64} />
      </div>
      <ul class="seats" aria-label="The table">
        {#each v.players as p, i (p.pid)}
          {@const status = seatStatus(v, p.pid, online)}
          <li class:turn={v.turn === p.pid} class:out={p.out || p.watching} class:passed={p.passed}>
            <div class="who-row">
              <Avatar name={p.name} color={i} size={28} dim={online ? !online.has(p.pid) : false} />
              <strong>{p.name}</strong>
              {#if status}<span class="status">{status}</span>{/if}
            </div>
            <div class="hold">
              {#if !p.out && !p.watching}<CardFan backs={p.cards} size="sm" />{:else}<span></span>{/if}
              <span class="points">{p.points} {p.points === 1 ? 'pt' : 'pts'}</span>
            </div>
          </li>
        {/each}
      </ul>
      {#if v.phase === 'result'}
        <DealResult {v} {name} size="lg" />
        <div class="next"><Button size="lg" onclick={onnext}>Next deal</Button></div>
      {:else}
        <div class="middle">
          <TablePlay {v} {name} size="lg" />
          {#if recent.length}
            <ol class="log" aria-label="Last plays">
              {#each recent as e (e.n)}<li>{said(e, name)}</li>{/each}
            </ol>
          {/if}
        </div>
      {/if}
    {/if}
  </TapToFinish>
</main>

<style>
  .stage { flex: 1; display: grid; align-content: start; gap: var(--s-3); width: min(100%, 1400px); margin-inline: auto; padding-bottom: var(--s-3); }
  .head { display: flex; align-items: center; gap: var(--s-3); min-height: 4.5rem; }
  .now { flex: 1; min-width: 0; display: grid; gap: var(--s-1); }
  h2 { font-size: clamp(1.3rem, calc(2.6vw * var(--text-scale)), 2.4rem); line-height: 1.15; overflow-wrap: anywhere; }
  .who { color: var(--accent); }
  .note { color: var(--text-dim); font-size: clamp(1rem, calc(1.4vw * var(--text-scale)), 1.2rem); }
  .paused { color: var(--c-pass); font: 800 clamp(1rem, calc(2vw * var(--text-scale)), 1.6rem) / 1 var(--font-display); }
  .seats { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--s-2); grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr)); }
  .seats li { display: grid; gap: var(--s-1); align-content: start; padding: var(--s-2) var(--s-3); border: 3px solid var(--line); border-radius: var(--r-md); background: var(--surface); min-width: 0; }
  .seats li.turn { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, var(--surface)); }
  .seats li.out, .seats li.passed { opacity: 0.6; }
  .who-row { display: flex; align-items: center; gap: var(--s-2); min-width: 0; }
  .who-row strong { flex: 1; min-width: 0; overflow-wrap: anywhere; line-height: 1.2; }
  .status { flex: none; color: var(--text-dim); font-size: 0.9rem; font-weight: 700; }
  .turn .status { color: var(--accent); }
  .hold { display: flex; align-items: center; justify-content: space-between; gap: var(--s-2); }
  .points { color: var(--text-dim); font-weight: 700; }
  .middle { display: grid; grid-template-columns: minmax(0, 1fr) minmax(220px, 300px); gap: var(--s-4); align-items: center; padding: var(--s-3); border-radius: var(--r-md); background: var(--bg-sunk); min-height: 11rem; }
  .log { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--s-1); color: var(--text-dim); font-size: 0.95rem; }
  .log li { padding-top: var(--s-1); border-top: 1px solid var(--line); overflow-wrap: anywhere; }
  .next { display: grid; width: min(100%, 420px); margin-inline: auto; gap: var(--s-2); }
  @media (max-width: 760px) { .middle { grid-template-columns: 1fr; } }
</style>
