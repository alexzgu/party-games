<script lang="ts">
  import type { Snippet } from 'svelte';
  import Popup from './Popup.svelte';
  import Button from './Button.svelte';
  import { tapGuard } from '../lib/tapGuard';

  // A setup row that shows a game's settings in one line and opens them in a popup. The controls
  // (children) stay bound to the setup's own state, so each change applies and saves at once;
  // Done, ✕, Escape and a tap outside only close it. Popup puts focus back on this row.
  // `compact`: one slim line for the setup's pinned start bar, the summary cut off with "…"
  // (its accessible name still says all of it).
  let { title = 'Rules', summary, compact = false, children }: {
    title?: string;
    /** The current values in plain words, joined with " · " ("60 s turns · first to 15 points"). */
    summary: string;
    compact?: boolean;
    children: Snippet;
  } = $props();

  let open = $state(false);
  // It sits in the start bar, where the last screen's button often was: a double tap there must not open it.
  const ready = tapGuard();
  // Screen readers get commas, not "middle dot".
  const name = $derived(`${title}: ${summary.replaceAll(' · ', ', ')}. Change`);
</script>

<button type="button" class="rules-card" class:compact aria-haspopup="dialog" aria-label={name} onclick={() => { if (ready()) open = true; }}>
  <span class="text">
    <span class="title">{title}</span>
    <span class="summary">{summary}</span>
  </span>
  <span class="gear" aria-hidden="true">
    <svg viewBox="0 0 24 24" width="22" height="22">
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
      <circle cx="15" cy="7" r="2.4" fill="none" stroke="currentColor" stroke-width="2.4" />
      <circle cx="9" cy="17" r="2.4" fill="none" stroke="currentColor" stroke-width="2.4" />
    </svg>
  </span>
</button>

{#if open}
  <Popup {title} wide onclose={() => (open = false)}>
    <div class="controls">{@render children()}</div>
    {#snippet footer()}<Button onclick={() => (open = false)}>Done</Button>{/snippet}
  </Popup>
{/if}

<style>
  .rules-card {
    width: 100%; min-width: 0; min-height: var(--tap); display: flex; align-items: center; gap: var(--s-3);
    padding: var(--s-3) var(--s-3) var(--s-3) var(--s-4); text-align: left; color: var(--text);
    background: var(--surface); border: 1.5px solid var(--line); border-radius: var(--r-md);
    transition: transform var(--dur-fast) var(--ease-out), background var(--dur-fast) ease;
  }
  .rules-card:active { transform: scale(0.98); background: var(--surface-hi); }
  .rules-card:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; }
  .text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .title { font-weight: 700; }
  .summary { color: var(--text-dim); font-size: 0.9rem; line-height: 1.3; overflow-wrap: anywhere; }
  .gear {
    flex: none; width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center;
    color: var(--accent); background: var(--overlay);
  }
  .compact { min-height: 52px; padding: var(--s-1) var(--s-1) var(--s-1) var(--s-4); }
  .compact .text { flex-direction: row; align-items: baseline; gap: var(--s-2); }
  .compact .title { flex: none; }
  .compact .summary { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; overflow-wrap: normal; }
  .compact .gear { width: 42px; height: 42px; }
  /* Rows (Toggle, Stepper) are --surface; on the raised popup that is the same white in the light
     scheme, so the popup's rows take a shade just off the card in either scheme. */
  .controls { display: flex; flex-direction: column; gap: var(--s-3); --surface: color-mix(in srgb, var(--text) 6%, var(--bg-raised)); }
  /* A phone on its side: two columns, so most settings fit without scrolling. */
  @media (orientation: landscape) and (max-height: 500px) {
    .controls { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
  }
</style>
