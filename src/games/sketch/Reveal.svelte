<script lang="ts">
  import InkCard from '../../components/draw/InkCard.svelte';
  import type { Drawing } from '../../lib/ink';
  import WordShape from './WordShape.svelte';
  import type { View } from './view';
  // The end of a Draw & guess turn: the word, the drawing and what each player earned.
  let { v, art }: { v: View; art: Record<string, Drawing> } = $props();
  const earned = (pid: string) => v.points?.find((x) => x.pid === pid)?.points ?? 0;
  const rows = $derived([...v.players].sort((a, b) => earned(b.pid) - earned(a.pid)));
</script>

<div class="reveal">
  <WordShape word={v.word} size="lg" />
  <div class="pic">{#if v.ink}<InkCard drawing={art[v.ink] ?? []} label="The drawing" />{/if}</div>
  <ul>
    {#each rows as p (p.pid)}
      <li><strong>{p.name}{p.pid === v.drawer ? ' (drew)' : ''}</strong><b class:none={!earned(p.pid)}>+{earned(p.pid)}</b></li>
    {/each}
  </ul>
</div>

<style>
  .reveal { display: grid; gap: var(--s-3); justify-items: center; }
  .pic { width: min(100%, 38dvh); }
  ul { list-style: none; padding: 0; display: grid; gap: var(--s-1); width: min(100%, 520px); }
  li { display: flex; justify-content: space-between; gap: var(--s-2); background: var(--surface); padding: var(--s-2) var(--s-3); border-radius: var(--r-md); }
  strong { overflow-wrap: anywhere; min-width: 0; }
  b { color: var(--c-good); }
  b.none { color: var(--text-faint); }
</style>
