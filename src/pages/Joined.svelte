<script lang="ts">
  import Screen from '../components/Screen.svelte';
  import Button from '../components/Button.svelte';

  // After an invite link: says whether the wizard moved in (the key was stored) or the link was broken.
  let { ok, ondone }: { ok: boolean; ondone: () => void } = $props();
</script>

<Screen onback={ondone} backLabel="Main menu">
  <div class="joined pop-in">
    <p class="wizard" aria-hidden="true">🧙</p>
    {#if ok}
      <h2>Fizzwick the Wizard has moved in on this phone.</h2>
      <p class="muted">He makes new packs from any theme: pick “Ask the wizard” when you make a pack.</p>
    {:else}
      <h2>This invite link is broken.</h2>
      <p class="muted">Nothing was saved. Ask the host to send the link again.</p>
    {/if}
  </div>
  {#snippet actions()}
    <Button size="lg" onclick={ondone}>To the main menu</Button>
  {/snippet}
</Screen>

<style>
  .joined { display: flex; flex-direction: column; align-items: center; text-align: center; gap: var(--s-3); padding-top: var(--s-6); }
  .wizard { font-size: 4rem; margin: 0; }
</style>
