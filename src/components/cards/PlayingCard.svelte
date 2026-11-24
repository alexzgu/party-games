<script lang="ts">
  import { cardName, isRed, rankLabel, rankOf, suitOf, SYMBOLS, type Card } from '../../lib/cards/deck';

  // One playing card in CSS and text: its face (rank and suit in two corners and the suit in the
  // middle; hearts and diamonds red) or, with `card` null, its back. The width is the size's
  // `--card-w-*` token and the height follows. `named` gives the face its name for screen
  // readers; a card inside a labelled button leaves that to the button.
  let { card = null, size = 'md', named = true }: { card?: Card | null; size?: 'sm' | 'md' | 'lg'; named?: boolean } = $props();
  const rank = $derived(card === null ? '' : rankLabel(rankOf(card)));
  const symbol = $derived(card === null ? '' : SYMBOLS[suitOf(card)]);
</script>

{#if card === null}
  <span class="card back {size}" aria-hidden="true"></span>
{:else}
  <span class="card face {size}" class:red={isRed(card)} role={named ? 'img' : undefined} aria-label={named ? cardName(card) : undefined} aria-hidden={named ? undefined : 'true'}>
    <span class="corner"><b>{rank}</b><i>{symbol}</i></span>
    <span class="middle">{symbol}</span>
    <span class="corner end"><b>{rank}</b><i>{symbol}</i></span>
  </span>
{/if}

<style>
  .card {
    --w: var(--card-w-md);
    position: relative; display: block; flex: none; width: var(--w); aspect-ratio: 5 / 7;
    border-radius: calc(var(--w) * 0.12); border: 1px solid var(--card-edge);
    box-shadow: 0 1px 3px color-mix(in srgb, var(--shade) 30%, transparent);
  }
  .sm { --w: var(--card-w-sm); }
  .lg { --w: var(--card-w-lg); }
  .face { background: var(--card-face); color: var(--card-black); font-family: var(--font-display); }
  .red { color: var(--card-red); }
  .corner { position: absolute; top: 4%; left: 6%; display: flex; flex-direction: column; align-items: center; line-height: 0.95; }
  .corner b { font-size: calc(var(--w) * 0.3); font-weight: 800; letter-spacing: -0.04em; }
  .corner i { font-style: normal; font-size: calc(var(--w) * 0.26); }
  .end { top: auto; left: auto; bottom: 4%; right: 6%; transform: rotate(180deg); }
  .middle { position: absolute; inset: 0; display: grid; place-items: center; font-size: calc(var(--w) * 0.5); }
  .sm .end, .sm .middle { display: none; }
  .back {
    background:
      repeating-linear-gradient(45deg, transparent 0 4px, color-mix(in srgb, var(--card-back-2) 70%, transparent) 4px 6px),
      repeating-linear-gradient(-45deg, transparent 0 4px, color-mix(in srgb, var(--card-back-2) 70%, transparent) 4px 6px),
      var(--card-back);
    outline: 2px solid var(--card-face); outline-offset: -4px;
  }
  .sm.back { outline-width: 1px; outline-offset: -3px; }
</style>
