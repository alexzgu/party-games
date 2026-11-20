<script lang="ts">
  import type { PlayerView } from './view';

  let { result, players, presenter }: {
    result: NonNullable<PlayerView['result']>; players: PlayerView['players']; presenter?: string;
  } = $props();
  const name = (pid: string) => players.find((p) => p.pid === pid)?.name ?? 'Player';
</script>

<section class="pop-in" aria-label="Turn result">
  <p class="outcome">
    {#if result.winner}
      {name(result.winner)} solved it
    {:else if result.reason === 'offline'}
      Presenter disconnected
    {:else if result.reason === 'skipped'}
      Turn skipped
    {:else}
      Time’s up
    {/if}
  </p>
  <h2>{result.answer}</h2>
  {#if result.winningGuess && result.winningGuess !== result.answer}
    <p class="muted">Accepted guess “{result.winningGuess}”</p>
  {/if}
  {#if result.winner}
    <ul aria-label="Points awarded">
      {#each Object.entries(result.points) as [pid, points] (pid)}
        <li>
          <b>{name(pid)}</b>
          <span>
            {#if pid === presenter}Presenter
            {:else if pid === result.winner}
              Correct guess{result.assistPoints[pid] ? ` + ${result.assistPoints[pid]} assist points` : ''}
            {:else}Assist{/if}
          </span>
          <strong>+{points.toLocaleString()}</strong>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="muted">No points this turn.</p>
  {/if}
</section>

<style>
  section {
    display: grid; gap: var(--s-3); padding: var(--s-5); background: var(--surface);
    border: 2px solid var(--line); border-radius: var(--r-lg); text-align: center;
  }
  h2 { font-size: var(--answer-size, 2rem); overflow-wrap: anywhere; line-height: 1.03; }
  .outcome { color: var(--accent); font-weight: 700; }
  ul { display: grid; gap: var(--s-2); padding: 0; margin: 0; list-style: none; }
  li { display: flex; flex-wrap: wrap; gap: var(--s-2); text-align: left; align-items: baseline; }
  li b { overflow-wrap: anywhere; }
  li span { color: var(--text-dim); }
  strong { margin-left: auto; font-variant-numeric: tabular-nums; }
</style>
