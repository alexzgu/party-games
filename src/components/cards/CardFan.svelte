<script lang="ts">
  import { cardName, type Card } from '../../lib/cards/deck';
  import { fanLayout } from '../../lib/cards/fan';
  import PlayingCard from './PlayingCard.svelte';

  // A hand of cards. Face up (`cards`): side by side when they fit, else overlapping in rows
  // (lib/cards/fan.ts), so 30 cards fit a 360 px phone with each one's corner showing. With
  // `onpick` each card is a button; `selected` cards stand raised and outlined in the accent.
  // Face down (`backs`, a count): a short overlapping row of backs and the count, for a table.
  let { cards = [], backs, selected = [], size = 'md', onpick, disabled = false, label = 'Your hand' }: {
    cards?: readonly Card[]; backs?: number; selected?: readonly Card[]; size?: 'sm' | 'md' | 'lg';
    onpick?: (card: Card) => void; disabled?: boolean; label?: string;
  } = $props();

  let room = $state(0);
  let w = $state(0);
  const fan = $derived(fanLayout(cards.length, room, w));
  /** At most this many backs show; the count says the rest. */
  const STACK = 6;
</script>

{#if backs !== undefined}
  <span class="backs {size}" role="img" aria-label="{backs} {backs === 1 ? 'card' : 'cards'}">
    <span class="pile">
      {#each Array.from({ length: Math.min(backs, STACK) }) as _, i (i)}<PlayingCard {size} />{/each}
    </span>
    <b>{backs}</b>
  </span>
{:else}
  <div class="fan" bind:clientWidth={room}>
    <span class="probe {size}" bind:offsetWidth={w}></span>
    <ul aria-label={label} style:width="{fan.width}px" style:height="{fan.height}px">
      {#each cards as card, i (card)}
        {@const on = selected.includes(card)}
        <li class:on style:left="{(i % fan.perRow) * fan.strip}px" style:top="{Math.floor(i / fan.perRow) * fan.step}px">
          {#if onpick}
            <button aria-label={cardName(card)} aria-pressed={on} {disabled} onclick={() => onpick?.(card)}><PlayingCard {card} {size} named={false} /></button>
          {:else}<PlayingCard {card} {size} />{/if}
        </li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  .fan { position: relative; width: 100%; }
  .probe { position: absolute; visibility: hidden; width: var(--card-w-md); height: 0; }
  .probe.sm { width: var(--card-w-sm); }
  .probe.lg { width: var(--card-w-lg); }
  ul { position: relative; list-style: none; margin: var(--s-2) auto 0; padding: 0; }
  li { position: absolute; transition: transform var(--dur-fast) var(--ease-out); }
  li.on { transform: translateY(calc(-1 * var(--s-2))); }
  li.on :global(.card) { outline: 3px solid var(--accent); outline-offset: 1px; }
  button { display: block; padding: 0; border: 0; background: none; border-radius: var(--r-sm); }
  button:disabled { cursor: default; }
  .backs { display: inline-flex; align-items: center; gap: var(--s-2); }
  .pile { display: flex; }
  .pile > :global(.card + .card) { margin-left: calc(var(--card-w-md) * -0.72); }
  .sm .pile > :global(.card + .card) { margin-left: calc(var(--card-w-sm) * -0.72); }
  .lg .pile > :global(.card + .card) { margin-left: calc(var(--card-w-lg) * -0.72); }
  .backs b { font: 800 1.2rem / 1 var(--font-display); min-width: 1.5em; }
</style>
