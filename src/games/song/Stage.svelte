<script lang="ts">
  import { onMount } from 'svelte';
  import type { ClipStatus } from './clip';

  // The YouTube player's box. It is mounted once for the whole game, because moving or
  // re-creating the iframe would reload it (and lose the iPhone's permission to play sound):
  // screens only change how it looks. Covered while guessing (a record that spins while the
  // clip plays), shown at the reveal, parked off screen otherwise (YouTube needs 200×200).
  let {
    mode,
    status,
    progress = 0,
    demo = false,
    onhost,
    onskip,
    onwatch,
  }: {
    mode: 'hidden' | 'covered' | 'shown';
    status: ClipStatus;
    progress?: number;
    demo?: boolean;
    /** Gets the element YouTube replaces with its iframe. */
    onhost: (el: HTMLElement) => void;
    /** Ends the reveal video early. */
    onskip?: () => void;
    /** Plays the reveal video (after a reload, when it is not already playing). */
    onwatch?: () => void;
  } = $props();

  let host: HTMLDivElement;
  onMount(() => { if (!demo) onhost(host); });

  const LABEL: Record<ClipStatus, string> = {
    idle: 'Loading the song…',
    cued: 'Ready',
    starting: 'Starting…',
    ad: 'One sec, YouTube is showing an ad',
    playing: 'Listen…',
    done: 'Again, or longer?',
    blocked: 'Tap here to start the sound',
    payoff: '',
    error: 'This one won’t play',
  };
  // The ring: r=46 on a 100 box.
  const C = 2 * Math.PI * 46;
</script>

<div class="stage {mode}" class:pass={status === 'blocked'} aria-hidden={mode === 'hidden'}>
  <div class="frame"><div bind:this={host} class="host"></div>{#if demo}<div class="fake" aria-hidden="true"></div>{/if}</div>
  {#if mode === 'covered'}
    <div class="cover" role="status" aria-live="polite">
      <div class="deck">
        <svg viewBox="0 0 100 100" class="ring" aria-hidden="true">
          <circle cx="50" cy="50" r="46" class="track" />
          <circle cx="50" cy="50" r="46" class="fill" stroke-dasharray={C} stroke-dashoffset={C * (1 - progress)} />
        </svg>
        <div class="disc" class:spin={status === 'playing'} class:wait={status === 'ad' || status === 'starting' || status === 'idle'}>
          <span class="label" aria-hidden="true"><span class="note">♪</span></span>
        </div>
      </div>
      <p class="say" class:ad={status === 'ad'} class:tapme={status === 'blocked'}>{LABEL[status]}</p>
    </div>
  {:else if mode === 'shown'}
    {#if status === 'payoff'}
      <button class="skip" onclick={onskip}>Skip video ›</button>
    {:else if onwatch && status !== 'playing'}
      <button class="watch" onclick={onwatch}>▶ Watch it</button>
    {/if}
  {/if}
</div>

<style>
  .stage {
    order: 1; position: relative; width: 100%; max-width: 560px; margin: 0 auto;
    aspect-ratio: 16 / 9; min-height: 200px; border-radius: var(--r-lg); overflow: hidden;
    background: var(--bg-sunk); border: 2px solid color-mix(in srgb, var(--accent) 45%, transparent);
    flex: none;
  }
  /* Parked: off screen but full size, so YouTube keeps it loaded and ready. */
  .stage.hidden { position: fixed; left: -10000px; top: 0; width: 356px; height: 200px; visibility: visible; }
  .frame, .host, .frame :global(iframe) { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
  .fake { position: absolute; inset: 0; background: radial-gradient(80% 90% at 30% 30%, color-mix(in srgb, var(--accent) 55%, transparent), transparent 70%), linear-gradient(135deg, var(--c-dial), var(--c-forehead)); opacity: 0.8; }
  .cover {
    position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--s-2);
    background:
      radial-gradient(90% 120% at 50% 0%, color-mix(in srgb, var(--accent) 26%, transparent), transparent 70%),
      var(--bg-raised);
    text-align: center; padding: var(--s-3);
  }
  /* Only when the browser wants a tap on the player itself does a tap go through the cover. */
  .pass .cover { pointer-events: none; }
  .deck { position: relative; width: min(42%, max(124px, 24vh)); aspect-ratio: 1; }
  .disc {
    position: absolute; inset: 0; border-radius: 50%;
    background:
      radial-gradient(circle, var(--accent) 0 17%, var(--bg-sunk) 17.5% 19%, transparent 19.5%),
      repeating-radial-gradient(circle, var(--surface-hi) 0 1.5px, var(--bg-sunk) 1.5px 4px);
    box-shadow: var(--shadow);
  }
  .disc.spin { animation: spin 1.8s linear infinite; }
  .disc.wait { animation: spin 5s linear infinite; opacity: 0.75; }
  .ring { position: absolute; inset: -10%; width: 120%; height: 120%; transform: rotate(-90deg); }
  .track { fill: none; stroke: var(--line); stroke-width: 4; }
  .fill { fill: none; stroke: var(--accent); stroke-width: 4; stroke-linecap: round; transition: stroke-dashoffset 120ms linear; }
  .label { position: absolute; inset: 0; display: grid; place-items: center; }
  .note { color: var(--on-accent); font-weight: 900; font-size: 1.3rem; }
  .say { font-family: var(--font-display); font-weight: 800; font-size: 1.15rem; color: var(--text); min-height: 1.4em; text-wrap: balance; }
  .say.ad { color: var(--c-pass); font-size: 1.02rem; }
  .say.tapme { color: var(--accent); font-size: 1.3rem; animation: pulse 1.2s ease-in-out infinite; }
  .skip, .watch {
    position: absolute; right: var(--s-2); bottom: var(--s-2); min-height: 44px; padding: 0 var(--s-4);
    border-radius: var(--r-pill); border: 0; background: color-mix(in srgb, var(--bg) 82%, transparent); color: var(--text); font-weight: 700;
    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  }
  .watch { left: 50%; right: auto; bottom: 50%; transform: translate(-50%, 50%); background: var(--accent); color: var(--on-accent); font-family: var(--font-display); font-size: 1.15rem; min-height: 56px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulse { 50% { opacity: 0.55; } }
  @media (prefers-reduced-motion: reduce) { .disc.spin, .disc.wait, .say.tapme { animation: none; } }
</style>
