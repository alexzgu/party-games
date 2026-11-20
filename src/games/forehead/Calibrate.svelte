<script lang="ts">
  // Calibrate tilt (#/forehead/calibrate): the phone, on the player's forehead, asks out loud for
  // "Down" or "Up"; each practice tilt it catches beeps and counts. As many as the player likes,
  // then Done saves thresholds learned from them (src/lib/calibration.ts) for this phone.
  import { onDestroy } from 'svelte';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import { back } from '../../lib/router.svelte';
  import { SteadyDetector } from '../../lib/tilt';
  import { GestureCatcher, thresholdsFrom, type Direction, type Gesture } from '../../lib/calibration';
  import { keepAwake } from '../../lib/wakelock';
  import { calibration, saveCalibration, clearCalibration } from './calibration.svelte';
  import { motion, onGravity, startMotion, stopMotion, enterPlayMode, exitPlayMode } from './sensors.svelte';
  import { unlockVoice, say, hush, tone } from './voice';

  /** Practice tilts of each kind before the phone suggests stopping (more are welcome). */
  const ENOUGH = 3;
  const WORD: Record<Direction, string> = { down: 'Down', up: 'Up' };

  let phase = $state<'intro' | 'running' | 'saved'>('intro');
  let denied = $state(false);
  let onHead = $state(false);
  let ask = $state<Direction>('down');
  let note = $state('');
  let kept = $state<Gesture[]>([]);
  let unhook: (() => void) | null = null;

  const downs = $derived(kept.filter((g) => g.dir === 'down').length);
  const ups = $derived(kept.filter((g) => g.dir === 'up').length);
  const th = $derived(calibration.th);

  async function start() {
    const ok = startMotion(true); // first: iOS asks for motion only inside the untouched tap
    unlockVoice();
    enterPlayMode();
    keepAwake(true);
    if (!(await ok)) { denied = true; release(); return; }
    kept = [];
    onHead = false;
    ask = 'down';
    note = '';
    phase = 'running';
    say('Put the phone on your forehead, like in a round.');
    const steady = new SteadyDetector();
    const catcher = new GestureCatcher();
    unhook = onGravity((g, t, p) => {
      if (!onHead) {
        if (steady.update(g, t)) { onHead = true; say(`Ready. ${WORD[ask]}.`); }
        return;
      }
      const got = catcher.update(p.pitch, p.rate, t);
      if (got) heard(got);
    });
  }

  function heard(g: Gesture) {
    if (g.dir !== ask) {
      tone('other');
      note = `That one went ${g.dir}. Try ${ask} again.`;
      say(`That was ${g.dir}. ${WORD[ask]}.`);
      return;
    }
    tone(g.dir);
    kept = [...kept, g];
    ask = ask === 'down' ? 'up' : 'down';
    note = `${WORD[g.dir]}: ${Math.round(g.amp)}°`;
    const justEnough = Math.min(downs, ups) === ENOUGH && kept.length === 2 * ENOUGH;
    say(justEnough ? `Good. Keep going, or take it off and tap Done. ${WORD[ask]}.` : WORD[ask]);
  }

  function release() {
    unhook?.();
    unhook = null;
    hush();
    stopMotion();
    motion.live = false;
    exitPlayMode();
    keepAwake(false);
  }

  function done() {
    release();
    if (downs && ups) {
      saveCalibration(thresholdsFrom(kept));
      phase = 'saved';
    } else {
      note = 'Needs at least one tilt down and one tilt up.';
      phase = 'intro';
    }
  }

  onDestroy(release);
</script>

{#if phase === 'running'}
  <div class="live" role="status">
    <p class="cue" class:down={ask === 'down'} class:up={ask === 'up'}>{onHead ? WORD[ask] : 'On your forehead'}</p>
    <p class="tally">Down {downs} · Up {ups}</p>
    <p class="faint">{note || (onHead ? 'Tilt the way you will in the game.' : 'Sideways, screen out, then hold still.')}</p>
    <div class="go">
      <Button size="lg" onclick={done}>Done</Button>
      <Button variant="ghost" size="sm" onclick={() => { release(); phase = 'intro'; note = ''; }}>Cancel</Button>
    </div>
  </div>
{:else}
  <Screen title="Calibrate tilt" onback={() => back('/forehead')}>
    <div class="stack">
      {#if phase === 'saved' && th}
        <p><b>Saved.</b> Got it now needs about {Math.round(th.down)}° down, pass about {Math.round(th.up)}° up, both done briskly.</p>
        <p class="faint">Each player can calibrate before their turn; the phone keeps the last one.</p>
        <Button size="lg" onclick={() => back('/forehead')}>Back to the game</Button>
      {:else}
        <p>Teach the phone how you tilt, so your tilts always count and laughing or looking around does not.</p>
        <ol class="steps">
          <li>Tap Start, then hold the phone on your forehead like in a round.</li>
          <li>The phone says <b>Down</b> or <b>Up</b>: tilt that way, just as you will in the game. Each tilt beeps.</li>
          <li>Do as many as you like (three of each is plenty), then take it off and tap <b>Done</b>.</li>
        </ol>
        {#if note}<p class="bad">{note}</p>{/if}
        {#if denied}<p class="bad">Motion was refused, so the phone cannot feel tilts. On iPhone: close the app fully, open it again and choose Allow.</p>{/if}
        <p class="faint">
          {th ? `Now: calibrated (got it at ${Math.round(th.down)}°, pass at ${Math.round(th.up)}°).` : 'Now: not calibrated, using the standard settings.'}
          {#if th}<button class="link" onclick={clearCalibration}>Reset</button>{/if}
        </p>
        <Button size="lg" onclick={start}>Start</Button>
      {/if}
    </div>
  </Screen>
{/if}

<style>
  .live {
    min-height: 100dvh; display: grid; place-content: center; text-align: center; gap: var(--s-3); padding: var(--s-4);
  }
  .cue { font-family: var(--font-display); font-size: clamp(2.5rem, 14vw, 6rem); font-weight: 800; margin: 0; }
  .cue.down { color: var(--c-good); }
  .cue.up { color: var(--c-pass); }
  .tally { font-size: 1.4rem; font-weight: 700; margin: 0; }
  .live .faint { margin: 0; }
  .go { display: grid; gap: var(--s-2); margin-top: var(--s-3); }
  .steps { margin: 0; padding-left: 1.2em; display: grid; gap: var(--s-2); }
  .bad { color: var(--c-pass); }
  .link { border: 0; background: transparent; color: var(--accent); font-weight: 700; min-height: 44px; padding: 0 var(--s-2); }
</style>
