<script lang="ts" module>
  export interface MenuItem {
    icon: string;
    label: string;
    /** What a screen reader says, starting with the label ("Import packs from a file"). */
    name?: string;
    /** What choosing it does, shown on hover. */
    tip?: string;
    onselect: () => void;
  }
</script>

<script lang="ts">
  import { tick, type Snippet } from 'svelte';
  import Button from './Button.svelte';
  import { menuMove, opensUp } from '../lib/menu';
  import { sfx } from '../lib/sound';
  import { haptic } from '../lib/haptics';

  // A button that opens a small menu growing out of it: upward (it usually sits low on the
  // screen), downward when there is more room below. A tap outside, Escape, Tab or choosing an
  // item closes it with focus back on the button; the arrow keys, Home and End move between the
  // items. `open` lets the bar holding it rise over the page's pinned bars meanwhile.
  let { label, tip, items, open = $bindable(false), children }: {
    /** The button's spoken name. */
    label: string;
    /** What the menu is for, shown on hover while it is closed. */
    tip?: string;
    items: MenuItem[];
    open?: boolean;
    children: Snippet;
  } = $props();

  const uid = $props.id();
  const buttonId = `${uid}-button`;
  const menuId = `${uid}-menu`;
  let menu: HTMLDivElement | undefined = $state();
  let up = $state(true);

  const button = () => document.getElementById(buttonId);
  const entries = () => [...(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];

  async function show(at: number) {
    open = true;
    await tick();
    place();
    entries()[at]?.focus({ preventScroll: true });
  }

  function hide() {
    open = false;
    button()?.focus({ preventScroll: true });
  }

  /** The visible part of whatever scrolls the button: a scrolling column, else the screen. */
  function room(el: HTMLElement): { top: number; bottom: number } {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (/auto|scroll/.test(getComputedStyle(p).overflowY)) return p.getBoundingClientRect();
    }
    return { top: 0, bottom: document.documentElement.clientHeight };
  }

  function place() {
    const b = button();
    if (!b || !menu) return;
    const at = b.getBoundingClientRect();
    const box = room(b);
    up = opensUp(at.top - box.top, box.bottom - at.bottom, menu.offsetHeight + 8);
  }

  function fromButton(e: KeyboardEvent) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    void show(e.key === 'ArrowDown' ? 0 : items.length - 1);
  }

  function inMenu(e: KeyboardEvent) {
    const list = entries();
    const to = menuMove(e.key, list.indexOf(document.activeElement as HTMLElement), list.length);
    if (to !== null) {
      e.preventDefault();
      list[to].focus({ preventScroll: true });
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      hide();
    } else if (e.key === 'Tab') {
      hide(); // focus is back on the button, so Tab goes on from there
    }
  }

  function choose(item: MenuItem) {
    sfx.tap();
    haptic.light();
    hide();
    item.onselect();
  }
</script>

<div class="menubutton">
  <Button variant="secondary" size="sm" id={buttonId} {label} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
    onclick={() => (open ? hide() : show(0))} onkeydown={fromButton} tip={open ? undefined : tip}>{@render children()}</Button>
  {#if open}
    <div class="outside" role="presentation" onclick={hide}></div>
    <div class="menu" class:up class:down={!up} id={menuId} role="menu" tabindex="-1" aria-labelledby={buttonId} bind:this={menu} onkeydown={inMenu}>
      {#each items as item (item.label)}
        <button class="item" role="menuitem" tabindex="-1" aria-label={item.name} onclick={() => choose(item)} data-tip={item.tip}>
          <span class="icon" aria-hidden="true">{item.icon}</span>{item.label}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .menubutton { position: relative; min-width: 0; }
  .menubutton > :global(.btn) { width: 100%; }
  /* Takes the tap that closes the menu, so it never also presses what is under it. */
  .outside { position: fixed; inset: 0; }
  .menu {
    position: absolute; left: 0; right: 0; min-width: 180px; z-index: 1;
    display: flex; flex-direction: column; padding: var(--s-1);
    background: var(--bg-raised); border: 1.5px solid var(--line-strong); border-radius: var(--r-md); box-shadow: var(--shadow);
    animation: grow var(--dur) var(--ease-out) both;
  }
  .menu:focus { outline: none; }
  .up { bottom: calc(100% + var(--s-2)); transform-origin: 50% calc(100% + var(--s-2) + 22px); }
  .down { top: calc(100% + var(--s-2)); transform-origin: 50% calc(-1 * var(--s-2) - 22px); }
  @keyframes grow { from { opacity: 0; transform: scale(0.4); } }
  .item {
    min-height: 48px; display: flex; align-items: center; gap: var(--s-3); padding: 0 var(--s-3);
    border: 0; border-radius: var(--r-sm); background: transparent; color: var(--text); text-align: left;
    font-family: var(--font-display); font-weight: 700; font-size: 1rem;
  }
  .item:is(:hover, :focus-visible, :active) { background: var(--overlay-strong); }
  .item:focus-visible { outline-offset: -2px; }
  .icon { width: 1.5rem; text-align: center; font-size: 1.15rem; }
  @media (prefers-reduced-motion: reduce) {
    .menu { animation: none; }
  }
</style>
