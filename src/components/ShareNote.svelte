<script lang="ts">
  import { onLibraryNote } from '../lib/library';

  // The small note a failed Community share leaves, on whatever page the player is by then
  // (a make page has usually gone back to the pack list). It fades on its own, later the more there
  // is to read; saving never waits.
  let note = $state('');
  $effect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = onLibraryNote((n) => {
      note = n;
      clearTimeout(timer);
      timer = setTimeout(() => (note = ''), Math.min(20_000, 2500 + 50 * n.length));
    });
    return () => { stop(); clearTimeout(timer); };
  });
</script>

<p class="note" class:long={note.length > 80} role="status">{note}</p>

<style>
  .note {
    position: fixed; left: 50%; bottom: calc(var(--safe-bottom) + 96px); z-index: var(--z-toast); transform: translateX(-50%);
    max-width: calc(100vw - 2 * var(--s-4)); margin: 0; padding: var(--s-2) var(--s-4); border-radius: var(--r-pill);
    background: var(--bg-raised); border: 1.5px solid var(--line-strong); color: var(--text-dim); font-size: 0.88rem;
    box-shadow: var(--shadow); pointer-events: none;
  }
  /* What to fix in the pack can be long: it scrolls rather than leave the screen. */
  .long { width: min(34rem, calc(100vw - 2 * var(--s-4))); max-height: 50vh; overflow-y: auto; overflow-wrap: anywhere; border-radius: var(--r-md); pointer-events: auto; }
  .note:empty { display: none; }
</style>
