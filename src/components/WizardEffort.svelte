<script lang="ts">
  import { hasKey } from '../lib/claude';
  import { settings, saveSettings } from '../lib/settings.svelte';
  import { EFFORTS, modelFor } from '../lib/wizard';
  import { sfx } from '../lib/sound';
  import { haptic } from '../lib/haptics';
  import { libraryOn, sharesPacks, SHARED_NOTE } from '../lib/library';
  import { route } from '../lib/router.svelte';

  // "How hard Fizzwick tries": picks the model on the page where a pack is made. Three tiles
  // (emoji over a short name) like Segmented, since the names are too long for one pill row.
  const current = $derived(modelFor(settings.model));
  const hint = $derived(EFFORTS.find((e) => e.id === current)?.hint ?? '');
  // Every wizard form has this box, so it also says, once, that what Fizzwick makes is shared:
  // only for a game in the Community library (the page's first address part) on a phone with a pass.
  const shared = $derived(sharesPacks() && libraryOn(route.path.split('/').filter(Boolean)[0] ?? ''));

  function pick(id: string) {
    if (id === settings.model) return;
    settings.model = id;
    saveSettings();
    sfx.tick();
    haptic.light();
  }
</script>

{#if hasKey()}
  <div class="effort">
    <span class="lbl" id="wizard-effort">How hard Fizzwick tries</span>
    <div class="seg" role="radiogroup" aria-labelledby="wizard-effort">
      {#each EFFORTS as e (e.id)}
        <button type="button" role="radio" aria-checked={e.id === current} class:on={e.id === current} onclick={() => pick(e.id)}>
          <span class="emoji" aria-hidden="true">{e.emoji}</span>
          <span>{e.label}</span>
        </button>
      {/each}
    </div>
    <p class="hint faint">{hint}</p>
    {#if shared}<p class="hint faint shared">{SHARED_NOTE}</p>{/if}
  </div>
{/if}

<style>
  .effort { display: flex; flex-direction: column; gap: var(--s-1); }
  .lbl { font-weight: 600; color: var(--text-dim); font-size: 0.92rem; }
  .seg { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; padding: 4px; background: var(--bg-sunk); border-radius: var(--r-md); border: 1.5px solid var(--line); }
  button {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
    min-height: 64px; padding: var(--s-2) var(--s-1); border: 0; border-radius: calc(var(--r-md) - 4px);
    background: transparent; color: var(--text-dim); font-family: var(--font-display); font-weight: 700; font-size: 0.95rem; line-height: 1.15;
    transition: background var(--dur) var(--ease-out), color var(--dur) ease, transform var(--dur-fast) var(--ease-out);
  }
  button:active { transform: scale(0.96); }
  .on { background: var(--accent); color: var(--on-accent); }
  .emoji { font-size: 1.3rem; }
  .hint { margin: 0; font-size: 0.9rem; }
  .shared { font-size: 0.82rem; }
</style>
