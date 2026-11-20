<script lang="ts">
  import Screen from '../../components/Screen.svelte';
  import { brawlPacks } from '../../lib/content';
  import { back } from '../../lib/router.svelte';
  import { DRAW_TIMES, type Settings } from './logic';
  import { loadSettings } from './store';
  import { host } from './host.svelte';

  let settings = $state.raw(loadSettings());
  function update(s: Settings) {
    settings = s;
    host.settings(s);
  }
  function toggle(id: string) {
    const packs = settings.packs.includes(id) ? settings.packs.filter((p) => p !== id) : [...settings.packs, id];
    if (packs.length) update({ ...settings, packs });
  }
</script>

<Screen title="Room settings" onback={() => back('/brawl/host')}>
  <fieldset>
    <legend>Seconds per drawing</legend>
    {#each DRAW_TIMES as seconds}
      <button aria-pressed={settings.seconds === seconds} onclick={() => update({ ...settings, seconds })}>{seconds}</button>
    {/each}
  </fieldset>
  <fieldset>
    <legend>Title packs</legend>
    {#each brawlPacks() as p (p.id)}
      <label>
        <input type="checkbox" checked={settings.packs.includes(p.id)}
          disabled={settings.packs.length === 1 && settings.packs.includes(p.id)} onchange={() => toggle(p.id)} />
        <span>{p.name} · {p.titles.length} titles</span>
      </label>
    {/each}
  </fieldset>
</Screen>

<style>
  fieldset { padding: var(--s-3); margin-bottom: var(--s-3); border: 1px solid var(--line-strong); border-radius: var(--r-md); }
  legend { font-weight: 800; }
  label { display: flex; align-items: center; gap: var(--s-2); min-height: 44px; }
  button { min-width: 44px; min-height: 44px; padding: var(--s-2); border-radius: var(--r-sm); background: var(--surface); }
  button[aria-pressed='true'] { outline: 2px solid var(--accent); }
</style>
