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
  import { inviteLink, keyFromInvite } from '../lib/invite';
  import { WIZARD_SERVER, redeemPhrase, redeemMessage } from '../lib/wizardServer';
  import { sfx, unlockAudio } from '../lib/sound';
  import { haptic } from '../lib/haptics';

  // Set when Copy invite link could not reach the clipboard: the link is shown to copy by hand.
  let shownLink = $state('');
  let copied = $state(false);
  let cleared = $state(false);

  async function copyInvite() {
    const link = inviteLink(settings.apiKey.trim(), location.origin + location.pathname);
    try {
      await navigator.clipboard.writeText(link);
      copied = true;
      shownLink = '';
      sfx.correct();
    } catch {
      copied = false;
      shownLink = link;
    }
  }

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

  // An iPhone Home Screen app keeps its own storage, apart from Safari where a tapped link opens,
  // so the invite link can also be pasted here, inside the app.
  let pasted = $state('');
  let pasteBad = $state(false);
  function usePasted() {
    const key = keyFromInvite(pasted.trim().replace(/^[^#]*#/, ''));
    pasteBad = !key;
    if (!key) return;
    settings.apiKey = key;
    saveSettings();
    pasted = '';
    wordsNote = '';
    sfx.correct();
  }

  function removeWizard() {
    settings.apiKey = '';
    saveSettings();
    shownLink = '';
    copied = false;
  }

  // The magic words: sent once to the wizard server, which answers with a pass kept on this phone
  // (never the words themselves, never in a URL, never in an invite link).
  let words = $state('');
  let showWords = $state(false);
  let saying = $state(false);
  let wordsNote = $state('');
  let wordsOk = $state(false);
  const hasPass = $derived(!!WIZARD_SERVER && settings.wizardPass.trim().length > 0);
  async function sayWords() {
    if (!words.trim() || saying) return;
    saying = true;
    wordsNote = '';
    const r = await redeemPhrase(words);
    saying = false;
    wordsOk = r.ok;
    wordsNote = redeemMessage(r);
    if (!r.ok) return;
    settings.wizardPass = r.token;
    saveSettings();
    words = '';
    showWords = false;
    sfx.correct();
  }

  function forgetWords() {
    settings.wizardPass = '';
    saveSettings();
    wordsNote = '';
  }

  function clearSeen() {
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith('hr:seen:')) localStorage.removeItem(k);
    } catch { /* ignore */ }
    cleared = true;
  }
</script>

<Screen title="Settings" accent="var(--c-gibberish)">
  <section class="stack">
    <h3>Feel</h3>
    <Toggle label="Sound" bind:checked={settings.sound} onchange={soundChanged} hint="Plays even with the iPhone silent switch on" />
    <Toggle label="Vibration" bind:checked={settings.haptics} onchange={hapticsChanged} hint="Android buzzes only when the phone is not on silent (Chrome skips it then; vibrate mode works). Recent iPhones give a light tick." />
  </section>

  <section class="stack">
    <h3>Look</h3>
    <Segmented
      label="Colours"
      options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'system', label: 'Match phone' }]}
      bind:value={settings.theme}
      onchange={() => { saveSettings(); applyTheme(); }}
    />
  </section>

  <section class="stack">
    <h3>{gameName('forehead')}</h3>
    <Segmented
      label="When a word is scored"
      options={[{ value: 'edge', label: 'Light the edge' }, { value: 'screen', label: 'Flash the screen' }]}
      bind:value={settings.headsDownFeedback}
      onchange={saveSettings}
    />
    <p class="faint">Light the edge: the edge on the side you tilted glows. Flash the screen: the whole screen turns green or amber.</p>
    <Button variant="secondary" onclick={() => go('/forehead/calibrate')}>Calibrate tilt</Button>
    <p class="faint">Tilt: {calibration.th ? `calibrated on this phone (got it at ${Math.round(calibration.th.down)}°, pass at ${Math.round(calibration.th.up)}°)` : 'not calibrated yet, standard settings'}. Calibrating takes half a minute and makes tilts count reliably for whoever did it.</p>
    <TiltCheck />
  </section>

  <section class="stack">
    <h3>The wizard</h3>
    {#if settings.apiKey.trim()}
      <p class="muted small">🧙 Fizzwick the Wizard lives on this phone: he can make packs from any theme.</p>
      <Button variant="secondary" onclick={copyInvite}>Copy invite link</Button>
      {#if copied}<p class="status ok" role="status">Copied.</p>{/if}
      {#if shownLink}
        <label class="stack">
          <span class="faint small">Copying didn't work here. Select the link and copy it:</span>
          <input class="link-out" type="text" readonly value={shownLink} onfocus={(e) => e.currentTarget.select()} />
        </label>
      {/if}
      <p class="faint small">Send it privately: anyone with the link can use the wizard.</p>
      <button type="button" class="remove" onclick={removeWizard}>Remove from this phone</button>
    {:else}
      <!-- No key of its own. A pass from the magic words may be here; an invite link can still be
           pasted, and a key, once stored, is used instead of the pass. -->
      {#if hasPass}
        <p class="muted small">🧙 Fizzwick came because of the magic words: he can make packs from any theme.</p>
        <button type="button" class="remove" onclick={forgetWords}>Forget the magic words</button>
        <p class="faint small">Got an invite link from the host? Paste it here instead:</p>
      {:else}
        <p class="muted small">🧙 Fizzwick the Wizard is not on this phone yet. Open the invite link the host sent you, or paste it here (needed for an iPhone Home Screen app):</p>
      {/if}
      <input type="text" placeholder="Paste the invite link" autocomplete="off" autocapitalize="off" spellcheck="false" bind:value={pasted} oninput={() => (pasteBad = false)} aria-label="Invite link" />
      <Button variant="secondary" onclick={usePasted} disabled={!pasted.trim()}>Let him in</Button>
      {#if pasteBad}<p class="status err" role="status">That isn't a working invite link. Ask the host to send it again.</p>{/if}
      {#if WIZARD_SERVER && !hasPass}
        <p class="muted small">Or say the magic words the host told you:</p>
        <div class="words">
          <input type={showWords ? 'text' : 'password'} placeholder="The magic words" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go"
            maxlength="200" bind:value={words} oninput={() => (wordsNote = '')} onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void sayWords(); } }} aria-label="Magic words" />
          <button type="button" class="show" onclick={() => (showWords = !showWords)} aria-pressed={showWords}>{showWords ? 'Hide' : 'Show'}</button>
        </div>
        <Button variant="secondary" onclick={sayWords} disabled={!words.trim() || saying}>{saying ? 'Listening…' : 'Say them'}</Button>
      {/if}
    {/if}
    {#if wordsNote}<p class="status" class:ok={wordsOk} class:err={!wordsOk} role="status">{wordsNote}</p>{/if}
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
  .words { display: flex; gap: var(--s-2); }
  .words input { flex: 1; min-width: 0; }
  .show { min-height: var(--tap); padding: 0 var(--s-3); border: 1.5px solid var(--line-strong); border-radius: var(--r-md); background: var(--surface); color: var(--text-dim); font-weight: 600; }
  .link-out { font-family: ui-monospace, monospace; font-size: 0.85rem; }
  .remove { align-self: flex-start; min-height: 44px; padding: 0; border: 0; background: none; color: var(--text-dim); font-size: 0.92rem; text-decoration: underline; text-underline-offset: 3px; }
  .status { padding: var(--s-3) var(--s-4); border-radius: var(--r-md); background: var(--surface); }
  .status.ok { color: var(--c-good); }
  .status.err { color: color-mix(in srgb, var(--c-bad) 55%, var(--text)); }
</style>
