<script lang="ts">
  import { untrack, type Snippet } from 'svelte';
  import { clampInto, isTap, type Point } from '../lib/drag';

  // A box floating over the page that can be dragged anywhere with a finger or the mouse and is
  // kept wholly on screen (after drags, rotation and resizes). A press that barely moves is a
  // tap and reaches the buttons inside; a drag never does, and never scrolls the page.
  // `pos` is the top-left corner in px, null for the default spot: with `dock`, the box sits in
  // the page's flow where the parent placed it (a place the page keeps free for it) until it is
  // first dragged; without, it floats at the bottom right.
  let { pos = $bindable(null), dock = false, label, children }: { pos?: Point | null; dock?: boolean; label: string; children: Snippet } = $props();

  let box = $state<HTMLElement>();
  let at = $state<Point>({ x: 0, y: 0 });
  let press: { id: number; from: Point; start: Point; moved: boolean } | null = null;
  let dragging = $state(false);
  const docked = $derived(dock && pos === null && !dragging);

  const area = () => ({ w: document.documentElement.clientWidth, h: innerHeight });
  const size = () => ({ w: box?.offsetWidth ?? 0, h: box?.offsetHeight ?? 0 });
  function fit(p: Point | null) {
    if (docked) return;
    const s = size(), a = area();
    at = clampInto(p ?? { x: a.w - s.w, y: a.h - s.h - 96 }, s, a);
  }

  $effect(() => {
    if (!box) return;
    const p = pos; // placed again only when the position is set, not when a drag starts
    untrack(() => fit(p));
    const refit = () => fit(at);
    addEventListener('resize', refit);
    addEventListener('orientationchange', refit);
    const watch = new ResizeObserver(refit); // the box itself changing size ("Time!")
    watch.observe(box);
    return () => { removeEventListener('resize', refit); removeEventListener('orientationchange', refit); watch.disconnect(); };
  });

  function stopFollowing() {
    removeEventListener('pointermove', move);
    removeEventListener('pointerup', up);
    removeEventListener('pointercancel', up);
  }
  $effect(() => stopFollowing); // a box removed mid-drag stops listening

  function down(e: PointerEvent) {
    if (press || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const r = box!.getBoundingClientRect();
    press = { id: e.pointerId, from: { x: e.clientX, y: e.clientY }, start: docked ? { x: r.left, y: r.top } : at, moved: false };
    // The page's listeners follow a mouse that leaves the box before the drag starts.
    addEventListener('pointermove', move, { passive: false });
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
  }
  function move(e: PointerEvent) {
    if (!press || e.pointerId !== press.id) return;
    const to = { x: e.clientX, y: e.clientY };
    if (!press.moved && isTap(press.from, to)) return;
    if (!press.moved) {
      press.moved = true;
      dragging = true;
    }
    e.preventDefault();
    at = clampInto({ x: press.start.x + to.x - press.from.x, y: press.start.y + to.y - press.from.y }, size(), area());
  }
  function up(e: PointerEvent) {
    if (!press || e.pointerId !== press.id) return;
    const dragged = press.moved;
    press = null;
    stopFollowing();
    dragging = false;
    if (!dragged) return;
    pos = { ...at };
    // The click that ends a drag must not press the button it was let go over.
    const swallow = (c: MouseEvent) => { c.stopPropagation(); c.preventDefault(); };
    addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => removeEventListener('click', swallow, { capture: true }), 50);
  }
</script>

<div class="floating" class:dragging class:docked role="group" aria-label={label} bind:this={box}
  style:left={docked ? null : `${at.x}px`} style:top={docked ? null : `${at.y}px`}
  onpointerdown={down}>
  {@render children()}
</div>

<style>
  .floating { position: fixed; z-index: var(--z-float); touch-action: none; user-select: none; -webkit-user-select: none; cursor: grab; }
  .dragging { cursor: grabbing; }
  .docked { position: relative; }
</style>
