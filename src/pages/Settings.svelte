<script lang="ts">
  import Screen from '../components/Screen.svelte';
  import Toggle from '../components/Toggle.svelte';
  import Segmented from '../components/Segmented.svelte';
  import { gameName } from '../app.config';
  import Button from '../components/Button.svelte';
  import { settings, saveSettings, applyTheme } from '../lib/settings.svelte';
  import { testKey } from '../lib/claude';
  import { sfx } from '../lib/sound';

  const MODELS = [
    { id: 'claude-opus-5-5', name: 'Opus 5.5', note: 'best ideas' },
    { id: 'claude-sonnet-5-5', name: 'Sonnet 5.5', note: 'faster' },
    { id: 'claude-haiku-5-5', name: 'Haiku 5.5', note: 'fastest, cheapest' },
  ];

  let showKey = $state(false);
  let status = $state<{ kind: 'idle' | 'busy' | 'ok' | 'err'; text: string }>({ kind: 'idle', text: '' });

  async function test() {
    saveSettings();
    status = { kind: 'busy', text: 'Checking…' };
    try {
      await testKey();
      status = { kind: 'ok', text: 'Connected. Live generation is ready.' };
      sfx.correct();
    } catch (e) {
      status = { kind: 'err', text: (e as Error).message };
    }
  }

  function clearSeen() {
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith('hr:seen:')) localStorage.removeItem(k);
    } catch { /* ignore */ }
    status = { kind: 'ok', text: 'Card history cleared. Every card can come up again.' };
  }
</script>

<Screen title="Settings" accent="var(--c-gibberish)">
  <section class="stack">
    <h3>Feel</h3>
    <Toggle label="Sound" bind:checked={settings.sound} onchange={saveSettings} hint="Plays even with the iPhone silent switch on" />
    <Toggle label="Vibration" bind:checked={settings.haptics} onchange={saveSettings} hint="Android buzzes; recent iPhones give a light tick" />
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
    <Segmented
      label="Tilt needed to score"
      options={[{ value: 'small', label: 'Small nod' }, { value: 'medium', label: 'Medium' }, { value: 'big', label: 'Big tilt' }]}
      bind:value={settings.tiltSensitivity}
      onchange={saveSettings}
    />
  </section>

  <section class="stack">
    <h3>Claude (live packs)</h3>
    <p class="muted small">Paste an Anthropic API key to make new packs on the spot from any theme. The key is stored only on this phone and sent only to Anthropic. Built-in packs work without it.</p>
    <div class="key">
      <input
        type={showKey ? 'text' : 'password'}
        placeholder="sk-ant-…"
        autocomplete="off" autocapitalize="off" spellcheck="false"
        bind:value={settings.apiKey}
        onchange={saveSettings}
        aria-label="Anthropic API key"
      />
      <button class="eye" onclick={() => (showKey = !showKey)} aria-label={showKey ? 'Hide key' : 'Show key'}>{showKey ? '🙈' : '👁️'}</button>
    </div>
    <div class="models" role="radiogroup" aria-label="Model">
      {#each MODELS as m (m.id)}
        <label class="model" class:on={settings.model === m.id}>
          <input type="radio" name="model" value={m.id} bind:group={settings.model} onchange={saveSettings} />
          <span class="mname">{m.name}</span><span class="mnote">{m.note}</span>
        </label>
      {/each}
    </div>
    <Button variant="secondary" onclick={test} disabled={!settings.apiKey.trim() || status.kind === 'busy'}>Test key</Button>
    {#if status.text}
      <p class="status {status.kind}" role="status">{status.text}</p>
    {/if}
  </section>

  <section class="stack">
    <h3>Cards</h3>
    <p class="muted small">Cards you have already seen are held back until a pack runs out, so rounds rarely repeat.</p>
    <Button variant="secondary" onclick={clearSeen}>Reset card history</Button>
  </section>
</Screen>

<style>
  section { margin-bottom: var(--s-4); }
  h3 { color: var(--text-dim); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.08em; font-family: var(--font-body); font-weight: 700; }
  .small { font-size: 0.92rem; }
  .key { position: relative; }
  .key input { padding-right: 56px; font-family: ui-monospace, monospace; }
  .eye { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); width: 44px; height: 44px; border: 0; background: transparent; font-size: 1.2rem; }
  .models { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--s-2); }
  .model { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: var(--s-3) var(--s-2);
    border-radius: var(--r-md); background: var(--surface); border: 1.5px solid transparent; cursor: pointer; min-height: 72px; }
  .model.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 16%, var(--surface)); }
  .model input { position: absolute; opacity: 0; }
  .mname { font-weight: 700; }
  .mnote { color: var(--text-faint); font-size: 0.8rem; }
  .status { padding: var(--s-3) var(--s-4); border-radius: var(--r-md); background: var(--surface); }
  .status.ok { color: var(--c-good); }
  .status.err { color: color-mix(in srgb, var(--c-bad) 55%, var(--text)); }
</style>
