<script lang="ts">
  import { untrack } from 'svelte';
  import Button from '../../components/Button.svelte';
  import { sfx } from '../../lib/sound';
  import { BLANK_MAX } from './cards';
  import PromptCard from './PromptCard.svelte';
  import type { Card } from './view';

  // A hand of answer cards. Answering: tap to select (numbered 1, 2 on a two-card prompt), the
  // prompt above reads filled in, Play sends it. A blank card asks for its text. Trading (house
  // rule): tap the cards to swap, then confirm for a point. `prompt` absent: the hand only shows.
  let { hand, prompt, picks = 1, canTrade = false, disabled = false, start = [], startTyped = '', startTrading = false, onplay, ontrade }: {
    hand: Card[]; prompt?: string; picks?: number; canTrade?: boolean; disabled?: boolean;
    /** Demo screens only: a selection, typed text or trade already under way. */
    start?: number[]; startTyped?: string; startTrading?: boolean;
    onplay: (cards: number[], texts: string[]) => void; ontrade: (cards: number[]) => void;
  } = $props();

  let chosen = $state<number[]>(untrack(() => start));
  let typed = $state<Record<number, string>>(untrack(() => Object.fromEntries(start.map((id) => [id, startTyped]))));
  let trading = $state(untrack(() => startTrading));
  let swap = $state<number[]>([]);
  /** A trade is on its way: the old cards wait for the new ones (the parent remounts this on the answer). */
  let swapping = $state(false);
  const locked = $derived(disabled || swapping);
  const card = (id: number) => hand.find((c) => c.id === id);
  const blank = (id: number) => card(id)?.text === '';
  const texts = $derived(chosen.map((id) => blank(id) ? typed[id]?.trim() || 'Your own answer' : card(id)?.text ?? ''));
  const ready = $derived(chosen.length === picks && chosen.every((id) => !blank(id) || typed[id]?.trim()));
  const open = $derived(chosen.filter(blank));

  // A card that left the hand (a trade landed) drops out of the selection.
  $effect(() => {
    const ids = new Set(hand.map((c) => c.id));
    untrack(() => {
      if (chosen.some((id) => !ids.has(id))) chosen = chosen.filter((id) => ids.has(id));
      if (swap.some((id) => !ids.has(id))) swap = swap.filter((id) => ids.has(id));
    });
  });

  function tap(id: number) {
    sfx.tap();
    if (trading) swap = swap.includes(id) ? swap.filter((x) => x !== id) : [...swap, id];
    else if (chosen.includes(id)) chosen = chosen.filter((x) => x !== id);
    else chosen = chosen.length < picks ? [...chosen, id] : [...chosen.slice(0, picks - 1), id];
  }

  function play() {
    if (!ready || locked) return;
    onplay([...chosen], chosen.map((id) => blank(id) ? typed[id].trim() : ''));
  }

  function trade() {
    if (!swap.length || locked) return;
    swapping = true;
    ontrade([...swap]);
    trading = false;
    swap = [];
  }
</script>

{#if prompt}
  <div class="top"><PromptCard {prompt} answers={texts} label={picks === 2 ? 'Pick two, in order' : 'Pick one'} /></div>
  {#each open as id, n (id)}
    <label class="write">{open.length > 1 ? `Blank card ${n + 1}: your answer` : 'Your answer on the blank card'}
      <input bind:value={typed[id]} maxlength={BLANK_MAX} placeholder="Write anything" autocomplete="off" />
    </label>
  {/each}
{/if}
{#if trading}<p class="hint" role="status">Tap the cards to swap for new ones.</p>
{:else if !prompt}<h3>Your hand</h3>{/if}
<ul class="hand" aria-label="Your hand">
  {#each hand as c (c.id)}
    {@const n = chosen.indexOf(c.id)}
    {@const out = swap.includes(c.id)}
    <li>
      <button class="card" class:on={!trading && n >= 0} class:out class:blank={!c.text}
        aria-pressed={trading ? out : n >= 0} disabled={locked || (!prompt && !trading)} onclick={() => tap(c.id)}>
        {c.text || 'Blank card: write your own'}
        {#if !trading && n >= 0}<span class="badge" aria-label="choice {n + 1}">{picks === 2 ? n + 1 : '✓'}</span>{/if}
        {#if out}<span class="badge swap">Swap</span>{/if}
      </button>
    </li>
  {/each}
</ul>
{#if prompt || canTrade || trading}<div class="bar">
  {#if trading}
    <Button disabled={!swap.length || locked} onclick={trade} tip={swap.length ? 'Gives up a point and deals you new cards' : undefined}>{swap.length ? `Swap ${swap.length}` : 'Pick cards'}</Button>
    <Button variant="secondary" onclick={() => { trading = false; swap = []; }}>Cancel</Button>
  {:else}
    {#if prompt}
      <Button disabled={!ready || locked} onclick={play}>
        {ready ? (picks === 2 ? 'Play both' : 'Play') : chosen.length < picks ? (picks === 2 ? `${picks - chosen.length} more` : 'Pick card') : 'Write answer'}
      </Button>
    {/if}
    {#if canTrade}<Button variant="secondary" disabled={locked} onclick={() => { trading = true; chosen = []; }} tip="Give up a point to swap cards for new ones">{swapping ? 'Swapping…' : 'Trade point'}</Button>{/if}
  {/if}
</div>{/if}

<style>
  .top { position: sticky; top: var(--screen-head, 0px); z-index: 2; padding-bottom: var(--s-2); background: var(--bg); }
  .write { display: grid; gap: var(--s-1); font-weight: 700; }
  .write input { min-height: 48px; }
  .hint { color: var(--text-dim); }
  .hand { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--s-2); grid-template-columns: repeat(auto-fill, minmax(136px, 1fr)); }
  .card {
    position: relative; width: 100%; height: 100%; min-height: 84px; padding: var(--s-3);
    text-align: left; border: 2px solid var(--line-strong); border-radius: var(--r-md); background: var(--surface);
    color: var(--text); font: 700 1rem / 1.25 var(--font-display); overflow-wrap: anywhere;
    transition: transform var(--dur-fast) var(--ease-out), border-color var(--dur-fast) ease, background var(--dur-fast) ease;
  }
  .card:disabled { opacity: 1; cursor: default; }
  .card.blank { border-style: dashed; color: var(--text-dim); font-style: italic; }
  .card.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 18%, var(--surface)); transform: translateY(-2px); }
  .card.out { border-color: var(--c-pass); background: color-mix(in srgb, var(--c-pass) 16%, var(--surface)); }
  .badge {
    position: absolute; top: -8px; right: -6px; box-shadow: 0 0 0 3px var(--bg); min-width: 24px; height: 24px; padding: 0 6px; display: grid; place-items: center;
    border-radius: var(--r-pill); background: var(--accent); color: var(--on-accent); font: 800 0.85rem / 1 var(--font-body); font-style: normal;
  }
  .badge.swap { background: var(--c-pass); color: #1b1300; }
  .bar {
    position: sticky; bottom: 0; z-index: 2; display: grid; gap: var(--s-2); padding: var(--s-2) 0 calc(var(--safe-bottom) + var(--s-2));
    background: var(--bg); box-shadow: 0 -10px 12px -4px var(--bg);
  }
  @media (prefers-reduced-motion: reduce) { .card.on { transform: none; } }
</style>
