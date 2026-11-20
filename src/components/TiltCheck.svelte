<script lang="ts">
  // Settings → "Check tilt": shows, live on this phone, each step Heads Down. needs for tilt:
  // whether this is the installed app or a browser tab, whether motion was allowed, whether
  // readings arrive, the current angle, and whether a nod scores at the chosen sensitivity.
  import { onDestroy } from 'svelte';
  import Button from './Button.svelte';
  import { requestMotion, watchGravity, motionNeedsPermission, type Gravity } from '../lib/motion';
  import { TiltDetector } from '../lib/tilt';
  import { settings } from '../lib/settings.svelte';

  const installed = matchMedia('(display-mode: standalone)').matches
    || matchMedia('(display-mode: fullscreen)').matches
    || (navigator as unknown as { standalone?: boolean }).standalone === true;

  let phase = $state<'idle' | 'asking' | 'denied' | 'running'>('idle');
  let perSecond = $state(0);
  let pitch = $state<number | null>(null);
  let lastEvent = $state('');
  let stop: (() => void) | null = null;
  let ticker: ReturnType<typeof setInterval> | undefined;

  async function start() {
    phase = 'asking';
    const allowed = await requestMotion(); // first thing in the tap: iOS asks here
    if (!allowed) { phase = 'denied'; return; }
    phase = 'running';
    const detector = new TiltDetector(settings.tiltSensitivity);
    let count = 0;
    stop?.();
    stop = watchGravity((g: Gravity, t: number) => {
      count++;
      const mag = Math.hypot(g[0], g[1], g[2]);
      if (mag > 1) pitch = (Math.asin(Math.max(-1, Math.min(1, g[2] / mag))) * 180) / Math.PI;
      const e = detector.update(g, t);
      if (e) lastEvent = e === 'correct' ? '✓ Got it (tipped forward)' : '↩ Pass (tipped back)';
    });
    clearInterval(ticker);
    ticker = setInterval(() => { perSecond = count; count = 0; }, 1000);
  }

  onDestroy(() => { stop?.(); clearInterval(ticker); });
</script>

<div class="check stack">
  <p class="faint">
    Running as: <b>{installed ? 'installed app (home screen)' : 'browser tab'}</b>.
    {#if motionNeedsPermission()}This phone asks before sharing motion.{/if}
  </p>
  {#if phase === 'idle' || phase === 'denied'}
    <Button variant="secondary" onclick={start}>Check tilt</Button>
  {/if}
  {#if phase === 'asking'}<p class="faint">Waiting for permission…</p>{/if}
  {#if phase === 'denied'}
    <p class="bad">Motion was refused. On iPhone: close this app fully and open it again, then tap Check tilt and choose Allow.</p>
  {/if}
  {#if phase === 'running'}
    <p>Readings: <b>{perSecond}</b> a second {perSecond === 0 ? '— none arriving, so tilt cannot work here' : ''}</p>
    <p>Angle: <b>{pitch == null ? '–' : `${Math.round(pitch)}°`}</b> (0° = screen upright)</p>
    <p>Hold the phone on your forehead, sideways, then nod: <b>{lastEvent || 'nothing yet'}</b></p>
  {/if}
</div>

<style>
  .check p { margin: 0; }
  .bad { color: var(--c-pass); }
</style>
