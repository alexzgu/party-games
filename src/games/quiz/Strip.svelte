<script lang="ts">
  import { points, scores, signed, type Game } from './logic';
  import { teamColor } from './look';

  // Every team's score, always on screen. Tapping a team opens the score fix.
  // `flash` floats the last change (+300, −200) over that team; `n` restarts it.
  let { game, flash = null, onfix }: {
    game: Game;
    flash?: { team: number; delta: number; n: number } | null;
    onfix: (team: number) => void;
  } = $props();
  const s = $derived(scores(game));
</script>

<ol class="strip" style:--n={game.teams.length} aria-label="Scores">
  {#each game.teams as name, i (i)}
    <li style:--team={teamColor(i)}>
      <button onclick={() => onfix(i)} aria-label="{name}: {points(s[i])} points. Fix score">
        <span class="name">{name}</span>
        <b class="score" class:neg={s[i] < 0}>{points(s[i])}</b>
      </button>
      {#if flash && flash.team === i}
        {#key flash.n}
          <span class="float" class:down={flash.delta < 0} aria-hidden="true">{signed(flash.delta)}</span>
        {/key}
      {/if}
    </li>
  {/each}
</ol>

<style>
  .strip {
    list-style: none; margin: 0; padding: 0;
    display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: clamp(6px, 1vmin, 14px);
  }
  li { position: relative; min-width: 0; }
  button {
    width: 100%; height: 100%; min-height: 60px; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 0; padding: clamp(4px, 1vmin, 12px) var(--s-2); border-radius: var(--r-md); color: var(--text);
    background: color-mix(in srgb, var(--team) 12%, var(--bg-raised));
    border: 2px solid color-mix(in srgb, var(--team) 55%, transparent);
    border-top-width: 5px; border-top-color: var(--team);
    transition: transform var(--dur-fast) var(--ease-out);
  }
  button:active { transform: scale(0.97); }
  .name {
    max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    font-weight: 700; font-size: clamp(0.8rem, 1.9vmin, 1.5rem); color: var(--text-dim);
  }
  .score {
    font-family: var(--font-display); font-weight: 800; line-height: 1.05; font-variant-numeric: tabular-nums;
    font-size: clamp(1.35rem, 5vmin, 3.6rem); letter-spacing: -0.02em;
  }
  .score.neg { color: var(--c-bad); }
  .float {
    position: absolute; left: 50%; top: 0; translate: -50% 0; pointer-events: none;
    font-family: var(--font-display); font-weight: 800; font-size: clamp(1.3rem, 4.5vmin, 3rem); color: var(--c-good);
    animation: float 1.4s var(--ease-out) both;
  }
  .float.down { color: var(--c-bad); }
  @keyframes float {
    from { opacity: 0; transform: translateY(10px) scale(0.6); }
    25% { opacity: 1; transform: translateY(-70%) scale(1.15); }
    to { opacity: 0; transform: translateY(-130%); }
  }
  @media (prefers-reduced-motion: reduce) { .float { animation: none; opacity: 0; } }
</style>
