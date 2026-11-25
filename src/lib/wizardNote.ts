import { saveSettings, settings } from './settings.svelte';

// The quiet note under Fizzwick's results (components/WizardNote.svelte): he writes from
// memory, so the players check. One flag for every game, kept with this phone's settings;
// storage that cannot be read or written just leaves the note showing.

export const WIZARD_NOTE = 'Fizzwick writes from memory and can get things wrong. Check anything that matters before you play.';

export const wizardNoteShows = (): boolean => !settings.wizardNoteSeen;

/** "Got it": hides the note at once and, when storage allows, for good on this phone. */
export function hideWizardNote(): void {
  settings.wizardNoteSeen = true;
  saveSettings();
}
