<script lang="ts">
  import Avatar from '../../components/room/Avatar.svelte';
  import Timer from '../../components/room/Timer.svelte';
  import Voters from './Voters.svelte';
  import { HOUSE, HOUSE_NAME, NO_ANSWER, linesShown, player, sideSizes, votersFor, type Game, type Lines } from './logic';
  import { DUEL_POT, LINES_MULTIPLIER, SWEEP_BONUS } from './scoring';
  import { pts } from './record';
  import { playerColor } from './look';

  // A three-line duel in the final: the prompt, then side A's lines one at a time, then side B's
  // (all at once with reduced motion); the room votes on their phones; then authors and points.
  let { game, online, left, total }: { game: Game; online: ReadonlySet<string>; left: number | null; total: number } = $props();

  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const item = $derived(game.items[game.at] as Lines);
  const reveal = $derived(game.phase === 'reveal' && !!item.result);
  // Counted from the timer, so a pause holds the lines and a reloaded host picks up where it was.
  const counts = $derived(game.phase === 'show' && !reduced ? linesShown(sideSizes(item), total - (left ?? 0)) : sideSizes(item));
  const voters = $derived(votersFor(game, item).map((pid) => { const p = player(game, pid)!; return { name: p.name, color: p.color, done: pid in item.ballots, away: !online.has(pid) }; }));
  const sides = $derived((['a', 'b'] as const).map((side, i) => {
    const pid = item[side];
    const lines = item.answers[pid];
    return {
      side, pid, lines: (lines ?? [NO_ANSWER]).slice(0, counts[i]), missing: lines == null, house: pid === HOUSE,
      author: player(game, pid),
      backers: Object.entries(item.ballots).filter(([, pick]) => pick === pid).map(([v]) => player(game, v)).filter((p) => !!p),
      votes: item.result?.votes[pid] ?? 0,
      points: item.result?.points[pid] ?? 0,
      sweep: item.result?.sweep === pid,
    };
  }));
  const totalVotes = $derived(sides[0].votes + sides[1].votes);
  const winner = $derived(reveal && sides[0].votes !== sides[1].votes ? (sides[0].votes > sides[1].votes ? 'a' : 'b') : null);
</script>

<div class="duel">
  <p class="eyebrow">Final duel {game.at + 1} of {game.items.length} · up to {pts(DUEL_POT * LINES_MULTIPLIER)} points</p>
  <h1 class="prompt pop-in">{item.prompt}</h1>

  <div class="answers">
    {#each sides as s, i (s.side)}
      <article class="answer" class:win={winner === s.side} class:lose={winner && winner !== s.side} class:missing={s.missing}
        style:--who={reveal && s.author ? playerColor(s.author.color) : reveal && s.house ? 'var(--text-dim)' : 'var(--accent)'}>
        <ol class="lines">
          {#each s.lines as line, k (k)}<li class="pop-in">{line}</li>{/each}
        </ol>
        {#if reveal}
          <div class="votes">
            <span class="n pop-in" style:animation-delay="300ms">{s.votes} {s.votes === 1 ? 'vote' : 'votes'}{totalVotes ? ` · ${Math.round((100 * s.votes) / totalVotes)}%` : ''}</span>
            <ul class="backers">
              {#each s.backers as b, k (b.pid)}
                <li class="pop-in" style:animation-delay="{400 + k * 120}ms"><Avatar name={b.name} color={b.color} size={28} /><span>{b.name}</span></li>
              {/each}
            </ul>
          </div>
          <footer class="by pop-in" style:animation-delay="{700 + s.backers.length * 120}ms">
            {#if s.house}<span class="house" aria-hidden="true">🏠</span><b>{HOUSE_NAME}</b><span class="faint">no points</span>
            {:else if s.author}<Avatar name={s.author.name} color={s.author.color} size={40} /><b>{s.author.name}</b><span class="pts">+{pts(s.points)}</span>{/if}
          </footer>
          {#if s.sweep}<p class="sweep pop-in" style:animation-delay="1100ms">Clean sweep! +{pts(SWEEP_BONUS * LINES_MULTIPLIER)}</p>{/if}
        {/if}
      </article>
      {#if i === 0}<span class="vs" aria-hidden="true">vs</span>{/if}
    {/each}
  </div>

  <footer class="foot">
    {#if game.phase === 'show'}
      <p class="faint">Voting opens on your phones in a moment.</p>
    {:else if game.phase === 'vote'}
      <div class="voting">
        <p class="call">Vote for the better three on your phone!</p>
        <Voters people={voters} />
      </div>
      <Timer {left} {total} paused={game.paused !== null} size={88} />
    {:else if reveal && totalVotes === 0}
      <p class="muted">No votes on this one.</p>
    {/if}
  </footer>
</div>

<style>
  .duel { flex: 1; display: flex; flex-direction: column; gap: clamp(10px, 2.2vmin, 24px); width: min(100%, 1200px); margin: 0 auto; padding: var(--s-3) 0; }
  .eyebrow { color: var(--c-gold); font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; font-size: clamp(calc(0.8 * var(--rem-far)), 1.8vmin, var(--rem-far)); text-align: center; }
  .prompt { text-align: center; font-size: clamp(calc(1.6 * var(--rem-far)), 5.4vmin, calc(3.4 * var(--rem-far))); line-height: 1.1; text-wrap: balance; }
  .answers { flex: 1; display: grid; grid-template-columns: 1fr auto 1fr; gap: clamp(8px, 2vw, 28px); align-items: stretch; }
  .vs { align-self: center; font-family: var(--font-display); font-weight: 800; color: var(--text-faint); font-size: clamp(calc(1.1 * var(--rem-far)), 3vmin, calc(2 * var(--rem-far))); }
  .answer {
    display: flex; flex-direction: column; gap: var(--s-3); padding: clamp(14px, 2.6vmin, 28px); border-radius: var(--r-lg); min-width: 0;
    background: var(--surface); border: 3px solid color-mix(in srgb, var(--who) 40%, transparent);
    transition: border-color var(--dur-slow) ease, opacity var(--dur-slow) ease;
  }
  .lines { flex: 1; list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; justify-content: center; gap: clamp(6px, 1.4vmin, 14px); }
  .lines li {
    font-family: var(--font-display); font-weight: 800; font-size: clamp(calc(1.2 * var(--rem-far)), 3.6vmin, calc(2.2 * var(--rem-far))); line-height: 1.15; overflow-wrap: anywhere;
    padding-left: var(--s-3); border-left: 4px solid color-mix(in srgb, var(--who) 60%, transparent);
  }
  .missing .lines li { color: var(--text-faint); font-style: italic; border-left-color: transparent; }
  .win { border-color: var(--who); background: color-mix(in srgb, var(--who) 14%, var(--surface)); box-shadow: 0 0 40px color-mix(in srgb, var(--who) calc(30% * var(--glow)), transparent); }
  .lose { opacity: 0.72; }
  .votes { display: flex; flex-direction: column; align-items: center; gap: var(--s-2); }
  .n { font-weight: 800; color: var(--text-dim); font-size: clamp(var(--rem-far), 2.4vmin, calc(1.4 * var(--rem-far))); }
  .backers { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; min-height: 36px; }
  .backers li { display: flex; align-items: center; gap: 6px; padding: 3px 12px 3px 3px; border-radius: var(--r-pill); background: var(--overlay); font-weight: 700; font-size: clamp(calc(0.85 * var(--rem-far)), 1.9vmin, calc(1.05 * var(--rem-far))); }
  .by { display: flex; align-items: center; gap: var(--s-2); font-size: clamp(calc(1.1 * var(--rem-far)), 3vmin, calc(1.8 * var(--rem-far))); }
  .by b { flex: 1; min-width: 0; color: var(--who); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .house { flex: none; width: 40px; height: 40px; display: grid; place-items: center; border-radius: 50%; background: var(--overlay-strong); font-size: 1.3rem; }
  .pts { font-family: var(--font-display); font-weight: 800; font-variant-numeric: tabular-nums; }
  .sweep { text-align: center; font-weight: 800; color: var(--c-gold); font-size: clamp(var(--rem-far), 2.4vmin, calc(1.4 * var(--rem-far))); }
  .foot { display: flex; align-items: center; justify-content: center; gap: var(--s-4); min-height: 88px; }
  .voting { display: flex; flex-direction: column; align-items: center; gap: var(--s-2); }
  .call { font-family: var(--font-display); font-weight: 800; font-size: clamp(calc(1.2 * var(--rem-far)), 3vmin, calc(1.8 * var(--rem-far))); color: var(--accent); text-align: center; }
  @media (max-width: 640px) {
    .answers { grid-template-columns: 1fr; }
    .vs { justify-self: center; }
    .foot { flex-direction: column-reverse; }
  }
</style>
