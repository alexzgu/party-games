<script lang="ts">
  import { customGibberish, type GibberishPack } from '../../lib/content';
  import { sfx } from '../../lib/sound';

  // Multi-select pack tiles. Packs made on this phone carry a "Mine" tag and can be deleted.
  let { packs = $bindable(), selected = $bindable(), onmake }: { packs: GibberishPack[]; selected: string[]; onmake: () => void } = $props();
  let confirming = $state('');

  function toggle(id: string) {
    selected = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    sfx.tap();
  }

  function del(id: string) {
    if (confirming !== id) { confirming = id; return; }
    customGibberish.remove(id);
    packs = packs.filter((p) => p.id !== id);
    selected = selected.filter((x) => x !== id);
    confirming = '';
  }
</script>

<section class="packs" aria-labelledby="packs-h">
  <h3 id="packs-h">Packs</h3>
  <ul class="grid">
    {#each packs as p (p.id)}
      {@const on = selected.includes(p.id)}
      <li>
        <button class="tile" class:on aria-pressed={on} onclick={() => toggle(p.id)}>
          <span class="check" aria-hidden="true">{on ? '✓' : ''}</span>
          <span class="name">{p.name}</span>
          <span class="blurb">{p.blurb}</span>
          <span class="meta">{p.cards.length} cards{p.custom ? ' · Mine' : ''}</span>
        </button>
        {#if p.custom}
          <button class="del" class:confirm={confirming === p.id} onclick={() => del(p.id)} onblur={() => (confirming = '')}
            aria-label={confirming === p.id ? `Tap again to delete ${p.name}` : `Delete ${p.name}`}>
            {confirming === p.id ? 'Delete?' : '✕'}
          </button>
        {/if}
      </li>
    {/each}
    <li>
      <button class="tile make" onclick={onmake}>
        <span class="spark" aria-hidden="true">✨</span>
        <span class="name wide">Make a pack</span>
        <span class="blurb">Paste a list or ask Claude</span>
      </button>
    </li>
  </ul>
</section>

<style>
  .packs { display: flex; flex-direction: column; gap: var(--s-2); }
  .grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s-2); }
  li { position: relative; }
  .tile {
    width: 100%; height: 100%; min-height: 112px; text-align: left; padding: var(--s-3); border-radius: var(--r-md);
    border: 2px solid var(--line); background: var(--surface); display: flex; flex-direction: column; gap: 2px;
    transition: transform var(--dur-fast) var(--ease-out), border-color var(--dur-fast) ease, background var(--dur-fast) ease;
  }
  .tile:active { transform: scale(0.97); }
  .tile.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 18%, var(--surface)); }
  .check {
    position: absolute; top: 10px; right: 10px; width: 26px; height: 26px; border-radius: 50%;
    border: 2px solid var(--line-strong); display: grid; place-items: center; font-weight: 900; font-size: 0.9rem;
  }
  .tile.on .check { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
  .name { font-family: var(--font-display); font-weight: 800; font-size: 1.15rem; line-height: 1.1; padding-right: 30px; }
  .name.wide { padding-right: 0; }
  .blurb { color: var(--text-dim); font-size: 0.85rem; line-height: 1.25; flex: 1; }
  .meta { color: var(--text-faint); font-size: 0.8rem; font-weight: 600; }
  .make { border-style: dashed; border-color: color-mix(in srgb, var(--accent) 55%, transparent); background: transparent; }
  .spark { font-size: 1.4rem; }
  .del {
    position: absolute; bottom: 6px; right: 6px; min-width: 44px; height: 44px; padding: 0 var(--s-2);
    border: 0; border-radius: var(--r-pill); background: transparent; color: var(--text-faint); font-weight: 700;
  }
  .del.confirm { background: color-mix(in srgb, var(--c-bad) 30%, var(--surface)); color: var(--text); }
</style>
