<script lang="ts">
  import Avatar from '../../components/room/Avatar.svelte';
  import Timer from '../../components/room/Timer.svelte';
  import Voters from './Voters.svelte';
  import { NO_ANSWER, isSafety, multiplier, player, votersFor, type Duel, type Game } from './logic';
  import { SWEEP_BONUS } from './scoring';
  import { pts } from './record';
  import { playerColor } from './look';

  // One head-to-head prompt: both answers without names while the room votes on their phones,
  // then each answer's voters, its author and the points.
  let { game, online, left, total }: { game: Game; online: ReadonlySet<string>; left: number | null; total: number } = $props();

  const item = $derived(game.items[game.at] as Duel);
  const reveal = $derived(game.phase === 'reveal' && !!item.result);
  const voters = $derived(votersFor(game, item).map((pid) => { const p = player(game, pid)!; return { name: p.name, color: p.color, done: pid in item.ballots, away: !online.has(pid) }; }));
  const sides = $derived((['a', 'b'] as const).map((side) => {
    const pid = item[side];
    const text = item.answers[pid];
    return {
      side, pid, text: text ?? NO_ANSWER, missing: text == null,
      author: player(game, pid),
      backers: Object.entries(item.ballots).filter(([, pick]) => pick === pid).map(([v]) => player(game, v)).filter((p) => !!p),
      votes: item.result?.votes[pid] ?? 0,
      points: item.result?.points[pid] ?? 0,
      sweep: item.result?.sweep === pid,
      safety: isSafety(item, pid),
    };
  }));
  const totalVotes = $derived(sides[0].votes + sides[1].votes);
  const winner = $derived(reveal && sides[0].votes !== sides[1].votes ? (sides[0].votes > sides[1].votes ? 'a' : 'b') : null);
</script>

<div class="duel">
  <p class="eyebrow">Prompt {game.at + 1} of {game.items.length}{game.round === 2 ? ' · double points' : ''}</p>
  <h1 class="prompt pop-in">{item.prompt}</h1>

  <div class="answers">
    {#each sides as s, i (s.side)}
      <article class="answer pop-in" class:win={winner === s.side} class:lose={winner && winner !== s.side} class:missing={s.missing}
        style:--who={reveal && s.author ? playerColor(s.author.color) : 'var(--accent)'} style:animation-delay="{150 + i * 150}ms">
        <p class="text">{s.text}</p>
        {#if reveal && s.safety}<p class="safety pop-in" style:animation-delay="200ms"><span class="tag">Safety</span> stock answer: half points</p>{/if}
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
            {#if s.author}<Avatar name={s.author.name} color={s.author.color} size={40} /><b>{s.author.name}</b>{/if}
            <span class="pts">+{pts(s.points)}</span>
          </footer>
          {#if s.sweep}<p class="sweep pop-in" style:animation-delay="1100ms">Clean sweep!{s.safety ? '' : ` +${pts(SWEEP_BONUS * multiplier(game))}`}</p>{/if}
        {/if}
      </article>
      {#if i === 0}<span class="vs" aria-hidden="true">vs</span>{/if}
    {/each}
  </div>

  <footer class="foot">
    {#if game.phase === 'vote'}
      <div class="voting">
        <p class="call">Vote on your phone!</p>
        <Voters people={voters} />
      </div>
      <Timer {left} {total} paused={game.paused !== null} size={88} />
    {:else if reveal && totalVotes === 0}
      <p class="muted">No votes on this one.</p>
    {/if}
  </footer>
</div>

<style>
  .duel { flex: 1; display: flex; flex-direction: column; gap: clamp(12px, 2.5vmin, 28px); width: min(100%, 1200px); margin: 0 auto; padding: var(--s-3) 0; }
  .eyebrow { color: var(--text-faint); font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; font-size: clamp(0.8rem, calc(1.8vmin * var(--text-scale)), 1rem); text-align: center; }
  .prompt { text-align: center; font-size: clamp(1.8rem, calc(6vmin * var(--text-scale)), 3.8rem); line-height: 1.1; text-wrap: balance; }
  .answers { flex: 1; display: grid; grid-template-columns: 1fr auto 1fr; gap: clamp(8px, 2vw, 28px); align-items: stretch; }
  .vs { align-self: center; font-family: var(--font-display); font-weight: 800; color: var(--text-faint); font-size: clamp(1.1rem, calc(3vmin * var(--text-scale)), 2rem); }
  .answer {
    display: flex; flex-direction: column; gap: var(--s-3); padding: clamp(16px, 3vmin, 32px); border-radius: var(--r-lg);
    background: var(--surface); border: 3px solid color-mix(in srgb, var(--who) 40%, transparent);
    transition: border-color var(--dur-slow) ease, opacity var(--dur-slow) ease, transform var(--dur-slow) var(--ease-out);
    min-width: 0;
  }
  .text { flex: 1; display: flex; align-items: center; justify-content: center; text-align: center; font-family: var(--font-display); font-weight: 800; font-size: clamp(1.5rem, calc(5vmin * var(--text-scale)), 3.2rem); line-height: 1.12; overflow-wrap: anywhere; text-wrap: balance; }
  .missing .text { color: var(--text-faint); font-style: italic; }
  .win { border-color: var(--who); background: color-mix(in srgb, var(--who) 14%, var(--surface)); box-shadow: 0 0 40px color-mix(in srgb, var(--who) calc(30% * var(--glow)), transparent); }
  .lose { opacity: 0.72; }
  .votes { display: flex; flex-direction: column; align-items: center; gap: var(--s-2); }
  .n { font-weight: 800; color: var(--text-dim); font-size: clamp(1rem, calc(2.4vmin * var(--text-scale)), 1.4rem); }
  .backers { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; min-height: 36px; }
  .backers li { display: flex; align-items: center; gap: 6px; padding: 3px 12px 3px 3px; border-radius: var(--r-pill); background: var(--overlay); font-weight: 700; font-size: clamp(0.85rem, calc(1.9vmin * var(--text-scale)), 1.05rem); }
  .by { display: flex; align-items: center; gap: var(--s-2); font-size: clamp(1.1rem, calc(3vmin * var(--text-scale)), 1.8rem); }
  .by b { flex: 1; min-width: 0; color: var(--who); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pts { font-family: var(--font-display); font-weight: 800; font-variant-numeric: tabular-nums; }
  .safety { text-align: center; color: var(--text-dim); font-weight: 700; font-size: clamp(0.85rem, calc(1.9vmin * var(--text-scale)), 1.05rem); }
  .tag { padding: 2px 10px; margin-right: 4px; border-radius: var(--r-pill); background: var(--overlay-strong); color: var(--text); font-size: 0.8em; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }
  .sweep { text-align: center; font-weight: 800; color: var(--c-gold); font-size: clamp(1rem, calc(2.4vmin * var(--text-scale)), 1.4rem); }
  .foot { display: flex; align-items: center; justify-content: center; gap: var(--s-4); min-height: 88px; }
  .voting { display: flex; flex-direction: column; align-items: center; gap: var(--s-2); }
  .call { font-family: var(--font-display); font-weight: 800; font-size: clamp(1.2rem, calc(3vmin * var(--text-scale)), 1.8rem); color: var(--accent); }
  @media (max-width: 640px) {
    .answers { grid-template-columns: 1fr; }
    .vs { justify-self: center; }
    .foot { flex-direction: column-reverse; }
  }
</style>
