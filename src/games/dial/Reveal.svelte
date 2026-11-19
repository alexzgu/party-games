<script lang="ts">
  // Moment of truth: the cover sweeps open, the points count up, then fly to the team's score.
  // A tap anywhere while that plays jumps straight to the end (the score is already saved).
  import { onDestroy, onMount } from 'svelte';
  import Frame from './Frame.svelte';
  import Dial from './Dial.svelte';
  import ScaleCard from './ScaleCard.svelte';
  import Button from '../../components/Button.svelte';
  import { other, winnerOf, type Game, type Round } from './state';
  import { teamColor } from './look';
  import { sfx } from '../../lib/sound';
  import { haptic } from '../../lib/haptics';
  import { tapToSkip } from './skip';

  let { game, round, onrevealed, onnext, onhome, onend }: {
    game: Game;
    round: Round;
    onrevealed: () => void;
    onnext: () => void;
    onhome: () => void;
    onend: () => void;
  } = $props();

  type Stage = 'ready' | 'sweep' | 'count' | 'done';
  const SWEEP_MS = 1100;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // svelte-ignore state_referenced_locally
  let stage = $state<Stage>(round.revealed ? 'done' : 'ready');
  // svelte-ignore state_referenced_locally
  let shown = $state(round.revealed ? round.points : 0);
  // svelte-ignore state_referenced_locally
  let instant = $state(round.revealed);
  let fly: HTMLSpanElement | undefined = $state();
  let ghost: HTMLElement | null = null;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, reduced ? 0 : ms));
  onDestroy(() => { timers.forEach(clearTimeout); ghost?.remove(); });

  // Once the result is up, Next works straight away (the score is already saved; only the
  // flying number is cut short).
  const playing = () => stage === 'sweep' || stage === 'count';
  onMount(() => tapToSkip(playing, skip));

  function skip() {
    timers.forEach(clearTimeout);
    timers.length = 0;
    ghost?.remove();
    instant = true;
    shown = round.points;
    stage = 'done';
    if (!round.revealed) onrevealed();
  }

  const team = $derived(game.teams[game.active]);
  const thief = $derived(other(game.active));
  const gameOver = $derived(winnerOf(game.teams, game.goal) !== null);
  const headline = $derived(['Missed it', '', 'On the board', 'So close!', 'Bullseye!'][round.points]);

  function reveal() {
    stage = 'sweep';
    sfx.reveal();
    haptic.light();
    later(SWEEP_MS, count);
  }

  function count() {
    stage = 'count';
    if (round.points === 0) {
      sfx.pass();
      haptic.pass();
      later(500, land);
      return;
    }
    const step = (n: number) => {
      shown = n;
      if (n < round.points) { sfx.tick(); haptic.light(); later(200, () => step(n + 1)); }
      else {
        sfx.correct();
        haptic.correct();
        if (round.points === 4) later(260, () => sfx.win());
        later(450, land);
      }
    };
    later(150, () => step(1));
  }

  function land() {
    stage = 'done';
    flyToScore();
    later(reduced ? 0 : 620, () => { if (!round.revealed) onrevealed(); });
  }

  function flyToScore() {
    if (reduced || !fly || round.points === 0) return;
    const chip = document.querySelector(`[data-score-team="${game.active}"]`);
    if (!chip) return;
    const from = fly.getBoundingClientRect(), to = chip.getBoundingClientRect();
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    // A copy flies, so the big number stays where it is.
    const look = getComputedStyle(fly);
    const g = (ghost = fly.cloneNode(true) as HTMLElement);
    Object.assign(g.style, {
      position: 'fixed', left: from.left + 'px', top: from.top + 'px', margin: '0', zIndex: '20', pointerEvents: 'none',
      font: look.font, color: look.color, lineHeight: look.lineHeight,
    });
    document.body.append(g);
    const anim = g.animate(
      [{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) scale(0.35)`, opacity: 0.3 }],
      { duration: 600, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', fill: 'forwards' },
    );
    anim.onfinish = anim.oncancel = () => { g.remove(); if (ghost === g) ghost = null; };
  }
</script>

<Frame {game} active={game.active} {onhome} {onend}>
  <div class="tuner">
    <Dial value={round.guess} target={round.target} open={stage !== 'ready'} markHit={stage === 'done'} {instant} label="Result" />
    <ScaleCard card={round.card} />
  </div>
  {#if round.clue}<p class="clue faint">Clue: <q>{round.clue}</q></p>{/if}

  <div class="result" aria-live="polite">
    {#if stage === 'ready'}
      <p class="drum">Everybody look!</p>
    {:else if stage === 'sweep'}
      <p class="skip faint">Tap to skip</p>
    {:else}
      <div class="score" style:--team={teamColor(game.active)}>
        <span class="pts" class:zero={round.points === 0}>
          {#if round.points > 0}<span class="fly" bind:this={fly}>+{shown}</span>{:else}0{/if}
        </span>
        {#if stage === 'done'}
          <span class="words" class:pop-in={!instant}>
            <b>{headline}</b>
            <span>{round.points > 0 ? `+${round.points} for ${team.name}` : `No points for ${team.name}`}</span>
          </span>
        {/if}
      </div>
      {#if stage === 'done' && game.steal}
        <p class="steal" class:pop-in={!instant} style:--team={teamColor(thief)}>
          <b>{game.teams[thief].name}</b> called {round.call === 'left' ? '◀ Left' : 'Right ▶'}:
          {#if round.stealPoints}<span class="good">✓ correct, +1</span>{:else}<span class="bad">✗ wrong</span>{/if}
        </p>
      {/if}
    {/if}
  </div>

  {#snippet actions()}
    {#if stage === 'ready'}
      <Button size="lg" onclick={reveal}>Reveal the target</Button>
    {:else}
      <div style:--accent={teamColor(gameOver ? (winnerOf(game.teams, game.goal) ?? game.active) : thief)}>
        <Button size="lg" onclick={onnext}>
          {gameOver ? 'And the winner is…' : `Next: ${game.teams[thief].name}`}
        </Button>
      </div>
    {/if}
  {/snippet}
</Frame>

<style>
  .tuner { display: flex; flex-direction: column; gap: var(--s-3); }
  .clue { text-align: center; }
  .result { min-height: 132px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--s-3); }
  .skip { font-weight: 700; letter-spacing: 0.04em; }
  .drum { font-family: var(--font-display); font-weight: 800; font-size: 1.8rem; color: var(--text-dim); }
  .score { display: flex; align-items: center; gap: var(--s-4); }
  .pts {
    font-family: var(--font-display); font-weight: 800; font-size: 4.6rem; line-height: 1;
    color: var(--team); text-shadow: 0 0 28px color-mix(in srgb, var(--team) calc(50% * var(--glow)), transparent); font-variant-numeric: tabular-nums; min-width: 2.2ch; text-align: center;
  }
  .pts.zero { color: var(--text-faint); text-shadow: none; }
  .fly { display: inline-block; }
  .words { display: flex; flex-direction: column; }
  .words b { font-family: var(--font-display); font-size: 1.7rem; line-height: 1.05; }
  .words span { color: var(--team); font-weight: 700; }
  .steal { padding: var(--s-2) var(--s-4); border-radius: var(--r-pill); background: var(--surface); text-align: center; }
  .steal b { color: var(--team); }
  .good { color: var(--c-good); font-weight: 700; }
  .bad { color: var(--c-bad); font-weight: 700; }
</style>
