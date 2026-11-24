<script lang="ts">
  // Tilt lab (#/forehead/lab, not linked from the menu): the phone talks the holder through a
  // script of tilts and non-tilts and records every motion reading with the time of each cue,
  // so tilt detection can be designed from real data. The file goes to the laptop's lab server
  // when the page is served from it, else to the share sheet or a download.
  import { onDestroy } from 'svelte';
  import Screen from '../../../components/Screen.svelte';
  import Button from '../../../components/Button.svelte';
  import { screenAngle, motionNeedsPermission } from '../../../lib/motion';
  import { TiltDetector, SteadyDetector } from '../../../lib/tilt';
  import { tiltThresholds } from '../calibration.svelte';
  import { keepAwake } from '../../../lib/wakelock';
  import { startMotion, stopMotion, axisSign, onGravity, enterPlayMode, exitPlayMode } from '../sensors.svelte';
  import { labScript, speedScript, type Step } from './protocol';
  import { unlockVoice, say, hush, tone } from '../voice';
  import { downloadFile, shareOrDownload } from '../../../lib/share';

  type Cue = { t: number; spokenAt?: number; kind: string; block: string; text: string };

  let phase = $state<'idle' | 'running' | 'done'>('idle');
  let label = $state('');
  let current = $state<Step | null>(null);
  let stepNo = $state(0);
  let total = $state(0);
  let sent = $state('');
  let counts = $state({ motion: 0, cues: 0 });
  let file: Blob | null = null;
  let fileName = '';

  const r = (x: number | null | undefined, k = 1e4) => (x == null ? null : Math.round(x * k) / k);
  let motionRows: (number | null)[][] = [];
  let orientRows: (number | null)[][] = [];
  let angleRows: number[][] = [];
  let detectorRows: (number | string)[][] = [];
  let cues: Cue[] = [];
  let startedAt = '';
  let t0 = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let unhook: (() => void)[] = [];

  const installed = matchMedia('(display-mode: standalone)').matches
    || matchMedia('(display-mode: fullscreen)').matches
    || (navigator as unknown as { standalone?: boolean }).standalone === true;

  function onMotion(e: DeviceMotionEvent) {
    const g = e.accelerationIncludingGravity, a = e.acceleration, w = e.rotationRate;
    motionRows.push([
      r(e.timeStamp, 10), r(g?.x), r(g?.y), r(g?.z), r(a?.x), r(a?.y), r(a?.z),
      r(w?.alpha), r(w?.beta), r(w?.gamma), r(e.interval),
    ]);
  }
  function onOrient(e: DeviceOrientationEvent) {
    orientRows.push([r(e.timeStamp, 10), r(e.alpha, 100), r(e.beta, 100), r(e.gamma, 100)]);
  }
  function onAngle() { angleRows.push([r(performance.now(), 10)!, screenAngle()]); }

  function run(steps: Step[], i: number) {
    if (i >= steps.length) { finish(); return; }
    const s = steps[i];
    current = s;
    stepNo = i + 1;
    const cue: Cue = { t: r(performance.now(), 10)!, kind: s.kind, block: s.block, text: s.text };
    cues.push(cue);
    if (s.kind !== 'say' && s.kind !== 'noise' && s.kind !== 'still') tone(s.kind.endsWith('down') ? 'down' : s.kind.endsWith('up') ? 'up' : 'other');
    say(s.text, () => { cue.spokenAt = r(performance.now(), 10)!; });
    timer = setTimeout(() => run(steps, i + 1), s.ms);
  }

  let script = 'full';

  async function start(which: 'full' | 'speed') {
    script = which;
    // Motion first: iOS asks for permission only inside the untouched tap.
    const ok = startMotion(true);
    unlockVoice();
    enterPlayMode();
    keepAwake(true);
    if (!(await ok)) { sent = 'Motion was refused, so nothing can be recorded.'; counts = { motion: 0, cues: 0 }; phase = 'done'; return; }
    motionRows = []; orientRows = []; angleRows = []; detectorRows = []; cues = []; sent = '';
    startedAt = new Date().toISOString();
    t0 = performance.now();
    addEventListener('devicemotion', onMotion);
    addEventListener('deviceorientation', onOrient);
    addEventListener('orientationchange', onAngle);
    screen.orientation?.addEventListener?.('change', onAngle);
    onAngle();
    // The game's current detector runs alongside, so its live verdicts can be compared.
    const steady = new SteadyDetector();
    let detector: TiltDetector | null = null;
    unhook = [
      () => removeEventListener('devicemotion', onMotion),
      () => removeEventListener('deviceorientation', onOrient),
      () => removeEventListener('orientationchange', onAngle),
      () => screen.orientation?.removeEventListener?.('change', onAngle),
      onGravity((g, t, p) => {
        if (!detector) {
          steady.update(g, t, p.pitch);
          // Both scripts open with an intro and a rest; the detector starts with the next part.
          if (cues.some((c) => c.block !== 'intro' && c.block !== 'rest')) {
            detector = new TiltDetector(tiltThresholds(), steady.baseline() ?? 0);
            detectorRows.push([r(t, 10)!, 'baseline', r(steady.baseline() ?? 0, 100)!]);
          }
          return;
        }
        const e = detector.step(p.pitch, p.rate, t);
        if (e) detectorRows.push([r(t, 10)!, e]);
      }),
    ];
    const steps = script === 'speed' ? speedScript() : labScript();
    total = steps.length;
    phase = 'running';
    run(steps, 0);
  }

  function stopAll() {
    clearTimeout(timer);
    for (const f of unhook) f();
    unhook = [];
    hush();
    stopMotion();
    exitPlayMode();
    keepAwake(false);
  }

  function finish() {
    stopAll();
    const seconds = (performance.now() - t0) / 1000;
    const data = {
      version: 2,
      label: label.trim(),
      script,
      startedAt,
      userAgent: navigator.userAgent,
      installed,
      needsPermission: motionNeedsPermission(),
      axisSign: axisSign(),
      thresholds: tiltThresholds(),
      screen: { w: innerWidth, h: innerHeight },
      seconds: r(seconds, 10),
      motionFields: ['t', 'gx', 'gy', 'gz', 'ax', 'ay', 'az', 'rAlpha', 'rBeta', 'rGamma', 'interval'],
      motion: motionRows,
      orientFields: ['t', 'alpha', 'beta', 'gamma'],
      orientation: orientRows,
      angle: angleRows,
      cues,
      detector: detectorRows,
    };
    fileName = `tilt-${script === 'speed' ? 'speed-' : ''}${startedAt.replace(/[:.]/g, '-')}${label.trim() ? '-' + label.trim().replace(/\W+/g, '_') : ''}.json`;
    file = new Blob([JSON.stringify(data)], { type: 'application/json' });
    counts = { motion: motionRows.length, cues: cues.length };
    phase = 'done';
    current = null;
    void upload();
  }

  async function upload() {
    if (!file) return;
    sent = 'Sending to the laptop…';
    try {
      const res = await fetch(`lab-upload?name=${encodeURIComponent(fileName)}`, { method: 'POST', body: file });
      sent = res.ok ? `Sent to the laptop (${Math.round(file.size / 1024)} KB).` : 'No lab server here: use Share or Save below.';
    } catch {
      sent = 'No lab server here: use Share or Save below.';
    }
  }

  const asFile = (blob: Blob) => new File([blob], fileName, { type: 'application/json' });

  async function share() {
    if (file) await shareOrDownload(asFile(file));
  }

  function save() {
    if (file) downloadFile(asFile(file));
  }

  onDestroy(stopAll);
</script>

{#if phase === 'running'}
  <div class="live" role="status">
    <p class="cue" class:down={current?.kind.endsWith('down')} class:up={current?.kind.endsWith('up')}>{current?.text}</p>
    <p class="faint">Step {stepNo} of {total} · {current?.block}</p>
    <Button variant="ghost" size="sm" onclick={finish} tip="Ends the recording now without losing it">Stop</Button>
  </div>
{:else}
  <Screen title="Tilt lab">
    {#if phase === 'idle'}
      <div class="stack">
        <p>The phone talks you through about three and a half minutes of tilts and non-tilts and records how it moved. Turn the sound up.</p>
        <p class="faint">After the spoken start, put the phone on your forehead sideways, screen out, exactly as in a round. "Down" means tip it the way you would for got it; "Up" the way you would to pass.</p>
        <label class="stack">
          <span class="faint">Who is holding it, and anything worth noting (optional)</span>
          <input bind:value={label} placeholder="Alex, sitting, couch" />
        </label>
        <Button size="lg" onclick={() => start('full')} tip="Records this phone's movement while a voice tells you what to do">Full session</Button>
        <Button variant="secondary" size="lg" onclick={() => start('speed')} tip="Records this phone's movement during fast tilts">Speed run</Button>
      </div>
    {:else}
      <div class="stack">
        <p>{sent || 'Recording finished.'}</p>
        <p class="faint">{counts.motion} motion readings, {counts.cues} cues.</p>
        {#if counts.motion}
          <Button variant="secondary" onclick={upload}>Resend</Button>
          <Button variant="secondary" onclick={share}>Share file</Button>
          <Button variant="ghost" onclick={save}>Save file</Button>
        {/if}
        <Button onclick={() => { phase = 'idle'; sent = ''; }}>Record another</Button>
      </div>
    {/if}
  </Screen>
{/if}

<style>
  .live {
    min-height: 100dvh; display: grid; place-content: center; text-align: center; gap: var(--s-4); padding: 16px;
  }
  .cue { font-size: clamp(2rem, 12vw, 6rem); font-weight: 800; margin: 0; }
  .cue.down { color: var(--c-good); }
  .cue.up { color: var(--c-pass); }
  input { font: inherit; padding: 12px; border-radius: 12px; border: 1px solid var(--line-strong); background: transparent; color: inherit; }
</style>
