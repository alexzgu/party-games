<script lang="ts">
  import Avatar from './Avatar.svelte';
  import { pts } from './record';
  import { playerColor } from './look';
  import type { Shown } from './view';

  // The reveal on a phone, as on the host screen: who wrote each answer, who voted for it, the
  // points. Head-to-head: both answers, the winner lit. Final: every answer, most votes first.
  let { show, gain }: { show: Shown; gain: number | null } = $props();

  const top = $derived(show.kind === 'duel'
    ? (show.sides[0].votes === show.sides[1].votes ? -1 : show.sides[0].votes > show.sides[1].votes ? 0 : 1)
    : -1);
  const best = $derived(show.kind === 'final' ? Math.max(0, ...show.cards.map((c) => c.votes)) : 0);
  const total = $derived(show.kind === 'duel' ? show.sides[0].votes + show.sides[1].votes : 0);
</script>

<div class="reveal">
  {#if gain !== null}<p class="gain pop-in" class:zero={gain === 0}>{gain ? `+${pts(gain)} for you` : 'No votes for you this time'}</p>{/if}
  <h2 class="prompt">{show.prompt}</h2>

  {#if show.kind === 'duel'}
    {#each show.sides as s, i (i)}
      <article class="card pop-in" class:win={top === i} class:lose={top !== -1 && top !== i} class:missing={s.empty}
        style:--who={playerColor(s.by.color)} style:animation-delay="{i * 150}ms">
        <p class="text">{s.text}</p>
        <footer class="by">
          <Avatar name={s.by.name} color={s.by.color} size={30} /><b>{s.by.name}</b>
          <span class="pts">+{pts(s.points)}</span>
        </footer>
        <p class="n">{s.votes} {s.votes === 1 ? 'vote' : 'votes'}{total ? ` · ${Math.round((100 * s.votes) / total)}%` : ''}{s.sweep ? ' · clean sweep!' : ''}</p>
        {#if s.backers.length}
          <ul class="backers" aria-label="Voted for this">
            {#each s.backers as b (b.name)}<li><Avatar name={b.name} color={b.color} size={22} /><span>{b.name}</span></li>{/each}
          </ul>
        {/if}
      </article>
    {/each}
    {#if total === 0}<p class="muted none">No votes on this one.</p>{/if}
  {:else}
    <ol class="cards">
      {#each show.cards as c, k (k)}
        <li class="card pop-in" class:win={best > 0 && c.votes === best} style:--who={playerColor(c.by.color)} style:animation-delay="{k * 120}ms">
          <p class="text">{c.text}</p>
          <footer class="by">
            <Avatar name={c.by.name} color={c.by.color} size={26} /><b>{c.by.name}</b>
            <span class="n">{c.votes} {c.votes === 1 ? 'vote' : 'votes'}</span>
            <span class="pts">+{pts(c.points)}</span>
          </footer>
        </li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .reveal { display: flex; flex-direction: column; gap: var(--s-3); }
  .gain { font-family: var(--font-display); font-weight: 800; font-size: 1.35rem; color: var(--c-good); text-align: center; }
  .gain.zero { color: var(--text-dim); }
  .prompt { font-size: clamp(1.2rem, 5.4vw, 1.6rem); line-height: 1.15; }
  .cards { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--s-2); }
  .card {
    display: flex; flex-direction: column; gap: var(--s-2); padding: var(--s-3) var(--s-4); border-radius: var(--r-lg); min-width: 0;
    background: var(--surface); border: 2.5px solid color-mix(in srgb, var(--who) 40%, transparent);
  }
  .card.win { border-color: var(--who); background: color-mix(in srgb, var(--who) 14%, var(--surface)); }
  .card.lose { opacity: 0.8; }
  .text { font-family: var(--font-display); font-weight: 800; font-size: 1.2rem; line-height: 1.2; overflow-wrap: anywhere; }
  .cards .text { font-size: 1.05rem; }
  .missing .text { color: var(--text-faint); font-style: italic; }
  .by { display: flex; align-items: center; gap: var(--s-2); }
  .by b { flex: 1; min-width: 0; color: var(--who); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pts { font-family: var(--font-display); font-weight: 800; font-variant-numeric: tabular-nums; }
  .n { color: var(--text-dim); font-weight: 700; font-size: 0.9rem; white-space: nowrap; }
  .backers { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px; }
  .backers li { display: flex; align-items: center; gap: 4px; padding: 2px 10px 2px 2px; border-radius: var(--r-pill); background: var(--overlay); font-weight: 700; font-size: 0.85rem; }
  .none { text-align: center; }
</style>
