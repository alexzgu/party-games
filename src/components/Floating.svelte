<script lang="ts">
  import type { Snippet } from 'svelte';
  import { clampInto, isTap, type Point } from '../lib/drag';

  // A box floating over the page that can be dragged anywhere with a finger or the mouse and is
  // kept wholly on screen (after drags, rotation and resizes). A press that barely moves is a
  // tap and reaches the buttons inside; a drag never does, and never scrolls the page.
  // `pos` is the top-left corner in px, null for the default spot (bottom right).
  let { pos = $bindable(null), label, children }: { pos?: Point | null; label: string; children: Snippet } = $props();

  let box = $state<HTMLElement>();
  let at = $state<Point>({ x: 0, y: 0 });
  let press: { id: number; from: Point; start: Point; moved: boolean } | null = null;
  let dragging = $state(false);

  const area = () => ({ w: document.documentElement.clientWidth, h: innerHeight });
  const size = () => ({ w: box?.offsetWidth ?? 0, h: box?.offsetHeight ?? 0 });
  function fit(p: Point | null) {
    const s = size(), a = area();
    at = clampInto(p ?? { x: a.w - s.w, y: a.h - s.h - 96 }, s, a);
  }

  $effect(() => {
    if (!box) return;
    fit(pos);
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
    press = { id: e.pointerId, from: { x: e.clientX, y: e.clientY }, start: at, moved: false };
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

<div class="floating" class:dragging role="group" aria-label={label} bind:this={box}
  style:left="{at.x}px" style:top="{at.y}px"
  onpointerdown={down}>
  {@render children()}
</div>

<style>
  .floating { position: fixed; z-index: 20; touch-action: none; user-select: none; -webkit-user-select: none; cursor: grab; }
  .dragging { cursor: grabbing; }
</style>
