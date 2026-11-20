<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import Stage from './Stage.svelte';
  import Dialog from './Dialog.svelte';
  import Button from '../../components/Button.svelte';
  import FitText from '../../components/FitText.svelte';
  import { TiltDetector } from '../../lib/tilt';
  import { sfx } from '../../lib/sound';
  import { haptic } from '../../lib/haptics';
  import { settings } from '../../lib/settings.svelte';
  import { tiltThresholds } from './calibration.svelte';
  import { accepts, finish, makeDealer, mark, openPlay, type EndReason, type Round } from './round';
  import { game, selectedDecks, setRound } from './state.svelte';
  import { getRestPitch, motion, motionFresh, onGravity, stageRotation, startMotion } from './sensors.svelte';
  import { wakeDevice } from './flow';

  type Pause = 'away' | 'confirm';
  type Flash = { ok: boolean; n: number };

  let { onend, paused = false, rotation, demo }: {
    onend: (r: Round) => void;
    /** Opened from a reload or by coming back: wait for a Resume tap. */
    paused?: boolean;
    rotation?: number;
    /** `flash`: show a frozen got-it (true) or pass (false) mark. */
    demo?: { flash?: boolean; ending?: EndReason; pause?: Pause };
  } = $props();

  const FLASH_MS = 520;
  /** After a score, input pauses this long (and the next word is hidden), then the flash fades over it. */
  const LOCK_MS = 200;
  const END_MS = 1500;

  const round = () => game.round!;
  const start = untrack(round);
  const dealer = makeDealer(selectedDecks(start.deckIds), [...start.shown.map((s) => s.word), ...(start.current ? [start.current] : [])]);

  let remaining = $state(start.remainingMs);
  let pause = $state<Pause | null>(untrack(() => demo?.pause ?? (paused || document.visibilityState === 'hidden' ? 'away' : null)));
  let flash = $state<Flash | null>(untrack(() => (demo?.flash != null ? { ok: demo.flash, n: 0 } : null)));
  let ending = $state<EndReason | null>(untrack(() => demo?.ending ?? null));
  let locked = $state(false);
  /** A tilt that came in while the next word was hidden (true = got it). */
  let queued: boolean | null = null;
  let flashN = 0;
  let timers: ReturnType<typeof setTimeout>[] = [];
  // The calibration is read once, as the round starts; tilts count from the holder's resting pitch.
  const detector = new TiltDetector(tiltThresholds(), getRestPitch() ?? 0);

  // What scores this round: the player chose tilt, tap or both (see accepts for the fallback).
  const accept = $derived(game.round ? accepts(game.round, motion.live) : { tilt: false, tap: true });
  const tilt = $derived(accept.tilt);
  const secs = $derived(Math.ceil(remaining / 1000));
  const clock = $derived(`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`);
  const hot = $derived(secs <= 10 && secs > 0);
  const points = $derived(game.round?.shown.filter((s) => s.ok).length ?? 0);
  const word = $derived(game.round?.current ?? '');
  /**
   * Phone sideways with live motion means it is on a forehead, content facing the onlookers.
   * Then the tap zones follow the holder's hands: their right hand (the onlookers' left) is
   * "got it". Held in portrait or on a laptop, right is "got it" as usual.
   */
  const mirrored = $derived(
    rotation != null ? Math.abs(rotation) === 90 // demo screenshots pass a fixed turn
      : motion.live && (motion.edge === 90 || motion.edge === 270),
  );

  const opened = openPlay(start, dealer.next);
  if (opened.round !== start) setRound(opened.round);
  if (opened.out) end('out');

  function later(fn: () => void, ms: number) {
    timers.push(setTimeout(fn, ms));
  }

  function persist() {
    if (game.round && game.round.phase === 'play') setRound({ ...game.round, remainingMs: Math.round(remaining) });
  }

  // The clock runs only while nothing is in the way; it saves itself every second.
  $effect(() => {
    if (pause || ending || demo) return;
    const endAt = performance.now() + untrack(() => remaining);
    const id = setInterval(() => {
      const left = Math.max(0, endAt - performance.now());
      const before = Math.ceil(remaining / 1000);
      remaining = left;
      const now = Math.ceil(left / 1000);
      if (now !== before) {
        if (now <= 10 && now > 0) { sfx.tick(); haptic.light(); }
        persist();
      }
      if (left <= 0) end('time');
    }, 100);
    return () => { clearInterval(id); persist(); };
  });

  $effect(() =>
    onGravity((_g, t, p) => {
      // Fed every reading, so quick tilts in a row keep their timing; a tilt that lands while
      // the next word is still hidden is scored the moment it shows.
      if (pause || ending) return;
      const e = detector.step(p.pitch, p.rate, t);
      if (!e || !tilt) return;
      if (locked) queued = e === 'correct';
      else score(e === 'correct');
    }),
  );

  // Leaving the app (call, notification, app switch) pauses the round.
  $effect(() => {
    const hide = () => { if (document.visibilityState === 'hidden' && !ending) pause ??= 'away'; };
    document.addEventListener('visibilitychange', hide);
    addEventListener('pagehide', hide);
    return () => { document.removeEventListener('visibilitychange', hide); removeEventListener('pagehide', hide); };
  });

  // Pressing Back during play lands here instead of losing the round.
  $effect(() => {
    if (game.interrupt) {
      untrack(() => { if (!ending) pause ??= 'away'; });
      game.interrupt = false;
    }
  });

  function score(ok: boolean) {
    if (pause || ending || locked || !game.round?.current) return;
    const next = dealer.next() ?? null;
    setRound({ ...mark(game.round, ok, next), remainingMs: Math.round(remaining) });
    if (ok) { sfx.correct(); haptic.correct(); } else { sfx.pass(); haptic.pass(); }
    const n = ++flashN;
    flash = { ok, n };
    locked = true;
    later(() => {
      locked = false;
      const q = queued;
      queued = null;
      if (q != null) score(q);
    }, LOCK_MS);
    later(() => { if (flash?.n === n) flash = null; }, FLASH_MS);
    if (next == null) later(() => end('out'), FLASH_MS);
  }

  function end(reason: EndReason) {
    if (ending) return;
    ending = reason;
    remaining = reason === 'time' ? 0 : remaining;
    if (reason === 'time') { sfx.buzzer(); haptic.end(); } else { sfx.reveal(); haptic.end(); }
    later(() => onend(finish(round(), reason)), END_MS);
  }

  function quit() {
    pause = null;
    ending = 'quit';
    onend(finish(round(), 'quit'));
  }

  function resume() {
    // A browser that suspended motion in the background leaves `live` set: restart a silent stream.
    if (motion.live && !motionFresh()) void startMotion(); // first: iOS asks only inside the tap
    wakeDevice();
    detector.reset();
    pause = null;
  }

  function zone(ok: boolean) {
    return {
      onpointerdown: (e: PointerEvent) => { if (e.isPrimary && accept.tap) score(ok); },
      // Keyboard activation (Enter/Space) arrives as a click with no pointer.
      onclick: (e: MouseEvent) => { if (e.detail === 0 && accept.tap) score(ok); },
    };
  }

  function key(e: KeyboardEvent) {
    if (pause || ending) return;
    if (e.key === 'Escape') pause = 'confirm';
    else if (!accept.tap) return; // tilt only: keys count as taps
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') score(true);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') score(false);
    else return;
    e.preventDefault();
  }

  onDestroy(() => timers.forEach(clearTimeout));
</script>

<svelte:window onkeydown={key} />

<Stage rotation={rotation ?? stageRotation()}>
  <div class="play" class:hot>
    {#if accept.tap}
      {#each [false, true] as isRight (isRight)}
        {@const ok = isRight !== mirrored}
        <button class="zone {isRight ? 'right' : 'left'} {ok ? 'good' : 'pass'}" aria-label={ok ? 'Got it' : 'Pass'} {...zone(ok)}>
          <span class="edge-label">{ok ? 'Got it' : 'Pass'}</span>
        </button>
      {/each}
    {/if}

    <div class="hud">
      {#key hot ? secs : -1}
        <div class="timer" class:hot role="timer" aria-label="{secs} seconds left">{clock}</div>
      {/key}
      <div class="right">
        <div class="score" aria-label="{points} correct"><span aria-hidden="true">✓</span> {points}</div>
        <button class="close" aria-label="End round" onpointerdown={(e) => e.stopPropagation()} onclick={() => (pause = 'confirm')}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>
        </button>
      </div>
    </div>

    <div class="word" class:hidden={locked} aria-live="assertive">
      {#key word}
        <div class="word-in"><FitText text={word} max={220} min={28} /></div>
      {/key}
    </div>

    <p class="hint" aria-hidden="true">
      {#if tilt}<span class="g">⬇ tilt down: got it</span><span class="p">⬆ tilt up: pass</span>
      {:else if mirrored}<span class="g">◀ tap: got it</span><span class="p">tap: pass ▶</span>
      {:else}<span class="p">◀ tap: pass</span><span class="g">tap: got it ▶</span>{/if}
    </p>

    {#snippet mark(ok: boolean)}
      <svg class="flash-ico" viewBox="0 0 24 24" aria-hidden="true">
        {#if ok}<path d="M4.5 12.5l5 5L19.5 6.5" />{:else}<path d="M5 5.5l6.5 6.5L5 18.5M12.5 5.5l6.5 6.5-6.5 6.5" />{/if}
      </svg>
    {/snippet}
    {#if flash}
      {#key flash.n}
        {#if settings.headsDownFeedback === 'screen'}
          <div class="flash" class:ok={flash.ok} class:still={!!demo} style:--flash-ms="{FLASH_MS}ms">
            {@render mark(flash.ok)}
            <span class="flash-txt">{flash.ok ? 'Got it!' : 'Pass'}</span>
          </div>
        {:else}
          <!-- The edge of the zone that was picked lights up: the got-it zone's side for got it. -->
          <div class="glow {flash.ok !== mirrored ? 'right' : 'left'}" class:ok={flash.ok} class:still={!!demo} style:--flash-ms="{FLASH_MS}ms">
            {@render mark(flash.ok)}
          </div>
        {/if}
      {/key}
    {/if}

    {#if ending && ending !== 'quit'}
      <div class="ending" class:out={ending === 'out'}>
        <span class="end-ico" aria-hidden="true">{ending === 'time' ? '⏰' : '🎉'}</span>
        <span class="end-txt">{ending === 'time' ? "Time's up!" : 'Out of words!'}</span>
        <span class="end-sub">{points} got</span>
      </div>
    {/if}

    {#if pause === 'confirm'}
      <Dialog title="End this round?" text="The words so far still count.">
        <Button size="lg" onclick={resume}>Keep playing</Button>
        <Button variant="danger" onclick={quit}>End round</Button>
      </Dialog>
    {:else if pause === 'away'}
      <Dialog title="Paused" text="{clock} left · {points} got so far">
        <Button size="lg" onclick={resume}>Resume</Button>
        <Button variant="ghost" onclick={quit}>End round</Button>
      </Dialog>
    {/if}
  </div>
</Stage>

<style>
  .play {
    position: absolute; inset: 0; overflow: hidden; user-select: none; -webkit-user-select: none; touch-action: none;
    background: radial-gradient(120% 90% at 50% 50%, color-mix(in srgb, var(--accent) var(--stage-tint), var(--stage)), var(--stage) 80%);
    transition: background var(--dur-slow) ease;
  }
  .play.hot { background: radial-gradient(120% 90% at 50% 50%, color-mix(in srgb, var(--c-bad) calc(26% * var(--glow)), var(--stage)), var(--stage) 80%); }

  .zone { position: absolute; top: 0; bottom: 0; width: 50%; border: 0; padding: 0; background: transparent; color: inherit; cursor: pointer; }
  .zone.good { --zone: var(--c-good); }
  .zone.pass { --zone: var(--c-pass); }
  .zone.left { left: 0; background: linear-gradient(to right, color-mix(in srgb, var(--zone) 30%, transparent), transparent 9%); }
  .zone.right { right: 0; background: linear-gradient(to left, color-mix(in srgb, var(--zone) 30%, transparent), transparent 9%); }
  .zone:focus-visible { outline-offset: -6px; }
  .edge-label {
    position: absolute; top: 50%; font-family: var(--font-display); font-weight: 800; font-size: 0.8rem;
    letter-spacing: 0.18em; text-transform: uppercase; white-space: nowrap; opacity: 0.85;
  }
  .edge-label { color: var(--zone); }
  .left .edge-label { left: 13px; transform: translate(-50%, -50%) rotate(-90deg); }
  .right .edge-label { right: 13px; transform: translate(50%, -50%) rotate(90deg); }

  .hud {
    position: absolute; top: calc(var(--edge) - 4px); left: calc(var(--edge) + 14px); right: calc(var(--edge) + 14px);
    display: flex; justify-content: space-between; align-items: center; pointer-events: none;
  }
  .right { display: flex; align-items: center; gap: var(--s-2); }
  .timer, .score {
    font-family: var(--font-display); font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1;
    font-size: clamp(1.5rem, 7vmin, 2.4rem); padding: 8px 16px; border-radius: var(--r-pill); background: var(--overlay-strong);
  }
  .timer.hot { background: var(--c-bad); color: #fff; animation: beat 600ms var(--ease-out); }
  @keyframes beat { 0% { transform: scale(1.18); } 100% { transform: scale(1); } }
  .score { color: var(--c-good); }
  .close {
    pointer-events: auto; width: 44px; height: 44px; border-radius: 50%; border: 0; display: grid; place-items: center;
    background: var(--overlay-strong); color: var(--text-dim);
  }

  .word {
    position: absolute; pointer-events: none;
    top: calc(var(--edge) + clamp(44px, 12vmin, 64px)); bottom: calc(var(--edge) + 28px);
    left: calc(var(--edge) + 24px); right: calc(var(--edge) + 24px);
  }
  .word { color: var(--word); }
  .word.hidden { opacity: 0; }
  .word-in { width: 100%; height: 100%; animation: word-in 260ms var(--ease-out) both; }
  @keyframes word-in { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: none; } }

  .hint {
    position: absolute; bottom: calc(var(--edge) - 6px); left: 0; right: 0; pointer-events: none;
    display: flex; justify-content: center; gap: var(--s-5); font-size: 0.9rem; font-weight: 600; color: var(--text-faint);
  }
  .hint .g { color: color-mix(in srgb, var(--c-good) 70%, var(--text-faint)); }
  .hint .p { color: color-mix(in srgb, var(--c-pass) 70%, var(--text-faint)); }

  .flash {
    position: absolute; inset: 0; z-index: 10; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: var(--s-2); background: var(--c-pass); color: var(--on-accent); pointer-events: none;
    animation: flash var(--flash-ms) ease-out both;
  }
  .flash.ok { background: var(--c-good); }
  .flash.still { animation: none; }
  .flash-ico {
    width: min(42vmin, 220px); height: min(42vmin, 220px); fill: none; stroke: currentColor; stroke-width: 3.4;
    stroke-linecap: round; stroke-linejoin: round; animation: ico-pop 380ms var(--ease-spring) both;
  }
  .flash-txt { font-family: var(--font-display); font-weight: 800; font-size: min(12vmin, 64px); letter-spacing: -0.02em; text-transform: uppercase; }
  /* Solid while input is locked (LOCK_MS of FLASH_MS), then fades over the next word. */
  @keyframes flash { 0% { opacity: 0; } 8% { opacity: 1; } 38% { opacity: 1; } 100% { opacity: 0; } }
  @keyframes ico-pop { from { transform: scale(0.4) rotate(-12deg); } to { transform: none; } }

  /* Edge feedback: a thick band, solid at the screen edge and fading inwards, readable across a dim room. */
  .glow {
    --g: var(--c-pass);
    position: absolute; top: 0; bottom: 0; z-index: 10; width: clamp(120px, 36%, 320px); pointer-events: none;
    display: flex; align-items: center; color: #fff; animation: flash var(--flash-ms) ease-out both;
  }
  .glow.ok { --g: var(--c-good); }
  .glow.right { right: 0; justify-content: flex-end; background: linear-gradient(to left, var(--glow-stops)); }
  .glow.left { left: 0; justify-content: flex-start; background: linear-gradient(to right, var(--glow-stops)); }
  .glow {
    --glow-stops: var(--g) 0, var(--g) 18px, color-mix(in srgb, var(--g) 80%, transparent) 30%,
      color-mix(in srgb, var(--g) 35%, transparent) 65%, transparent;
  }
  .glow.still { animation: none; }
  .glow .flash-ico {
    width: min(20vmin, 110px); height: min(20vmin, 110px); margin: 0 max(26px, 6%);
    filter: drop-shadow(0 2px 8px color-mix(in srgb, var(--shade) 45%, transparent));
  }

  .ending {
    position: absolute; inset: 0; z-index: 15; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: var(--s-2); background: var(--c-bad); color: #fff; animation: pop-in var(--dur-slow) var(--ease-spring) both;
  }
  .ending.out { background: var(--accent); color: var(--on-accent); }
  .end-ico { font-size: min(22vmin, 120px); line-height: 1; }
  .end-txt { font-family: var(--font-display); font-weight: 800; font-size: min(16vmin, 96px); letter-spacing: -0.03em; line-height: 1; }
  .end-sub { font-family: var(--font-display); font-weight: 700; font-size: min(7vmin, 36px); opacity: 0.85; }

  @media (prefers-reduced-motion: reduce) {
    .flash, .glow, .flash-ico, .word-in, .timer.hot, .ending { animation: none; }
  }
</style>
