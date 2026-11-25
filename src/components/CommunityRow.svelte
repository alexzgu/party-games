<script lang="ts">
  import { unitOf } from '../lib/packfile';
  import type { LibraryPack } from '../lib/library';

  // One pack in the Community list: name, description, size, who shared it, stars, and whether
  // this phone has it or skips it.
  let { pack: p, owned, skipped, onopen }: { pack: LibraryPack; owned: boolean; skipped: boolean; onopen: () => void } = $props();
</script>

<button class="row" onclick={onopen}>
  <span class="txt">
    <span class="name">{p.name}</span>
    {#if p.blurb}<span class="blurb">{p.blurb}</span>{/if}
    <span class="faint meta">
      {p.count} {unitOf(p.game, p.count)}
      {#if p.username}<span class="who">{p.username}</span>{/if}
      {#if owned}<span class="mark">Owned</span>{/if}
      {#if skipped}<span class="mark">Skipped</span>{/if}
    </span>
  </span>
  <span class="stars" class:mine={p.starred} aria-label="{p.stars} stars">★ {p.stars}</span>
</button>

<style>
  .row {
    width: 100%; display: flex; align-items: center; gap: var(--s-3); padding: var(--s-3) var(--s-4); min-height: var(--tap-xl);
    border: 0; border-radius: var(--r-md); background: var(--surface); text-align: left; color: var(--text);
    transition: transform var(--dur-fast) var(--ease-out);
  }
  .row:active { transform: scale(0.98); }
  .txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .name { font-family: var(--font-display); font-weight: 800; font-size: 1.15rem; overflow-wrap: anywhere; }
  .blurb { color: var(--text-dim); font-size: 0.9rem; line-height: 1.25; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
  .meta { font-size: 0.85rem; display: flex; align-items: center; flex-wrap: wrap; gap: 2px var(--s-2); }
  /* The sharing phone's username: a small, quiet chip. */
  .who, .mark { display: inline-block; max-width: 100%; padding: 1px var(--s-2); border-radius: var(--r-pill); font-size: 0.8rem; font-weight: 600; overflow-wrap: anywhere; }
  .who { background: var(--overlay); color: var(--text-faint); }
  .mark { background: color-mix(in srgb, var(--accent) 18%, transparent); color: var(--text-dim); }
  .stars { flex: none; font-weight: 800; color: var(--text-dim); }
  .stars.mine { color: var(--accent); }
</style>
