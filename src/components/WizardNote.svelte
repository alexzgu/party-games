<script lang="ts">
  import { hideWizardNote, wizardNoteShows, WIZARD_NOTE } from '../lib/wizardNote';

  // One muted line wherever items Fizzwick wrote are on screen, until "Got it" (lib/wizardNote.ts).
</script>

{#if wizardNoteShows()}
  <p class="wizard-note">
    <span>{WIZARD_NOTE}</span>
    <button type="button" class="got" data-tip="Don't show this again" onclick={hideWizardNote}>Got it</button>
  </p>
{/if}

<style>
  .wizard-note { margin: 0; color: var(--text-faint); font-size: 0.85rem; line-height: 1.35; }
  .got {
    padding: var(--s-1) var(--s-1); margin-left: var(--s-1); border: 0; background: none; color: var(--text-dim);
    font: inherit; font-weight: 600; text-decoration: underline; text-underline-offset: 2px; white-space: nowrap;
  }
</style>
