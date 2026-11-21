<script lang="ts">
  // Between turns: the two teams side by side, the turn's points landing on the team that
  // played (a tap lands them at once), then the next team is called up.
  import { onMount } from 'svelte';
  import Button from '../../components/Button.svelte';
  import GameMenu from './GameMenu.svelte';
  import { sfx } from '../../lib/sound';
  import { haptic } from '../../lib/haptics';
  import { teamColor } from './look';
  import { other, pairDone, roundNo, scores, scoresBefore, tiedAtEnd, turnScore, type Game, type TeamIndex } from './state';

  let { game, onnext, onfix, onhome, onend }:
    { game: Game; onnext: () => void; /** Back to the turn's cards to fix a mark. */ onfix: () => void; onhome: () => void; onend: () => void } = $props();

  const LAND_MS = 750;
  const last = $derived(game.turns.at(-1)!);
  const delta = $derived(turnScore(last, game.skipCost));
  const before = $derived(scoresBefore(game));
  const after = $derived(scores(game));
  const next = $derived(other(game.active));
  const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0');

  const status = $derived.by(() => {
    const r = roundNo(game);
    if (tiedAtEnd(game)) return 'Tied! One more round each.';
    if (!pairDone(game)) return `Round ${r}${game.mode === 'rounds' ? ` of ${game.rounds}` : ''} · ${game.names[next]} to play`;
    return game.mode === 'rounds' ? `${r} of ${game.rounds} rounds played` : `Round ${r} done · first to ${game.goal}`;
  });

  let landed = $state(false);
  let menu = $state(false);

  function land() {
    if (landed) return;
    landed = true;
    if (delta > 0) { sfx.correct(); haptic.correct(); } else if (delta < 0) { sfx.pass(); haptic.pass(); }
  }

  onMount(() => {
    const t = setTimeout(land, LAND_MS);
    // A tap during the wait only lands the points: its click is swallowed, so it never presses Next.
    let swallow = false;
    const down = () => { if (!landed) { swallow = true; land(); } };
    const click = (e: MouseEvent) => { if (swallow) { swallow = false; e.preventDefault(); e.stopPropagation(); } };
    addEventListener('pointerdown', down, true);
    addEventListener('click', click, true);
    return () => { clearTimeout(t); removeEventListener('pointerdown', down, true); removeEventListener('click', click, true); };
  });
</script>

{#snippet side(i: TeamIndex)}
  {@const playing = last.team === i}
  <div class="team t{i}" class:on={playing} style:--team={teamColor(i)}>
    <span class="name">{game.names[i]}</span>
    {#key landed}<span class="score" class:pop-in={landed && playing}>{landed ? after[i] : before[i]}</span>{/key}
    {#if playing}
      <span class="delta" class:neg={delta < 0} class:landed>{signed(delta)}{#if landed}<small>&nbsp;this turn</small>{/if}</span>
    {:else}
      <span class="delta rest" aria-hidden="true">&nbsp;</span>
    {/if}
  </div>
{/snippet}

<div class="scores fade-in" style:--accent={teamColor(next)}>
  <header>
    <p class="kicker">Scores</p>
    <button class="menu" onclick={() => (menu = true)} aria-label="Game menu" aria-expanded={menu}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="5" cy="12" r="2.2" fill="currentColor"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/><circle cx="19" cy="12" r="2.2" fill="currentColor"/></svg>
    </button>
  </header>
  <div class="board" role="group" aria-label="Scores: {game.names[0]} {after[0]}, {game.names[1]} {after[1]}">
    {@render side(0)}
    {@render side(1)}
  </div>
  <p class="status pop-in" style:animation-delay="200ms">{status}</p>
  <div class="go">
    <Button size="lg" onclick={onnext}>Next: {game.names[next]}</Button>
    <Button variant="ghost" onclick={onfix}>Fix {game.names[last.team]}'s cards</Button>
  </div>
</div>

{#if menu}<GameMenu {game} onclose={() => (menu = false)} {onhome} {onend} />{/if}

<style>
  .scores {
    position: relative; isolation: isolate;
    min-height: 100dvh; max-width: 640px; margin: 0 auto;
    display: flex; flex-direction: column; gap: var(--s-5);
    padding: calc(var(--safe-top) + var(--s-3)) calc(var(--safe-right) + var(--s-4)) calc(var(--safe-bottom) + var(--s-4)) calc(var(--safe-left) + var(--s-4));
  }
  .scores::before {
    content: ''; position: fixed; inset: 0; z-index: -1; pointer-events: none;
    background:
      radial-gradient(70% 45% at 0% 30%, color-mix(in srgb, var(--c-team-a) 18%, transparent), transparent 70%),
      radial-gradient(70% 45% at 100% 30%, color-mix(in srgb, var(--c-team-b) 18%, transparent), transparent 70%),
      var(--bg);
  }
  header { display: flex; align-items: center; justify-content: space-between; min-height: 48px; }
  .kicker { font-size: 0.85rem; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-dim); }
  .menu { flex: none; width: 48px; height: 48px; border-radius: var(--r-pill); border: 0; background: var(--surface); color: var(--text-dim); display: grid; place-items: center; }
  .board { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-3); align-content: center; }
  .team {
    min-width: 0; display: flex; flex-direction: column; align-items: center; gap: var(--s-2);
    padding: var(--s-5) var(--s-3); border-radius: var(--r-lg);
    background: color-mix(in srgb, var(--team) 10%, var(--surface));
    border: 2px solid color-mix(in srgb, var(--team) 30%, transparent);
  }
  .team.on { border-color: var(--team); box-shadow: 0 0 28px color-mix(in srgb, var(--team) calc(40% * var(--glow)), transparent); }
  .name { font-weight: 800; font-size: 1.1rem; color: var(--team); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .score {
    font-family: var(--font-display); font-weight: 800; font-size: clamp(4rem, 22vw, 6.5rem); line-height: 1;
    font-variant-numeric: tabular-nums; color: var(--text); display: inline-block;
  }
  .delta {
    font-family: var(--font-display); font-weight: 800; font-size: 1.5rem; color: var(--c-good); min-height: 1.6em;
    transition: opacity var(--dur-slow) ease, transform var(--dur-slow) var(--ease-out);
  }
  .delta.neg { color: var(--c-bad); }
  .delta.landed { font-size: 1.05rem; color: var(--text-dim); }
  .delta.landed.neg { color: var(--bad-ink); }
  .delta small { font-size: inherit; font-weight: 700; font-family: var(--font-body); }
  .status { text-align: center; font-size: 1.15rem; font-weight: 700; color: var(--text-dim); }
  /* A phone on its side: the two teams on the left at full height, where things stand and the
     buttons on the right. */
  @media (orientation: landscape) and (max-height: 500px) {
    .scores {
      height: 100dvh; max-width: 960px; display: grid; gap: var(--s-2) var(--s-5);
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr) auto;
      padding-bottom: calc(var(--safe-bottom) + var(--s-2));
    }
    header { grid-column: 1 / -1; min-height: 0; }
    .board { grid-column: 1; grid-row: 2 / 4; min-height: 0; }
    .team { padding: var(--s-3); justify-content: center; }
    .score { font-size: clamp(3.5rem, 22dvh, 6rem); }
    .status { grid-column: 2; grid-row: 2; align-self: center; }
    .go { grid-column: 2; grid-row: 3; }
  }
</style>
