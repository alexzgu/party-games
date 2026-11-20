<script lang="ts">
  // Placeholder until the game is built (SPEC.md).
  import Screen from '../../components/Screen.svelte';
  import { gameName } from '../../app.config';
</script>

<div class="game">
  <Screen title={gameName('salad')}>
    <p>Coming soon.</p>
  </Screen>
</div>

<style>
  .game { --accent: var(--c-salad); display: contents; }
</style>
