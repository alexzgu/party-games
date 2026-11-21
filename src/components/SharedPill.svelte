<script lang="ts">
  import { onDestroy } from 'svelte';

  const id = $props.id();
  let pill: HTMLButtonElement;
  let tooltip: HTMLDivElement;
  let hold: ReturnType<typeof setTimeout> | undefined;

  function cancelHold() {
    clearTimeout(hold);
  }

  function hide() {
    cancelHold();
    tooltip?.hidePopover();
  }

  function show() {
    tooltip.showPopover();
    const anchor = pill.getBoundingClientRect();
    const { width, height } = tooltip.getBoundingClientRect();
    const gap = 8;
    tooltip.style.left = `${Math.max(gap, Math.min(anchor.left, window.innerWidth - width - gap))}px`;
    const below = anchor.bottom + gap;
    tooltip.style.top = `${below + height <= window.innerHeight - gap ? below : Math.max(gap, anchor.top - height - gap)}px`;
  }

  function start(event: PointerEvent) {
    if (!event.isPrimary || event.button !== 0) return;
    cancelHold();
    hold = setTimeout(show, 450);
  }

  onDestroy(cancelHold);
</script>

<svelte:window onscrollcapture={hide} onwheel={hide} ontouchmove={hide} onresize={hide}
  onkeydown={(event) => { if (event.key === 'Escape') hide(); }} />

<button type="button" class="pill" bind:this={pill} aria-describedby={id}
  onpointerdown={start} onpointerup={cancelHold} onpointerleave={cancelHold} onpointercancel={hide}
  oncontextmenu={(event) => event.preventDefault()} onblur={hide}
  onclick={(event) => { if (event.detail === 0) show(); }}>Shared</button>

<div {id} bind:this={tooltip} popover="manual" role="tooltip">Shared in the Community library. Edits go out when you tap Share changes or Fizzwick adds to it.</div>

<style>
  .pill {
    width: fit-content;
    padding: var(--s-1) var(--s-3);
    border: 1px solid var(--c-good);
    border-radius: 999px;
    background: color-mix(in srgb, var(--c-good) 13%, var(--surface));
    color: var(--c-good);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
    user-select: none;
  }
  [popover] {
    position: fixed;
    inset: auto;
    margin: 0;
    width: max-content;
    max-width: min(20rem, calc(100vw - 16px));
    padding: var(--s-3);
    border: 1px solid var(--c-good);
    border-radius: var(--r-md);
    background: var(--surface);
    color: var(--text);
    pointer-events: none;
  }
</style>
