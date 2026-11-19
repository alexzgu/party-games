<script lang="ts">
  import { customGibberish, type GibberishPack } from '../../lib/content';
  import { sfx } from '../../lib/sound';

  // Multi-select pack tiles. Tapping a tile ticks it; the pencil in its corner opens the pack
  // to see, edit or delete its cards. Own packs carry "Mine", edited built-ins "Edited".
  let { packs, selected = $bindable(), onmake, onedit }: {
    packs: GibberishPack[];
    selected: string[];
    onmake: () => void;
    onedit: (packId: string) => void;
  } = $props();

  function toggle(id: string) {
    selected = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    sfx.tap();
  }

  const tag = (p: GibberishPack) => (p.custom ? ' · Mine' : customGibberish.isEdited(p.id) ? ' · Edited' : '');
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
          <span class="meta">{p.cards.length} cards{tag(p)}</span>
        </button>
        <button class="edit" onclick={() => onedit(p.id)} aria-label="See and edit {p.name}">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/></svg>
        </button>
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
  .meta { color: var(--text-faint); font-size: 0.8rem; font-weight: 600; padding-right: 40px; min-height: 30px; display: flex; align-items: flex-end; }
  .make { border-style: dashed; border-color: color-mix(in srgb, var(--accent) 55%, transparent); background: transparent; }
  .spark { font-size: 1.4rem; }
  /* 44px to tap, drawn as a smaller circle so it reads as part of the tile */
  .edit {
    position: absolute; bottom: 2px; right: 2px; width: 48px; height: 48px; padding: 0;
    border: 0; background: transparent; color: var(--text-dim); display: grid; place-items: center;
  }
  .edit::before {
    content: ''; position: absolute; inset: 7px; border-radius: 50%;
    background: rgb(255 255 255 / 0.08); border: 1.5px solid var(--line-strong);
  }
  .edit svg { position: relative; }
  .edit:active::before { background: color-mix(in srgb, var(--accent) 30%, var(--surface)); }
</style>
