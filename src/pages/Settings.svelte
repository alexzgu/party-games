<script lang="ts">
  import Screen from '../components/Screen.svelte';
  import Toggle from '../components/Toggle.svelte';
  import Segmented from '../components/Segmented.svelte';
  import { gameName } from '../app.config';
  import Button from '../components/Button.svelte';
  import TiltCheck from '../components/TiltCheck.svelte';
  import { calibration } from '../games/forehead/calibration.svelte';
  import { go } from '../lib/router.svelte';
  import { settings, saveSettings, applyTheme } from '../lib/settings.svelte';
  import MagicWords from '../components/MagicWords.svelte';
  import { hasKey } from '../lib/claude';
  import { sfx, unlockAudio } from '../lib/sound';
  import { haptic } from '../lib/haptics';
  import UsernameField from '../components/UsernameField.svelte';
  import { device, soundHint, vibrationHint } from '../lib/device';

  let cleared = $state(false);

  // Switching Sound or Vibration on plays a sample, so anyone can tell at once whether this phone does it.
  function soundChanged() {
    saveSettings();
    if (!settings.sound) return;
    unlockAudio();
    sfx.correct();
  }

  function hapticsChanged() {
    saveSettings();
    if (settings.haptics) haptic.pass();
  }

  const hasWizard = $derived(hasKey());

  /** Sends Fizzwick away from this phone, however he came. */
  let sureForget = $state(false);
  function forgetWords() {
    if (!sureForget) { sureForget = true; return; } // he only comes back with the magic words
    sureForget = false;
    settings.wizardPass = '';
    settings.apiKey = '';
    saveSettings();
  }

  function clearSeen() {
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith('hr:seen:')) localStorage.removeItem(k);
    } catch { /* ignore */ }
    cleared = true;
  }
</script>

<Screen title="Settings" accent="var(--c-gibberish)">
  <UsernameField />

  <section class="stack">
    <h3>Feel</h3>
    <Toggle label="Sound" bind:checked={settings.sound} onchange={soundChanged} hint={soundHint(device)} />
    <Toggle label="Vibration" bind:checked={settings.haptics} onchange={hapticsChanged} hint={vibrationHint(device)} />
  </section>

  <section class="stack">
    <h3>Look</h3>
    <Segmented
      label="Colours"
      options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'system', label: 'Match phone' }]}
      bind:value={settings.theme}
      onchange={() => { saveSettings(); applyTheme(); }}
    />
    <Segmented
      label="Pack lists"
      options={[{ value: 'tiles', label: 'Tiles' }, { value: 'rows', label: 'List' }]}
      bind:value={settings.packView}
      onchange={saveSettings}
    />
    <p class="faint">How every game shows its packs on setup. The switch beside a pack list's search changes it too.</p>
  </section>

  <section class="stack">
    <h3>{gameName('forehead')}</h3>
    <Segmented
      label="When a word is scored"
      options={[{ value: 'edge', label: 'Light the edge' }, { value: 'screen', label: 'Flash the screen' }]}
      bind:value={settings.headsDownFeedback}
      onchange={saveSettings}
    />
    <p class="faint"><b>Light the edge:</b> the edge on the side you tilted glows. <b>Flash the screen:</b> the whole screen turns green or amber.</p>
    <Button variant="secondary" onclick={() => go('/forehead/calibrate')}>Calibrate tilt</Button>
    <p class="faint">Tilt: {calibration.th ? `calibrated on this phone (got it at ${Math.round(calibration.th.down)}°, pass at ${Math.round(calibration.th.up)}°)` : 'not calibrated yet, standard settings'}. Calibrating takes half a minute and makes tilts count reliably for whoever did it.</p>
    <TiltCheck />
  </section>

  <section class="stack">
    <h3>The wizard</h3>
    {#if hasWizard}
      <p class="muted small">🧙 Fizzwick the Wizard lives on this phone: he can make packs from any theme.</p>
      <button type="button" class="remove" onclick={forgetWords}>{sureForget ? 'Tap again: he only comes back with the magic words' : 'Send Fizzwick away'}</button>
    {/if}
    <MagicWords />
  </section>

  <section class="stack">
    <h3>Cards</h3>
    <p class="muted small">Cards you have already seen are held back until a pack runs out, so rounds rarely repeat.</p>
    <Button variant="secondary" onclick={clearSeen}>Reset card history</Button>
    {#if cleared}<p class="status ok" role="status">Card history cleared. Every card can come up again.</p>{/if}
  </section>
</Screen>

<style>
  section { margin-bottom: var(--s-4); }
  /* Descriptions, here and in the switches and tilt check: brighter, bolder, a touch larger. */
  section :global(:is(.faint, .muted, .hint)) { color: var(--text-dim); font-weight: 600; font-size: 0.98rem; }
  h3 { color: var(--text-dim); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.08em; font-family: var(--font-body); font-weight: 700; }
  .small { font-size: 0.92rem; }
  .remove { align-self: flex-start; min-height: 44px; padding: 0; border: 0; background: none; color: var(--text-dim); font-size: 0.92rem; text-decoration: underline; text-underline-offset: 3px; }
  .status { padding: var(--s-3) var(--s-4); border-radius: var(--r-md); background: var(--surface); }
  .status.ok { color: var(--c-good); }
</style>
