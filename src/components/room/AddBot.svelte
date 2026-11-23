<script lang="ts">
  import Button from '../Button.svelte';

  // Host lobby: seats a bot (a pretend phone this screen plays), for trying a game without a
  // phone for every seat. `onadd` returns why the room refused it, or null.
  let { onadd, full }: { onadd: () => string | null; full: boolean } = $props();
  let why = $state('');
  let clear: ReturnType<typeof setTimeout> | undefined;

  function add() {
    why = onadd() ?? '';
    clearTimeout(clear);
    if (why) clear = setTimeout(() => (why = ''), 4000);
  }
</script>

<div class="add">
  <Button size="sm" variant="secondary" disabled={full} onclick={add} tip="Adds a pretend player that this screen plays">🤖 Add bot</Button>
  {#if why}<span class="why" role="status">{why}</span>{/if}
</div>

<style>
  .add { display: flex; align-items: center; gap: var(--s-2); flex-wrap: wrap; }
  .why { color: var(--text-dim); font-size: 0.9rem; }
</style>
