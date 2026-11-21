<script lang="ts">
  import { onLibraryNote } from '../lib/library';

  // The small note a failed Community share leaves, on whatever page the player is by then
  // (a make page has usually gone back to the pack list). It fades on its own; saving never waits.
  let note = $state('');
  $effect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = onLibraryNote((n) => {
      note = n;
      clearTimeout(timer);
      timer = setTimeout(() => (note = ''), 4000);
    });
    return () => { stop(); clearTimeout(timer); };
  });
</script>

<p class="note" role="status">{note}</p>

<style>
  .note {
    position: fixed; left: 50%; bottom: calc(var(--safe-bottom) + 96px); z-index: 60; transform: translateX(-50%);
    max-width: calc(100vw - 2 * var(--s-4)); margin: 0; padding: var(--s-2) var(--s-4); border-radius: var(--r-pill);
    background: var(--bg-raised); border: 1.5px solid var(--line-strong); color: var(--text-dim); font-size: 0.88rem;
    box-shadow: var(--shadow); pointer-events: none;
  }
  .note:empty { display: none; }
</style>
