<script lang="ts">
  import type { ClipStatus } from './ui';

  // What the room looks at while it listens: a record that spins while the clip plays, with a
  // ring for the clip's progress. No video anywhere: the sound comes from the song's preview.
  let { status, progress = 0, onunblock }: {
    status: ClipStatus;
    progress?: number;
    /** The browser wants a tap before it plays sound: this tap starts the clip. */
    onunblock: () => void;
  } = $props();

  const LABEL: Record<ClipStatus, string> = {
    loading: 'Loading the song…',
    ready: 'Ready',
    playing: 'Listen…',
    done: 'Again, or longer?',
    blocked: 'Tap to start the sound',
    error: 'This one won’t play',
  };
  // The ring: r=46 on a 100 box.
  const C = 2 * Math.PI * 46;
</script>

<div class="stage" role="status" aria-live="polite">
  <div class="deck">
    <svg viewBox="0 0 100 100" class="ring" aria-hidden="true">
      <circle cx="50" cy="50" r="46" class="track" />
      <circle cx="50" cy="50" r="46" class="fill" stroke-dasharray={C} stroke-dashoffset={C * (1 - progress)} />
    </svg>
    <div class="disc" class:spin={status === 'playing'} class:wait={status === 'loading'}>
      <span class="label" aria-hidden="true"><span class="note">♪</span></span>
    </div>
  </div>
  {#if status === 'blocked'}
    <button class="say tapme" onclick={onunblock}>{LABEL.blocked}</button>
  {:else}
    <p class="say">{LABEL[status]}</p>
  {/if}
</div>

<style>
  .stage {
    order: 1; position: relative; width: 100%; max-width: 560px; margin: 0 auto;
    aspect-ratio: 16 / 9; min-height: 200px; border-radius: var(--r-lg); overflow: hidden; flex: none;
    border: 2px solid color-mix(in srgb, var(--accent) 45%, transparent);
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--s-2);
    background:
      radial-gradient(90% 120% at 50% 0%, color-mix(in srgb, var(--accent) 26%, transparent), transparent 70%),
      var(--bg-raised);
    text-align: center; padding: var(--s-3);
  }
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
  /* Over the middle of the record: the one thing to tap. */
  .tapme {
    position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 1; box-shadow: var(--shadow);
    border: 0; min-height: 56px; padding: 0 var(--s-4); border-radius: var(--r-pill); white-space: nowrap; max-width: calc(100% - 2 * var(--s-3));
    background: var(--accent); color: var(--on-accent); font-size: 1.2rem; animation: pulse 1.2s ease-in-out infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulse { 50% { opacity: 0.7; } }
  @media (prefers-reduced-motion: reduce) { .disc.spin, .disc.wait, .tapme { animation: none; } }
</style>
