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
  /* Drawn as a small underlined word at the end of the note's last line, tapped as a 46 px tall
     target that reaches up over the note's own text and never below the note, where other
     controls follow it on every screen. The clear padding over the word is taken back by a
     negative margin, so the line is no taller than the word needs. */
  .got {
    --reach: max(0px, 46px - 1lh - 2 * var(--s-1));
    padding: calc(var(--s-1) + var(--reach)) var(--s-1) var(--s-1); margin: calc(-1 * var(--reach)) 0 0 var(--s-1);
    min-width: 44px; border: 0; background: none; color: var(--text-dim);
    font: inherit; font-weight: 600; text-decoration: underline; text-underline-offset: 2px; white-space: nowrap;
  }
</style>
