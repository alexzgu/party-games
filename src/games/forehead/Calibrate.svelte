<script lang="ts">
  // Calibrate tilt (#/forehead/calibrate): the phone, on the player's forehead, asks out loud for
  // "Down" or "Up"; each practice tilt it catches beeps and counts. As many as the player likes,
  // then Done saves thresholds learned from them (src/lib/calibration.ts) for this phone, once
  // there are at least ENOUGH of each; fewer leave the stored calibration untouched.
  import { onDestroy } from 'svelte';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import { back } from '../../lib/router.svelte';
  import { SteadyDetector } from '../../lib/tilt';
  import { GestureCatcher, thresholdsFrom, tooSmall, type Direction, type Gesture } from '../../lib/calibration';
  import { keepAwake } from '../../lib/wakelock';
  import { calibration, saveCalibration, clearCalibration } from './calibration.svelte';
  import { motion, onGravity, claimMotion, enterPlayMode, exitPlayMode, type MotionClaim } from './sensors.svelte';
  import { unlockVoice, say, hush, tone } from './voice';

  /** Practice tilts of each kind needed to save, and before the phone suggests stopping (more are welcome). */
  const ENOUGH = 3;
  const WORD: Record<Direction, string> = { down: 'Down', up: 'Up' };

  let phase = $state<'intro' | 'running' | 'saved'>('intro');
  let denied = $state(false);
  let onHead = $state(false);
  let ask = $state<Direction>('down');
  let note = $state('');
  let kept = $state<Gesture[]>([]);
  let unhook: (() => void) | null = null;
  /** This screen's motion stream; a Start still waiting on the iOS prompt checks it is still current. */
  let claim: MotionClaim | null = null;

  const downs = $derived(kept.filter((g) => g.dir === 'down').length);
  const ups = $derived(kept.filter((g) => g.dir === 'up').length);
  const th = $derived(calibration.th);

  async function start() {
    const mine = claimMotion(true); // first: iOS asks for motion only inside the untouched tap
    claim = mine; // an older Start still waiting on the prompt now sees it is stale
    unlockVoice();
    enterPlayMode();
    keepAwake(true);
    denied = false;
    const ok = await mine.ready;
    if (claim !== mine) return; // left, cancelled or restarted while the prompt was up
    if (!ok) { denied = motion.denied; release(); return; } // false also when another screen took motion over
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
    if (tooSmall(g)) {
      if (g.dir !== ask) return; // a small move the other way is the head settling, not an attempt
      tone('other');
      note = `Only ${Math.round(g.amp)}°: too small to count in a round. Tilt further ${ask}.`;
      say(`Further. ${WORD[ask]}.`);
      return;
    }
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

  /** Stops only what this screen started: a newer round's motion stream is left alone. */
  function release() {
    unhook?.();
    unhook = null;
    if (!claim) return;
    claim.release();
    claim = null;
    hush();
    exitPlayMode();
    keepAwake(false);
  }

  /** What is still missing before Done can save, in plain words, or '' when there is enough. */
  function missing(): string {
    const more = (n: number, dir: Direction) => (n < ENOUGH ? [`${ENOUGH - n} more ${dir}`] : []);
    const parts = [...more(downs, 'down'), ...more(ups, 'up')];
    return parts.length ? `Not saved yet: needs ${parts.join(' and ')}.` : '';
  }

  function done() {
    const need = missing();
    if (need) {
      note = need; // keep going: the stored calibration is left as it was
      say(`${need} ${WORD[ask]}.`);
      return;
    }
    release();
    saveCalibration(thresholdsFrom(kept));
    phase = 'saved';
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
          <li>Do at least three of each (more is fine), then take it off and tap <b>Done</b>.</li>
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
