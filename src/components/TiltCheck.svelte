<script lang="ts">
  // Settings → "Check tilt": shows, live on this phone, each step Heads Down. needs for tilt:
  // whether this is the installed app or a browser tab, whether motion was allowed, whether
  // readings arrive, whether the rotation sensor is in use, the current angle, and whether a
  // tilt scores with this phone's calibration. It runs the same motion path as a round.
  import { onDestroy } from 'svelte';
  import Button from './Button.svelte';
  import { motionNeedsPermission } from '../lib/motion';
  import { TiltDetector } from '../lib/tilt';
  import { motion, onGravity, claimMotion, type MotionClaim } from '../games/forehead/sensors.svelte';
  import { tiltThresholds } from '../games/forehead/calibration.svelte';

  const installed = matchMedia('(display-mode: standalone)').matches
    || matchMedia('(display-mode: fullscreen)').matches
    || (navigator as unknown as { standalone?: boolean }).standalone === true;

  let phase = $state<'idle' | 'asking' | 'denied' | 'running'>('idle');
  let perSecond = $state(0);
  let pitch = $state<number | null>(null);
  let lastEvent = $state('');
  let stop: (() => void) | null = null;
  let ticker: ReturnType<typeof setInterval> | undefined;
  /** This check's motion stream; a tap still waiting on the iOS prompt checks it is still current. */
  let claim: MotionClaim | null = null;

  const GYRO = { none: 'not available here (tilt uses gravity only)', learning: 'found, learning how this phone reports it: tilt a few times', learned: 'in use' };

  async function start() {
    const mine = claimMotion(); // first thing in the tap: iOS asks here
    claim = mine; // an older tap still waiting on the prompt now sees it is stale
    phase = 'asking';
    const allowed = await mine.ready;
    if (claim !== mine) return; // Settings closed (or a newer tap) while the prompt was up
    if (!allowed) { phase = 'denied'; return; }
    phase = 'running';
    const detector = new TiltDetector(tiltThresholds());
    let count = 0;
    stop?.();
    stop = onGravity((_g, t, p) => {
      count++;
      if (Number.isFinite(p.pitch)) pitch = p.pitch;
      const e = detector.step(p.pitch, p.rate, t);
      if (e) lastEvent = e === 'correct' ? '✓ Got it (tipped forward)' : '↩ Pass (tipped back)';
    });
    clearInterval(ticker);
    ticker = setInterval(() => { perSecond = count; count = 0; }, 1000);
  }

  // Stops only the stream this check started, also while its permission prompt is still up.
  onDestroy(() => {
    stop?.();
    clearInterval(ticker);
    claim?.release();
    claim = null;
  });
</script>

<div class="check stack">
  {#if phase === 'idle' || phase === 'denied'}
    <Button variant="secondary" onclick={start}>Check tilt</Button>
  {/if}
  <p class="faint">
    Running as: <b>{installed ? 'installed app (home screen)' : 'browser tab'}</b>.
    {#if motionNeedsPermission()}This phone asks before sharing motion.{/if}
  </p>
  {#if phase === 'asking'}<p class="faint">Waiting for permission…</p>{/if}
  {#if phase === 'denied'}
    <p class="bad">Motion was refused. On iPhone: close this app fully and open it again, then tap Check tilt and choose Allow.</p>
  {/if}
  {#if phase === 'running'}
    <p>Readings: <b>{perSecond}</b> a second {perSecond === 0 ? '— none arriving, so tilt cannot work here' : ''}</p>
    <p>Rotation sensor: <b>{GYRO[motion.gyro]}</b></p>
    <p>Angle: <b>{pitch == null ? '–' : `${Math.round(pitch)}°`}</b> (0° = screen upright)</p>
    <p>Hold the phone on your forehead, sideways, then tilt: <b>{lastEvent || 'nothing yet'}</b></p>
  {/if}
</div>

<style>
  .check p { margin: 0; }
  .bad { color: var(--c-pass); }
</style>
