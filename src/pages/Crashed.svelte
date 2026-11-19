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
  <p class="muted">Something in this game broke. Starting it fresh usually fixes it; your own packs are kept.</p>
  <details>
    <summary class="faint">Details</summary>
    <pre>{String((error as Error)?.message ?? error)}</pre>
  </details>
  {#snippet actions()}
    <Button size="lg" onclick={startFresh}>Start this game fresh</Button>
    <Button variant="ghost" onclick={() => { go('/', true); reset(); }}>Home</Button>
  {/snippet}
</Screen>

<style>
  pre { white-space: pre-wrap; font-size: 0.85rem; color: var(--text-faint); }
</style>
