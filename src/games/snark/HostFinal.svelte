<script lang="ts">
  import Avatar from '../../components/room/Avatar.svelte';
  import Timer from '../../components/room/Timer.svelte';
  import Voters from './Voters.svelte';
  import { FINAL_VOTES_EACH, player, votersFor, type Finale, type Game } from './logic';
  import { FINAL_VOTE_POINTS } from './scoring';
  import { pts } from './record';
  import { playerColor } from './look';

  // The final prompt: every answer on screen while everyone spreads three votes on their phone,
  // then the answers ranked by votes with their authors and points.
  let { game, online, left, total }: { game: Game; online: ReadonlySet<string>; left: number | null; total: number } = $props();

  const item = $derived(game.items[game.at] as Finale);
  const reveal = $derived(game.phase === 'reveal' && !!item.result);
  const voters = $derived(votersFor(game, item).map((pid) => { const p = player(game, pid)!; return { name: p.name, color: p.color, done: pid in item.ballots, away: !online.has(pid) }; }));
  const cards = $derived.by(() => {
    const list = item.authors
      .filter((pid) => item.answers[pid] != null)
      .map((pid) => ({ pid, text: item.answers[pid]!, author: player(game, pid), votes: item.result?.votes[pid] ?? 0, points: item.result?.points[pid] ?? 0 }));
    return reveal ? list.sort((x, y) => y.votes - x.votes) : list;
  });
  const top = $derived(reveal ? Math.max(0, ...cards.map((c) => c.votes)) : 0);
  const silent = $derived(item.authors.filter((pid) => item.answers[pid] == null).map((pid) => player(game, pid)?.name).filter(Boolean));
</script>

<div class="final">
  <p class="eyebrow">Final round · every vote is worth {FINAL_VOTE_POINTS}</p>
  <h1 class="prompt pop-in">{item.prompt}</h1>

  <ol class="cards" class:many={cards.length > 4}>
    {#each cards as c, k (c.pid)}
      <li class="card pop-in" class:top={reveal && top > 0 && c.votes === top}
        style:--who={reveal && c.author ? playerColor(c.author.color) : 'var(--accent)'} style:animation-delay="{100 + k * (reveal ? 220 : 90)}ms">
        <p class="text">{c.text}</p>
        {#if reveal}
          <footer class="by">
            {#if c.author}<Avatar name={c.author.name} color={c.author.color} size={34} /><b>{c.author.name}</b>{/if}
            <span class="stars" aria-label="{c.votes} votes">{c.votes} {c.votes === 1 ? 'vote' : 'votes'}</span>
            <span class="pts">+{pts(c.points)}</span>
          </footer>
        {/if}
      </li>
    {/each}
  </ol>
  {#if silent.length}<p class="faint silent">No answer from {silent.join(', ')}</p>{/if}

  {#if game.phase === 'vote'}
    <footer class="foot">
      <div class="voting">
        <p class="call">Spread your {FINAL_VOTES_EACH} votes on your phone!</p>
        <Voters people={voters} />
      </div>
      <Timer {left} {total} paused={game.paused !== null} size={88} />
    </footer>
  {/if}
</div>

<style>
  .final { flex: 1; display: flex; flex-direction: column; gap: clamp(10px, 2vmin, 22px); width: min(100%, 1240px); margin: 0 auto; padding: var(--s-3) 0; }
  .eyebrow { color: var(--c-gold); font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; font-size: clamp(0.8rem, calc(1.8vmin * var(--text-scale)), 1rem); text-align: center; }
  .prompt { text-align: center; font-size: clamp(1.6rem, calc(5.2vmin * var(--text-scale)), 3.2rem); line-height: 1.1; text-wrap: balance; }
  .cards { list-style: none; margin: 0; padding: 0; flex: 1; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: var(--s-3); align-content: center; }
  .card {
    display: flex; flex-direction: column; gap: var(--s-2); padding: clamp(12px, 2.2vmin, 22px); border-radius: var(--r-lg); min-width: 0;
    background: var(--surface); border: 2px solid color-mix(in srgb, var(--who) 35%, transparent);
  }
  .card.top { border-color: var(--who); background: color-mix(in srgb, var(--who) 14%, var(--surface)); box-shadow: 0 0 32px color-mix(in srgb, var(--who) calc(30% * var(--glow)), transparent); }
  .card { min-height: clamp(80px, 16vmin, 160px); }
  .text { flex: 1; display: flex; align-items: center; font-family: var(--font-display); font-weight: 800; font-size: clamp(1.25rem, calc(4.4vmin * var(--text-scale)), 2.6rem); line-height: 1.12; overflow-wrap: anywhere; }
  .many .text { font-size: clamp(1.1rem, calc(3.4vmin * var(--text-scale)), 2rem); }
  .many .card { min-height: clamp(64px, 12vmin, 120px); }
  .by { display: flex; align-items: center; gap: var(--s-2); }
  .by b { flex: 1; min-width: 0; color: var(--who); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .stars { color: var(--text-dim); font-weight: 700; white-space: nowrap; }
  .pts { font-family: var(--font-display); font-weight: 800; font-variant-numeric: tabular-nums; }
  .silent { text-align: center; }
  .foot { display: flex; align-items: center; justify-content: center; gap: var(--s-4); }
  .voting { display: flex; flex-direction: column; align-items: center; gap: var(--s-2); }
  .call { font-family: var(--font-display); font-weight: 800; font-size: clamp(1.1rem, calc(2.8vmin * var(--text-scale)), 1.7rem); color: var(--accent); text-align: center; }
  @media (max-width: 640px) { .foot { flex-direction: column-reverse; } }
</style>
