<script lang="ts">
  import InkCard from './InkCard.svelte';
  import Button from '../../components/Button.svelte';
  import Avatar from '../../components/room/Avatar.svelte';
  import Confetti from '../../components/room/Confetti.svelte';
  import { ordinal } from '../../lib/room/look';
  import type { Drawing } from './ink';
  import type { Side } from './logic';
  import type { View } from './view';
  let { v, art, online, onvote, ontag }: {
    v: View; art: Record<string, Drawing>; online?: ReadonlySet<string>;
    onvote?: (side: Side) => void; ontag?: (id: string) => void;
  } = $props();
  const name = (id: string) => v.players.find((p) => p.pid === id)?.name ?? 'Artist';
</script>

{#snippet fighter(f: NonNullable<View['cards']>[number])}
  <div class="fighter">
    {#if f}<InkCard drawing={art[f.id]} /><strong>{f.name}</strong>
    {:else}<div class="blank">Blank fighter</div>{/if}
  </div>
{/snippet}

{#if v.phase === 'lobby' || v.phase === 'draw' || v.phase === 'challenge'}
  {#if v.phase !== 'lobby'}<p>Waiting for fighters</p>{/if}
  <ul class="players">
    {#each v.players as p, i (p.pid)}
      <li>
        <Avatar name={p.name} color={i} size={36} dim={online ? !online.has(p.pid) : false} />
        <strong>{p.name}</strong>
        {#if v.progress?.includes(p.pid)}<span>Ready</span>
        {:else if online && !online.has(p.pid)}<span>Away</span>{/if}
      </li>
    {/each}
  </ul>
{:else if v.phase === 'vote' || v.phase === 'payout' || v.phase === 'tag'}
  <div class="faceoff">
    {#each v.cards ?? [] as f, i (i)}
      <div class="side">
        {@render fighter(f)}
        {#if v.vote && onvote}
          <Button disabled={v.paused} onclick={() => onvote?.(i as Side)}>Vote for {f?.name}</Button>
        {:else if v.result}
          {#if v.result.winner === i}<b class="winner">Winner</b>{/if}
          <p>{name(v.result.artists[i])} · {v.result.votes[i]} votes · +{v.result.points[i].toLocaleString()} pts</p>
        {:else if v.phase === 'tag' && v.progress?.length}
          <p>{v.picks?.[i] ? (v.picks[i]?.id === f?.id ? 'Keeping ' : 'Tagging in ') + v.picks[i]?.name : 'Choosing a fighter'}</p>
        {/if}
      </div>
    {/each}
  </div>
  {#if v.phase === 'vote' && (!v.vote || !onvote)}
    <p>{v.progress?.length ?? 0} voted</p>
  {/if}
  {#if v.phase === 'tag'}
    {#if v.options && ontag}
      <Button disabled={v.paused} onclick={() => ontag?.('')}>Keep my fighter</Button>
      {#if v.options.length}<h3>Or tag in a fighter</h3>{/if}
      <div class="gallery">
        {#each v.options as f (f.id)}
          <button class="tag" disabled={v.paused} onclick={() => ontag?.(f.id)} aria-label="Tag in {f.name}">
            {@render fighter(f)}
          </button>
        {/each}
      </div>
    {:else}<p>{v.progress?.length ?? 0} of 2 artists ready</p>{/if}
  {/if}
{:else if v.phase === 'scores' || v.phase === 'over'}
  {#if v.phase === 'over'}
    <Confetti colors={['var(--accent)', 'var(--c-good)', 'var(--c-pass)']} />
    <h3 class="winner">{v.players.filter((p) => p.score === v.players[0]?.score).map((p) => p.name).join(' & ')} win{v.players.filter((p) => p.score === v.players[0]?.score).length === 1 ? 's' : ''}</h3>
  {/if}
  <ol class="players scores">
    {#each v.players as p (p.pid)}
      <li><span>{ordinal(1 + v.players.filter((x) => x.score > p.score).length)}</span><strong>{p.name}</strong><b>{p.score.toLocaleString()}</b></li>
    {/each}
  </ol>
  {#if v.results?.some((r) => r.winner !== null)}
    <h3>Bout winners</h3>
    <div class="gallery">
      {#each v.results as r, i (i)}
        {#if r.winner !== null}
          <div>{@render fighter(r.fighters[r.winner])}<p>{r.title}</p></div>
        {/if}
      {/each}
    </div>
  {/if}
{/if}

<style>
  .faceoff { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s-3); width: min(100%, 880px); margin-inline: auto; }
  .side, .fighter { display: grid; align-content: start; gap: var(--s-2); text-align: center; overflow-wrap: anywhere; }
  .fighter strong { font: 800 clamp(1rem, 3vw, 2rem)/1.1 var(--font-display); }
  .blank { display: grid; place-items: center; aspect-ratio: 1; border: 2px dashed var(--line-strong); border-radius: var(--r-md); color: var(--text-dim); }
  .gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(125px, 100%), 1fr)); gap: var(--s-3); }
  .gallery > * { max-width: 220px; }
  .gallery strong { font-size: 1rem; }
  .tag { min-height: 44px; background: var(--surface); border-radius: var(--r-md); padding: var(--s-2); }
  .players { list-style: none; padding: 0; display: grid; gap: var(--s-2); }
  li { display: flex; align-items: center; gap: var(--s-2); background: var(--surface); padding: var(--s-2) var(--s-3); border-radius: var(--r-md); }
  li strong { flex: 1; overflow-wrap: anywhere; }
  .winner { color: var(--accent); }
  @media (min-width: 800px) {
    .faceoff { width: min(100%, 110dvh); }
    .players:not(.scores) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
</style>
