<script lang="ts">
  import Screen from '../components/Screen.svelte';
  import Button from '../components/Button.svelte';
  import { clearPrefix } from '../lib/storage';
  import { go } from '../lib/router.svelte';

  // Last line of defence: a game that throws shows this instead of a blank page.
  let { game, error, reset }: { game: string; error: unknown; reset: () => void } = $props();

  function startFresh() {
    clearPrefix(game + ':');
    go('/' + game, true);
    reset();
  }
</script>

<Screen title="Oops" onback={() => { go('/', true); reset(); }}>
  <h2>That didn't work</h2>
  <p class="muted">Something in this game broke. Resetting it usually fixes it: that clears this game's saved progress and settings, but keeps your own packs.</p>
  <details>
    <summary class="faint">Details</summary>
    <pre>{String((error as Error)?.message ?? error)}</pre>
  </details>
  {#snippet actions()}
    <Button size="lg" onclick={startFresh} tip="Clears this game's saved progress and settings; your packs stay">Reset game</Button>
    <Button variant="ghost" onclick={() => { go('/', true); reset(); }}>Home</Button>
  {/snippet}
</Screen>

<style>
  pre { white-space: pre-wrap; font-size: 0.85rem; color: var(--text-faint); }
</style>
