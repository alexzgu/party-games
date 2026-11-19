<script lang="ts">
  import type { QuizBoard } from '../../lib/content';

  // A small picture of a board while Claude writes it: categories across, levels down, each tile
  // lighting up with its answer the moment its clue arrives.
  let { board }: { board: QuizBoard } = $props();
  const len = $derived(board.categories[0]?.clues.length ?? 0);
</script>

<div class="preview" style:--cols={board.categories.length} aria-label="Board so far">
  {#each board.categories as c, i (i)}
    <div class="head" class:named={c.clues.some((k) => k.clue)}>{c.name}</div>
  {/each}
  {#each Array.from({ length: len }, (_, r) => r) as r (r)}
    {#each board.categories as c, i (i)}
      {@const k = c.clues[r]}
      {#if k?.clue}
        <div class="tile on pop-in" title={k.clue}><span>{k.answer}</span></div>
      {:else}
        <div class="tile"><span class="v">{(r + 1) * 100}</span></div>
      {/if}
    {/each}
  {/each}
</div>

<style>
  .preview { display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); gap: 4px; }
  .head {
    min-height: 40px; padding: 4px; border-radius: var(--r-sm); display: grid; place-items: center; text-align: center;
    font-size: 0.68rem; font-weight: 800; text-transform: uppercase; line-height: 1.1; overflow-wrap: anywhere; color: var(--text-faint);
    background: var(--bg-sunk); border: 1px solid var(--line);
  }
  .head.named { color: var(--text); background: color-mix(in srgb, var(--accent) 16%, var(--bg-raised)); border-color: color-mix(in srgb, var(--accent) 45%, transparent); }
  .tile {
    min-height: 40px; padding: 3px; border-radius: var(--r-sm); display: grid; place-items: center; text-align: center;
    background: var(--surface); border: 1px solid var(--line); font-size: 0.68rem; line-height: 1.1; overflow: hidden;
  }
  .tile span { overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .v { color: var(--text-faint); font-weight: 800; font-family: var(--font-display); }
  .tile.on { background: color-mix(in srgb, var(--accent) 22%, var(--surface)); border-color: var(--accent); font-weight: 700; }
</style>
