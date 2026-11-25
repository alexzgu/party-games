<script lang="ts">
  import { tick } from 'svelte';
  import { leaders, points, scores, signed, type Game } from './logic';
  import { teamColor } from './look';

  // Every team's score, always on screen. Tapping a team opens the score fix.
  // `flash` floats the last change (+300, −200) over that team; `n` restarts it.
  // Up to four teams get big score boxes. More get compact chips: on a phone two rows up to
  // eight teams, then one row that scrolls sideways with the leader pinned at its start;
  // on a wide screen up to ten across, then two even rows.
  let { game, flash = null, onfix }: {
    game: Game;
    flash?: { team: number; delta: number; n: number } | null;
    onfix: (team: number) => void;
  } = $props();
  const s = $derived(scores(game));
  const n = $derived(game.teams.length);
  const top = $derived(leaders(game));
  const size = $derived(n <= 4 ? 'big' : n <= 8 ? 'mid' : 'many');
  const wideCols = $derived(n <= 10 ? n : Math.ceil(n / 2));
  let list = $state<HTMLOListElement>();

  // In the sideways row a changed score may be out of view: bring it in.
  $effect(() => {
    if (!flash || size !== 'many') return;
    const team = flash.team;
    void tick().then(() => list?.querySelector(`[data-team="${team}"]`)?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' }));
  });
</script>

<div class="wrap {size}">
  {#if size === 'many' && top.length === 1}
    <!-- A sole leader is pinned here instead of in the row (on a phone), so it shows once. -->
    {@const t = top[0]}
    <button class="lead" style:--team={teamColor(t)} onclick={() => onfix(t)} aria-label="{game.teams[t]}: {points(s[t])} points, leading. Fix score" data-tip="Fix this team's score">
      <span class="lname"><span class="crown" aria-hidden="true">👑</span>{game.teams[t]}</span>
      <b>{points(s[t])}</b>
      {#if flash && flash.team === t}{#key flash.n}<span class="float" class:down={flash.delta < 0} aria-hidden="true">{signed(flash.delta)}</span>{/key}{/if}
    </button>
  {:else if size === 'many' && top.length}
    <p class="lead" style:--team="var(--accent)" aria-label="Leading">
      <span class="lname"><span class="crown" aria-hidden="true">👑</span>{top.length} tied</span>
      <b>{points(s[top[0]])}</b>
    </p>
  {/if}
  <ol class="strip" bind:this={list} style:--n={n} style:--wide={wideCols} style:--phone={size === 'mid' ? Math.ceil(n / 2) : n} aria-label="Scores">
    {#each game.teams as name, i (i)}
      <li style:--team={teamColor(i)} data-team={i} class:pinned={size === 'many' && top.length === 1 && top[0] === i}>
        <button onclick={() => onfix(i)} aria-label="{name}: {points(s[i])} points{top.includes(i) && n > 1 ? ', leading' : ''}. Fix score" data-tip="Fix this team's score">
          <span class="name">{#if size !== 'big' && top.includes(i)}<span class="crown" aria-hidden="true">👑</span>{/if}{name}</span>
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
</div>

<style>
  .wrap { display: flex; gap: 6px; min-width: 0; }
  .strip {
    flex: 1; min-width: 0; list-style: none; margin: 0; padding: 0;
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
    font-weight: 700; font-size: clamp(calc(0.8 * var(--rem-far)), 1.9vmin, calc(1.5 * var(--rem-far))); color: var(--text-dim);
  }
  /* Big boxes (up to four teams) give a long name a second line instead of cutting it. */
  .big .name { white-space: normal; text-overflow: clip; overflow-wrap: break-word; line-height: 1.1; text-align: center;
    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; }
  .crown { margin-right: 2px; font-size: 0.85em; }
  .score {
    font-family: var(--font-display); font-weight: 800; line-height: 1.05; font-variant-numeric: tabular-nums;
    font-size: clamp(calc(1.35 * var(--rem-far)), 5vmin, calc(3.6 * var(--rem-far))); letter-spacing: -0.02em;
  }
  .score.neg { color: var(--c-bad); }

  /* Compact chips (five teams or more). */
  .mid .strip, .many .strip { gap: 6px; }
  .mid button, .many button { min-height: var(--tap-sm); padding: 3px 6px; border-width: 1.5px; border-top-width: 4px; border-radius: var(--r-sm); }
  .mid .name, .many .name { font-size: clamp(calc(0.72 * var(--rem-far)), 1.6vmin, calc(1.05 * var(--rem-far))); }
  .mid .score, .many .score { font-size: clamp(calc(1.05 * var(--rem-far)), 3vmin, calc(2 * var(--rem-far))); }
  .mid .strip { grid-template-columns: repeat(var(--phone), minmax(0, 1fr)); }
  .many .strip {
    display: flex; overflow-x: auto; overscroll-behavior-x: contain; scroll-snap-type: x proximity; scrollbar-width: none;
  }
  .many .strip::-webkit-scrollbar { display: none; }
  .many li { flex: none; width: 96px; scroll-snap-align: start; }
  .many li.pinned { display: none; }
  .lead {
    position: relative; flex: none; width: 104px; color: var(--text); min-height: var(--tap-sm); margin: 0; padding: 3px 6px; border-radius: var(--r-sm);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: color-mix(in srgb, var(--team) 22%, var(--bg-raised)); border: 2px solid var(--team);
  }
  .lname { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.72rem; font-weight: 800; color: var(--team); }
  .lead b { font-family: var(--font-display); font-weight: 800; font-size: 1.05rem; line-height: 1.05; font-variant-numeric: tabular-nums; }
  @media (min-width: 700px) {
    .mid .strip, .many .strip { display: grid; grid-template-columns: repeat(var(--wide), minmax(0, 1fr)); overflow: visible; }
    .many li { width: auto; }
    .many li.pinned { display: block; }
    .lead { display: none; }
  }

  .float {
    position: absolute; left: 50%; top: 0; translate: -50% 0; pointer-events: none;
    font-family: var(--font-display); font-weight: 800; font-size: clamp(calc(1.3 * var(--rem-far)), 4.5vmin, calc(3 * var(--rem-far))); color: var(--c-good);
    animation: float 1.4s var(--ease-out) both;
  }
  .float.down { color: var(--c-bad); }
  @keyframes float {
    from { opacity: 0; transform: translateY(10px) scale(0.6); }
    25% { opacity: 1; transform: translateY(-70%) scale(1.15); }
    to { opacity: 0; transform: translateY(-130%); }
  }
  /* A sideways-scrolling row clips anything above it, so there the change shows on the chip itself. */
  .many .float {
    top: 50%; translate: -50% -50%; padding: 0 8px; border-radius: var(--r-pill);
    background: var(--bg-raised); font-size: 1.3rem; animation-name: badge;
  }
  @media (min-width: 700px) { .many .float { top: 0; translate: -50% 0; padding: 0; background: none; animation-name: float; font-size: clamp(calc(1.3 * var(--rem-far)), 4.5vmin, calc(3 * var(--rem-far))); } }
  @keyframes badge {
    from { opacity: 0; transform: scale(0.6); }
    20% { opacity: 1; transform: scale(1.1); }
    70% { opacity: 1; transform: scale(1); }
    to { opacity: 0; }
  }
  /* A phone on its side: the scores run down the column beside the board and share its height,
     one team per row up to four, then two columns with the leader in its place; a change shows
     on the team's own box, where the column cannot clip it. */
  @media (orientation: landscape) and (max-height: 500px) {
    .wrap { flex: 1 1 auto; min-height: 0; }
    .strip, .mid .strip, .many .strip {
      display: grid; overflow: visible; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: minmax(48px, 1fr); gap: 6px;
    }
    .big .strip { grid-template-columns: minmax(0, 1fr); grid-auto-rows: minmax(60px, 1fr); }
    .big .score { font-size: clamp(calc(1.35 * var(--rem-far)), 8dvh, calc(2.4 * var(--rem-far))); }
    .many li { width: auto; }
    .many li.pinned { display: block; }
    .lead { display: none; }
    .float, .many .float {
      top: 50%; translate: -50% -50%; padding: 0 8px; border-radius: var(--r-pill);
      background: var(--bg-raised); font-size: 1.3rem; animation-name: badge;
    }
  }
  @media (prefers-reduced-motion: reduce) { .float { animation: none; opacity: 0; } }
</style>
