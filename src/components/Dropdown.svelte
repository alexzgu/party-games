<script lang="ts">
  import { tick, type Snippet } from 'svelte';
  import { matching, searchAtOnce, type PickOption } from '../lib/gamePicker';
  import { menuMove } from '../lib/menu';
  import { sfx } from '../lib/sound';
  import { haptic } from '../lib/haptics';

  // The app's one drop-down: a full-width box that opens a panel attached under it, with a search
  // field and the options in a list scrolling on its own. Two faces: pick one (`multi` off: choosing
  // closes it, focus back on the box; Tab closes it too) and pick several (`multi`: a tap or Enter
  // picks or unpicks and it stays open; Space too from the box; it closes with the foot's Done, a tap
  // outside or Escape). The box and the field are comboboxes over one listbox: arrows, Home and End
  // move. A tap outside or Escape closes it unchanged, and the page behind stays still meanwhile.
  let {
    options,
    label,
    spoken,
    searchLabel,
    none,
    multi = false,
    isOn,
    onchoose,
    tint,
    face,
    trailing,
    inside,
    after,
    foot,
  }: {
    options: PickOption[];
    /** What it chooses ("Game", "Categories"): the listbox's name and the start of the box's. */
    label: string;
    /** What the box holds now, spoken after the label. */
    spoken: string;
    /** The search field's placeholder and name ("Search games"). */
    searchLabel: string;
    /** Said when the search leaves nothing ("No games match."). */
    none: string;
    multi?: boolean;
    isOn: (id: string) => boolean;
    onchoose: (id: string) => void;
    /** The box's colour; none for the neutral look. */
    tint?: string;
    /** The box's content (left of its arrow). */
    face: Snippet;
    /** Beside the box, over its right end (a clear button). */
    trailing?: Snippet;
    /** After an option's name, inside it (read with it). */
    inside?: Snippet<[PickOption]>;
    /** After an option, outside it (a control of its own, reached with Tab). */
    after?: Snippet<[PickOption]>;
    /** Under the list, in the panel; gets the close function. */
    foot?: Snippet<[() => void]>;
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

  const shown = $derived(matching(options, query));
  const activeId = $derived(open && shown[active] ? optId(shown[active].id) : undefined);

  /** At most 60% of the screen, and what is left under the box (never under about three rows). */
  function room(): number {
    const below = innerHeight - box.getBoundingClientRect().bottom - 12;
    return Math.round(Math.max(Math.min(innerHeight * 0.6, below), 180));
  }

  async function show(fromKeyboard: boolean) {
    query = '';
    active = Math.max(0, options.findIndex((o) => isOn(o.id)));
    maxHeight = room();
    open = true;
    await tick();
    reveal();
    if (searchAtOnce(fromKeyboard, matchMedia('(pointer: coarse)').matches)) search?.focus({ preventScroll: true });
  }

  /** Closes it, focus back on the box. */
  export function close(): void {
    open = false;
    box.focus({ preventScroll: true });
  }

  /** Focus to the search field while open (after what had it went away), else to the box. */
  export function refocus(): void {
    (open ? search : box)?.focus({ preventScroll: true });
  }

  function choose(o: PickOption) {
    sfx.tap();
    haptic.light();
    if (!multi) close();
    onchoose(o.id);
  }

  /** The active option in view in the list (the list only, never the page). */
  function reveal() {
    const el = activeId ? document.getElementById(activeId) : null;
    const row = el?.parentElement;
    if (!row || !list) return;
    if (row.offsetTop < list.scrollTop) list.scrollTop = row.offsetTop;
    else if (row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = row.offsetTop + row.offsetHeight - list.clientHeight;
  }

  function keys(e: KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); void show(true); }
      return;
    }
    const to = menuMove(e.key, active, shown.length);
    const fromBox = e.currentTarget === box;
    if (to !== null) {
      e.preventDefault();
      active = to;
      void tick().then(reveal);
    } else if (e.key === 'Enter' || (e.key === ' ' && multi && fromBox)) {
      e.preventDefault();
      if (shown[active]) choose(shown[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab' && !multi) {
      close(); // focus is back on the box, so Tab goes on from there
    }
  }
</script>

<div class="dropdown" class:open style:--tint={tint}>
  <button bind:this={box} type="button" class="box" class:neutral={!tint} role="combobox" aria-haspopup="listbox"
    aria-expanded={open} aria-controls={open ? listId : undefined} aria-activedescendant={activeId} aria-label="{label}: {spoken}"
    onclick={(e) => (open ? close() : show(e.detail === 0))} onkeydown={keys}>
    {@render face()}
    {#if trailing}<span class="room" aria-hidden="true"></span>{/if}
    <svg class="arrow" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 9.5l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </button>
  {#if trailing}<div class="trailing">{@render trailing()}</div>{/if}
  {#if open}
    <!-- Takes the tap that closes it (and keeps the page behind still). `scrim`: a pinned bar
         holding it rises over the page's other bars meanwhile, as for a popup. -->
    <div class="outside scrim" role="presentation" onclick={close} onwheel={(e) => e.preventDefault()}></div>
    <div class="panel" style:max-height="{maxHeight}px">
      <input bind:this={search} bind:value={query} type="text" inputmode="search" placeholder={searchLabel} autocomplete="off" enterkeyhint="go"
        role="combobox" aria-label={searchLabel} aria-autocomplete="list" aria-expanded="true" aria-controls={listId} aria-activedescendant={activeId}
        oninput={() => (active = 0)} onkeydown={keys} />
      <ul class="list" id={listId} role="listbox" aria-label={label} aria-multiselectable={multi || undefined} bind:this={list}>
        {#each shown as o, i (o.id)}
          <li class="row" role="presentation" class:active={i === active} style:--tint={o.accent}>
            <div id={optId(o.id)} role="option" aria-selected={isOn(o.id)} tabindex="-1" onclick={() => choose(o)} onkeydown={keys}>
              {#if o.emoji}<span class="emoji" aria-hidden="true">{o.emoji}</span>{/if}
              <span class="name">{o.name}</span>
              {@render inside?.(o)}
              {#if isOn(o.id)}<span class="tick" aria-hidden="true">✓</span>{/if}
            </div>
            {@render after?.(o)}
          </li>
        {:else}
          <li class="none" role="presentation">{none}</li>
        {/each}
      </ul>
      {#if foot}<div class="foot">{@render foot(close)}</div>{/if}
    </div>
  {/if}
</div>

<style>
  .dropdown { position: relative; }
  .dropdown.open { z-index: var(--z-raised); }
  /* A control, not a heading: a bordered field with an arrow, tinted with its colour. */
  .box {
    width: 100%; min-height: 52px; display: flex; align-items: center; gap: var(--s-3); padding: 0 var(--s-3) 0 var(--s-4);
    border-radius: var(--r-md); border: 1.5px solid var(--tint); color: var(--text); text-align: left;
    background: color-mix(in srgb, var(--tint) 16%, var(--surface)); font-weight: 700; font-size: 1.05rem;
  }
  .box.neutral { border-color: var(--line-strong); background: var(--surface); }
  /* Room for the trailing control over the box's right end, left of the arrow. */
  .room { flex: none; width: 44px; }
  .box:active { transform: scale(0.99); }
  .trailing { position: absolute; top: 0; bottom: 0; right: calc(2 * var(--s-3) + 20px); display: flex; align-items: center; }
  .box :global(.name), .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .box :global(.emoji), .emoji { flex: none; font-size: 1.3rem; width: 1.6rem; text-align: center; }
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
  /* An option's own colour only (none: no mark), never the box's. */
  .row { --tint: initial; display: flex; align-items: center; gap: var(--s-1); border-radius: var(--r-sm); border-left: 4px solid var(--tint, transparent); }
  [role='option'] {
    flex: 1; min-width: 0; min-height: 48px; display: flex; align-items: center; gap: var(--s-3); padding: 0 var(--s-3); border-radius: var(--r-sm);
    font-weight: 700; cursor: pointer;
  }
  [role='option']:focus { outline: none; }
  /* Long names wrap in the list rather than cut off beside a tag and a count. */
  [role='option'] .name { white-space: normal; overflow-wrap: anywhere; padding-block: var(--s-1); }
  .row:hover, .active { background: var(--overlay-strong); }
  /* The keyboard's place in the list, outlined while the keys are in use. */
  .dropdown:has(:focus-visible) .active { outline: 2px solid var(--accent); outline-offset: -2px; }
  .row:has([aria-selected='true']) { color: var(--text); background: color-mix(in srgb, var(--tint, var(--text)) 14%, transparent); }
  .tick { flex: none; font-weight: 800; color: var(--text); }
  .none { padding: var(--s-3); color: var(--text-dim); font-weight: 600; }
  .foot { flex: none; display: flex; gap: var(--s-2); }
  .foot > :global(*) { flex: 1 1 0; }
  @media (prefers-reduced-motion: reduce) {
    .panel { animation: none; }
    .arrow { transition: none; }
  }
</style>
