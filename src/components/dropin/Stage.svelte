<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Button from '../Button.svelte';
  import { haptic } from '../../lib/haptics';
  import { sfx, unlockAudio } from '../../lib/sound';
  import { keepAwake } from '../../lib/wakelock';
  import { cardKey, isWarm, roomTypes } from '../../lib/dropin/cards';
  import { advance, type Round } from '../../lib/dropin/session';

  let { title, round, frozen, onupdate, onnext, onexit }: {
    title: string;
    round: Round;
    frozen: boolean;
    onupdate: (round: Round) => void;
    onnext: () => void;
    onexit: () => void;
  } = $props();
  const card = $derived(round.card);
  const label = $derived(isWarm(card) ? (round.revealed ? 'Answer' : `Clue ${round.step + 1} of ${card.clues.length}`) :
    roomTypes.find(({ type }) => type === card.type)?.label);
  const canClue = $derived(isWarm(card) && !round.revealed && round.step < card.clues.length - 1);
  const seconds = $derived(Math.ceil(round.left / 1000));
  const stage = $derived(`${cardKey(card)}:${round.step}:${round.revealed}`);
  const nextLabel = $derived(isWarm(card)
    ? round.revealed ? 'Next one' : canClue ? 'Next clue' : 'Reveal'
    : card.type === 'foley'
      ? round.step < card.lines.length - 1 ? 'Next line' : 'Next card'
      : round.revealed ? 'Next card' : card.type === 'proof' ? 'Show it now' : '');

  let lastTap = performance.now();
  function acceptTap() {
    const now = performance.now();
    if (now - lastTap < 400) return false;
    lastTap = now;
    unlockAudio();
    return true;
  }

  function apply(next: Round) {
    if (next.revealed && !isWarm(next.card) && (next.card.type === 'side' || next.card.type === 'together')) sfx.go();
    else if (next.revealed) sfx.reveal();
    else sfx.tap();
    haptic.light();
    onupdate(next);
  }

  function reveal() {
    if (!acceptTap()) return;
    apply({ ...round, revealed: true, left: 0 });
  }

  function tap() {
    if (!nextLabel || !acceptTap()) return;
    if (!isWarm(card) && card.type !== 'foley' && !round.revealed) {
      apply({ ...round, revealed: true, left: 0 });
      return;
    }
    if (isWarm(card) && !round.revealed && !canClue) {
      apply({ ...round, revealed: true, left: 0 });
      return;
    }
    const next = advance(round);
    if (next) apply(next);
    else onnext();
  }

  onMount(() => {
    keepAwake(true);
    return () => keepAwake(false);
  });

  $effect(() => {
    // Remaining time updates during this step without restarting its clock.
    const step = stage;
    if (frozen || untrack(() => round.left <= 0)) return;
    let stamp = performance.now();
    let active = !document.hidden;
    const countdown = untrack(() => !isWarm(card) && card.type !== 'proof' && card.type !== 'foley');
    if (active && countdown) sfx.count();

    function tick() {
      const now = performance.now();
      const elapsed = now - stamp;
      stamp = now;
      if (!active || stage !== step || round.left <= 0) return;
      const left = Math.max(0, round.left - elapsed);
      if (!left) {
        const next = advance(round);
        if (next) {
          lastTap = now;
          apply(next);
        }
      } else {
        if (countdown && Math.ceil(left / 1000) < seconds) sfx.tick();
        onupdate({ ...round, left });
      }
    }

    function visibility() {
      tick();
      active = !document.hidden;
    }

    const clock = window.setInterval(tick, 125);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', tick);
    return () => {
      window.clearInterval(clock);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', tick);
    };
  });
</script>

<div class="stage">
  <header>
    <button class="back" aria-label="Back to setup" onclick={() => { if (acceptTap()) onexit(); }}>‹</button>
    <span>{title}</span>
    <strong>{label}</strong>
  </header>

  {#if isWarm(card) && round.left > 0}
    <progress class="drip" aria-label="Time until next clue" max={round.options.drip * 1000} value={round.left}></progress>
  {/if}

  <!-- A single keyboard-accessible tap target surrounds the card, with separate footer actions. -->
  <div class="card" class:split={!isWarm(card) && card.type === 'side'}
    class:celebrate={!isWarm(card) && card.type === 'together' && round.revealed}>
    {#if nextLabel}<button class="tap-area" aria-label={`Card: ${nextLabel}`} onclick={tap}></button>{/if}
    {#if isWarm(card)}
      {#if round.step > 0 || round.revealed}
        <ol class="earlier">
          {#each card.clues.slice(0, round.revealed ? round.step + 1 : round.step) as clue}
            <li>{clue}</li>
          {/each}
        </ol>
      {/if}
      <div class="center" aria-live="polite">
        {#key stage}
          <h1 class="arrive" class:answer={round.revealed}>{round.revealed ? card.answer : card.clues[round.step]}</h1>
        {/key}
      </div>
    {:else if card.type === 'side'}
      <div class="choice"><h1>{card.a}</h1></div>
      <div class="choice"><h1>{card.b}</h1></div>
      <div class="signal">
        <strong aria-live="polite">{round.revealed ? 'Point!' : seconds}</strong>
        {#if round.revealed}<small class="follow">Why?</small>{/if}
      </div>
    {:else if card.type === 'proof'}
      <div class="center proof">
        <p>Somebody here has…</p>
        <h1>{card.text}</h1>
        {#if round.revealed}
          <strong class="call arrive" aria-live="polite">Show it!</strong>
        {:else}
          <div class="ring" role="timer" aria-label={`${seconds} seconds remaining`} style:--remaining={`${round.left / 300}%`}>
            <span>{seconds}</span>
          </div>
        {/if}
      </div>
    {:else if card.type === 'foley'}
      <div class="center" aria-live="polite">
        <p class="line-number">Line {round.step + 1} of {card.lines.length}</p>
        {#key stage}
          <h1 class="arrive">
            {#each card.lines[round.step].split(/(\[[^\[\]]+\])/g) as part}
              {#if part.startsWith('[') && part.endsWith(']')}<mark>{part}</mark>{:else}{part}{/if}
            {/each}
          </h1>
        {/key}
      </div>
    {:else}
      <div class="center" aria-live="polite">
        <h1>{card.text}</h1>
        {#if round.revealed}
          <div class="burst arrive"><strong class="call">Say it!</strong></div>
          <p class="follow">Anyone match?</p>
        {:else}
          <strong class="call">{seconds}</strong>
        {/if}
      </div>
    {/if}
  </div>

  <footer>
    {#if nextLabel}
      <Button size="lg" onclick={tap}>{nextLabel}</Button>
    {/if}
    {#if canClue}<Button variant="secondary" size="lg" onclick={reveal}>Reveal</Button>{/if}
  </footer>
</div>

<style>
  .stage {
    max-width: 1250px; min-height: 100dvh; margin: auto; display: grid;
    grid-template-rows: auto auto 1fr auto; gap: var(--s-3);
    padding: calc(var(--safe-top) + var(--s-3)) calc(var(--safe-right) + var(--s-4))
      calc(var(--safe-bottom) + var(--s-4)) calc(var(--safe-left) + var(--s-4));
  }
  header { display: grid; grid-template-columns: 48px 1fr auto; align-items: center; gap: var(--s-2); color: var(--text-dim); }
  header strong { color: var(--accent); text-align: right; }
  .back { width: 48px; height: 48px; border: 0; border-radius: var(--r-pill); background: var(--surface); color: var(--text); font-size: 2rem; line-height: 1; }
  .drip { grid-row: 2; width: 100%; height: 5px; accent-color: var(--accent); }
  .card {
    grid-row: 3; min-height: 420px; position: relative; display: flex; flex-direction: column; overflow: hidden;
    border: 1px solid var(--line); border-radius: var(--r-lg); background:
      radial-gradient(ellipse at center bottom, color-mix(in srgb, var(--accent) 17%, transparent), transparent 70%), var(--surface);
  }
  .tap-area { position: absolute; z-index: 1; inset: 0; width: 100%; background: none; border: 0; border-radius: inherit; touch-action: manipulation; }
  .tap-area:focus-visible { outline: 3px solid var(--accent); outline-offset: -5px; }
  .earlier { margin: 0; padding: var(--s-4) var(--s-5) 0 calc(var(--s-5) + 1em); color: var(--text-dim); font-size: clamp(.95rem, 2.2vw, 1.5rem); }
  .earlier li + li { margin-top: var(--s-1); }
  .center, .choice { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--s-3); text-align: center; padding: var(--s-5); }
  h1 { margin: 0; max-width: 24ch; font-size: clamp(1.9rem, 6vw, 5rem); line-height: 1.04; overflow-wrap: anywhere; text-wrap: balance; }
  .answer { color: var(--accent); font-size: clamp(3rem, 9vw, 7rem); }
  .center p { margin: 0; color: var(--text-dim); font-size: clamp(1.05rem, 2.5vw, 1.7rem); }
  .split { flex-direction: row; }
  .choice { min-width: 0; padding: var(--s-3); }
  .choice:first-of-type { background: color-mix(in srgb, var(--accent) 17%, var(--surface)); }
  .choice + .choice { border-left: 1px solid var(--line); background: var(--surface-hi); }
  .choice h1 { font-size: clamp(1.5rem, 5vw, 4.4rem); }
  .signal { position: absolute; left: 50%; bottom: var(--s-5); translate: -50% 0; display: grid; justify-items: center; border-radius: var(--r-md); background: var(--bg); padding: var(--s-2) var(--s-4); }
  .signal strong, .call { font: 800 clamp(2rem, 5vw, 4.5rem)/1 var(--font-display); color: var(--accent); }
  .signal small { color: var(--text-dim); }
  .proof h1 { font-size: clamp(1.9rem, 5.5vw, 4.5rem); }
  .ring { width: clamp(84px, 14vw, 140px); aspect-ratio: 1; border-radius: 50%; padding: 6px; display: grid; background: conic-gradient(var(--accent) var(--remaining), var(--line) 0); }
  .ring span { display: grid; place-items: center; border-radius: 50%; background: var(--surface); font: 800 clamp(1.8rem, 4vw, 3.5rem)/1 var(--font-display); font-variant-numeric: tabular-nums; }
  mark { color: var(--accent); background: var(--overlay); border-radius: var(--r-sm); }
  .burst { padding: var(--s-2) var(--s-5); border-radius: var(--r-pill); background: var(--accent); }
  .burst .call { color: var(--on-accent); }
  .celebrate { background-color: color-mix(in srgb, var(--accent) 19%, var(--surface)); }
  .arrive { animation: arrive var(--dur-slow) var(--ease-spring) both; }
  .follow { animation: follow var(--dur) var(--dur-slow) both; }
  @keyframes follow { from { opacity: 0; } to { opacity: 1; } }
  @keyframes arrive { from { opacity: .5; transform: scale(.93); } to { opacity: 1; transform: scale(1); } }
  footer { grid-row: 4; display: flex; gap: var(--s-2); }
</style>
