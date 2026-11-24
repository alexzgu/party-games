<script lang="ts">
  import { tick } from 'svelte';
  import { matching, searchAtOnce, type PickOption } from '../lib/gamePicker';
  import { menuMove } from '../lib/menu';
  import { sfx } from '../lib/sound';
  import { haptic } from '../lib/haptics';

  // A searchable drop-down box for choosing a game (the Community page, History). Closed: the
  // chosen game in its colour with a down arrow. Open: a search field and the games under it, in a
  // list attached under the box that scrolls on its own. A tap outside, Escape or Tab closes it
  // unchanged; choosing closes it with focus back on the box. The box and the field are both
  // comboboxes over one listbox: arrows, Home and End move, Enter chooses.
  let { options, value, label, onpick }: {
    options: PickOption[];
    value: string;
    /** What it chooses, spoken before the choice ("Game"). */
    label: string;
    onpick: (id: string) => void;
  } = $props();

  const uid = $props.id();
  const listId = `${uid}-list`;
  const optId = (id: string) => `${uid}-${id}`;
  let box: HTMLButtonElement;
  let search: HTMLInputElement | undefined = $state();
  let list: HTMLUListElement | undefined = $state();
  let open = $state(false);
  let query = $state('');
  let active = $state(0);
  let maxHeight = $state(0);

  const chosen = $derived(options.find((o) => o.id === value) ?? options[0]);
  const shown = $derived(matching(options, query));
  const activeId = $derived(open && shown[active] ? optId(shown[active].id) : undefined);

  /** At most 60% of the screen, and what is left under the box (never under about three rows). */
  function room(): number {
    const below = innerHeight - box.getBoundingClientRect().bottom - 12;
    return Math.round(Math.max(Math.min(innerHeight * 0.6, below), 180));
  }

  async function show(fromKeyboard: boolean) {
    query = '';
    active = Math.max(0, options.findIndex((o) => o.id === value));
    maxHeight = room();
    open = true;
    await tick();
    reveal();
    if (searchAtOnce(fromKeyboard, matchMedia('(pointer: coarse)').matches)) search?.focus({ preventScroll: true });
  }

  function hide() {
    open = false;
    box.focus({ preventScroll: true });
  }

  function choose(o: PickOption) {
    sfx.tap();
    haptic.light();
    hide();
    if (o.id !== value) onpick(o.id);
  }

  /** The active option in view in the list (the list only, never the page). */
  function reveal() {
    const el = activeId ? document.getElementById(activeId) : null;
    if (!el || !list) return;
    if (el.offsetTop < list.scrollTop) list.scrollTop = el.offsetTop;
    else if (el.offsetTop + el.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = el.offsetTop + el.offsetHeight - list.clientHeight;
  }

  function keys(e: KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); void show(true); }
      return;
    }
    const to = menuMove(e.key, active, shown.length);
    if (to !== null) {
      e.preventDefault();
      active = to;
      void tick().then(reveal);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (shown[active]) choose(shown[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      hide();
    } else if (e.key === 'Tab') {
      hide(); // focus is back on the box, so Tab goes on from there
    }
  }
</script>

<div class="picker" class:open style:--tint={chosen?.accent}>
  <button bind:this={box} type="button" class="box" class:neutral={!chosen?.accent} role="combobox" aria-haspopup="listbox"
    aria-expanded={open} aria-controls={open ? listId : undefined} aria-activedescendant={activeId} aria-label="{label}: {chosen?.name}"
    onclick={(e) => (open ? hide() : show(e.detail === 0))} onkeydown={keys}>
    <span class="emoji" aria-hidden="true">{chosen?.emoji}</span>
    <span class="name">{chosen?.name}</span>
    <svg class="arrow" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 9.5l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </button>
  {#if open}
    <!-- Takes the tap that closes it (and keeps the page behind still). `scrim`: a pinned bar
         holding it rises over the page's other bars meanwhile, as for a popup. -->
    <div class="outside scrim" role="presentation" onclick={hide} onwheel={(e) => e.preventDefault()}></div>
    <div class="panel" style:max-height="{maxHeight}px">
      <input bind:this={search} bind:value={query} type="text" inputmode="search" placeholder="Search games" autocomplete="off" enterkeyhint="go"
        role="combobox" aria-label="Search games" aria-autocomplete="list" aria-expanded="true" aria-controls={listId} aria-activedescendant={activeId}
        oninput={() => (active = 0)} onkeydown={keys} />
      <ul class="list" id={listId} role="listbox" aria-label={label} bind:this={list}>
        {#each shown as o, i (o.id)}
          <li id={optId(o.id)} role="option" aria-selected={o.id === value} class:active={i === active} style:--tint={o.accent}
            onclick={() => choose(o)} onkeydown={keys}>
            <span class="emoji" aria-hidden="true">{o.emoji}</span>
            <span class="name">{o.name}</span>
            {#if o.id === value}<span class="tick" aria-hidden="true">✓</span>{/if}
          </li>
        {:else}
          <li class="none" role="presentation">No games match.</li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  .picker { position: relative; }
  .picker.open { z-index: var(--z-raised); }
  /* A control, not a heading: a bordered field with an arrow, tinted with the chosen game's colour. */
  .box {
    width: 100%; min-height: 52px; display: flex; align-items: center; gap: var(--s-3); padding: 0 var(--s-3) 0 var(--s-4);
    border-radius: var(--r-md); border: 1.5px solid var(--tint); color: var(--text); text-align: left;
    background: color-mix(in srgb, var(--tint) 16%, var(--surface)); font-weight: 700; font-size: 1.05rem;
  }
  .box.neutral { border-color: var(--line-strong); background: var(--surface); }
  .box:active { transform: scale(0.99); }
  .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .emoji { flex: none; font-size: 1.3rem; width: 1.6rem; text-align: center; }
  .arrow { flex: none; color: var(--text-dim); transition: transform var(--dur) var(--ease-out); }
  .open .arrow { transform: rotate(180deg); }
  .outside { position: fixed; inset: 0; touch-action: none; }
  .panel {
    position: absolute; top: calc(100% + 4px); left: 0; right: 0; display: flex; flex-direction: column; gap: var(--s-2);
    padding: var(--s-2); background: var(--bg-raised); border: 1.5px solid var(--line-strong); border-radius: var(--r-md); box-shadow: var(--shadow);
    animation: drop var(--dur) var(--ease-out) both; transform-origin: top;
  }
  @keyframes drop { from { opacity: 0; transform: scaleY(0.6); } }
  input { flex: none; min-height: 48px; }
  .list { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
  [role='option'] {
    min-height: 48px; display: flex; align-items: center; gap: var(--s-3); padding: 0 var(--s-3); border-radius: var(--r-sm);
    font-weight: 700; cursor: pointer; border-left: 4px solid var(--tint, transparent);
  }
  [role='option']:hover, .active { background: var(--overlay-strong); }
  /* The keyboard's place in the list, outlined while the keys are in use. */
  .picker:has(:focus-visible) .active { outline: 2px solid var(--accent); outline-offset: -2px; }
  [aria-selected='true'] { color: var(--text); background: color-mix(in srgb, var(--tint, var(--text)) 14%, transparent); }
  .tick { flex: none; font-weight: 800; color: var(--text); }
  .none { padding: var(--s-3); color: var(--text-dim); font-weight: 600; }
  @media (prefers-reduced-motion: reduce) {
    .panel { animation: none; }
    .arrow { transition: none; }
  }
</style>
