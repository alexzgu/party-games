<script lang="ts">
  import Button from '../../components/Button.svelte';
  import Confetti from '../../components/room/Confetti.svelte';
  import Avatar from '../../components/room/Avatar.svelte';
  import type { Game } from './logic';
  import { leaders, place, pts, standings } from './record';
  import { playerColor } from './look';

  // Game over on the host screen: the winner big, confetti in their colour, final standings.
  let { game, onagain, onclose }: { game: Game; onagain: () => void; onclose: () => void } = $props();

  const rows = $derived(standings(game));
  const top = $derived(leaders(game));
  const color = $derived(top.length === 1 ? playerColor(top[0].color) : 'var(--accent)');
  const names = $derived(top.map((p) => p.name));
  let confetti = $state(true);
</script>

<svelte:window onpointerdown={() => (confetti = false)} />

{#if confetti && top.length}<Confetti colors={[color, color, 'var(--c-gold)', ...rows.map((p) => playerColor(p.color))]} />{/if}

<div class="over fade-in" style:--win={color}>
  <div class="trophy pop-in" aria-hidden="true">{top.length ? '🏆' : '🤷'}</div>
  <h1 class="pop-in" style:animation-delay="120ms">
    {#if top.length === 1}<span>{names[0]}</span> wins!
    {:else if top.length > 1}It's a tie!<span class="tie">{names.length < 3 ? names.join(' & ') : `${names.slice(0, -1).join(', ')} & ${names.at(-1)}`}</span>
    {:else}Nobody scored{/if}
  </h1>
  <ol class="final" aria-label="Final scores">
    {#each rows as p, k (p.pid)}
      <li class="pop-in" class:lead={top.some((t) => t.pid === p.pid)} style:--who={playerColor(p.color)} style:animation-delay="{300 + k * 110}ms">
        <span class="place">{place(game, p.score)}</span>
        <Avatar name={p.name} color={p.color} size={36} />
        <span class="pname">{p.name}</span>
        <b>{pts(p.score)}</b>
      </li>
    {/each}
  </ol>
  <div class="actions pop-in" style:animation-delay="{400 + rows.length * 110}ms">
    <Button size="lg" onclick={onagain}>Play again, same players</Button>
    <Button variant="ghost" onclick={onclose}>Close the room</Button>
  </div>
</div>

<style>
  .over { position: relative; isolation: isolate; flex: 1; width: min(100%, 760px); margin: 0 auto; display: flex; flex-direction: column; align-items: center; gap: clamp(10px, 2vmin, 22px); text-align: center; padding-top: clamp(8px, 3vmin, 40px); }
  .over::before { content: ''; position: fixed; inset: 0; z-index: -1; pointer-events: none; background: radial-gradient(110% 55% at 50% 0%, color-mix(in srgb, var(--win) 30%, transparent), transparent 75%), var(--bg); }
  .trophy { font-size: clamp(3.5rem, 11vmin, 7rem); line-height: 1; }
  h1 { font-size: clamp(2.2rem, 7.5vmin, 5rem); line-height: 1.02; }
  h1 span { display: block; color: var(--win); overflow-wrap: anywhere; text-shadow: 0 0 36px color-mix(in srgb, var(--win) 50%, transparent); }
  h1 .tie { font-size: 0.6em; margin-top: var(--s-2); }
  .final { list-style: none; margin: 0; padding: 0; width: 100%; display: flex; flex-direction: column; gap: var(--s-2); }
  li { display: flex; align-items: center; gap: var(--s-3); padding: clamp(6px, 1.2vmin, 12px) var(--s-4); border-radius: var(--r-md); background: var(--surface); border: 2px solid transparent; font-weight: 800; font-size: clamp(1.05rem, 2.6vmin, 1.7rem); }
  li.lead { border-color: var(--who); background: color-mix(in srgb, var(--who) 16%, var(--surface)); }
  .place { width: 1.4em; color: var(--text-faint); font-family: var(--font-display); }
  .pname { flex: 1; min-width: 0; text-align: left; color: var(--who); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  b { font-family: var(--font-display); font-variant-numeric: tabular-nums; }
  .actions { width: min(100%, 460px); margin-top: auto; display: flex; flex-direction: column; gap: var(--s-2); padding-bottom: var(--s-2); }
  @media (min-width: 700px) {
    .actions { width: min(100%, 720px); flex-direction: row; }
    .actions > :global(*) { flex: 1; }
  }
</style>
