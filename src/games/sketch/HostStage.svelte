<script lang="ts">
  import InkCard from '../../components/draw/InkCard.svelte';
  import type { Drawing } from '../../lib/ink';
  import Players from './Players.svelte';
  import Album from './Album.svelte';
  import Feed from './Feed.svelte';
  import Reveal from './Reveal.svelte';
  import Standings from './Standings.svelte';
  import WordShape from './WordShape.svelte';
  import type { View } from './view';
  // The host screen during a game, phase by phase.
  let { v, art, online }: { v: View; art: Record<string, Drawing>; online?: ReadonlySet<string> } = $props();
  const name = (pid?: string) => v.players.find((p) => p.pid === pid)?.name ?? 'The drawer';
  function stepStatus(pid: string) {
    if (!v.order?.includes(pid)) return 'Plays next game';
    return v.done?.includes(pid) ? 'Done ✓' : online && !online.has(pid) ? 'Away' : 'Working…';
  }
  const scoreStatus = (pid: string) => `${v.players.find((p) => p.pid === pid)?.score.toLocaleString() ?? 0} pts`;
</script>

{#if v.phase === 'write' || v.phase === 'draw' || v.phase === 'describe'}
  <p class="lead">{v.done?.length ?? 0} done{v.waiting ? ` · waiting for ${v.waiting}` : ''}</p>
  <Players players={v.players} {online} status={stepStatus} />
{:else if v.phase === 'album' && v.album}
  <Album album={v.album} {art} />
{:else if v.phase === 'pick'}
  <p class="lead"><b>{name(v.drawer)}</b> is choosing a word…</p>
  <Players players={v.players} {online} status={scoreStatus} />
{:else if v.phase === 'guess'}
  <div class="live">
    <div class="pic"><InkCard drawing={v.ink ? art[v.ink] ?? [] : []} label="{name(v.drawer)}’s drawing" /></div>
    <div class="side">
      <p><b>{name(v.drawer)}</b> is drawing</p>
      <WordShape shape={v.shape} size="lg" />
      <p class="muted">{v.got?.length ?? 0} of {v.guessers ?? 0} got it</p>
      <Feed feed={v.feed ?? []} />
    </div>
  </div>
{:else if v.phase === 'reveal'}
  <Reveal {v} {art} />
{:else if v.phase === 'scores' || v.phase === 'over'}
  <Standings {v} />
{/if}

<style>
  .lead { text-align: center; font-size: 1.2rem; }
  .live { display: grid; grid-template-columns: minmax(0, 3fr) minmax(220px, 2fr); gap: var(--s-4); align-items: start; min-height: 0; height: 100%; }
  .pic { width: min(100%, calc(100dvh - 190px)); justify-self: center; }
  .side { display: grid; grid-template-rows: auto auto auto minmax(0, 1fr); gap: var(--s-2); min-height: 0; max-height: calc(100dvh - 190px); text-align: center; }
  @media (max-width: 720px) {
    .live { grid-template-columns: 1fr; height: auto; }
    .pic { width: min(100%, 60dvh); }
    .side { max-height: none; }
    .side :global(ol) { max-height: 30dvh; }
  }
</style>
