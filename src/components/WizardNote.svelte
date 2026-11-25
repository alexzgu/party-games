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
  /* A small underlined word at the end of the note's last line. A clear area over it takes the
     taps: 46 px tall from the word's foot upward, over the note's own text, and at least 44 px
     wide; never below the note, where other controls follow it on every screen. The button's
     own box (its focus ring, its tip) stays the word. */
  .got {
    position: relative; padding: var(--s-1); margin-left: var(--s-1); border: 0; background: none; color: var(--text-dim);
    font: inherit; font-weight: 600; text-decoration: underline; text-underline-offset: 2px; white-space: nowrap;
  }
  .got::after { content: ''; position: absolute; inset: min(0px, 100% - 46px) min(0px, (100% - 44px) / 2) 0; }
</style>
