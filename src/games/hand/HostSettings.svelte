<script lang="ts">
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import Segmented from '../../components/Segmented.svelte';
  import Toggle from '../../components/Toggle.svelte';
  import { handPacks } from '../../lib/content';
  import { back } from '../../lib/router.svelte';
  import { ANSWER_TIMES, TARGETS, type Settings } from './logic';
  import { loadSettings } from './store';
  import { host } from './host.svelte';

  // Saved on this device; a game already started keeps the settings it started with.
  const saved = loadSettings();
  let settings = $state.raw(saved);
  const packs = handPacks();
  const locked = host.game !== null && host.game.phase !== 'lobby';
  let seconds = $state(saved.seconds);
  let target = $state(saved.target);
  let trade = $state(saved.trade);
  let house = $state(saved.house);
  let blanks = $state(saved.blanks);
  function update(patch: Partial<Settings>) {
    settings = { ...settings, ...patch };
    host.settings(settings);
  }
  function toggle(id: string) {
    const chosen = settings.packs.filter((p) => packs.some((x) => x.id === p));
    const next = chosen.includes(id) ? chosen.filter((p) => p !== id) : [...chosen, id];
    if (next.length) update({ packs: next });
  }
  const on = (id: string) => settings.packs.includes(id) || !packs.some((p) => settings.packs.includes(p.id));
</script>

<Screen title="Room settings" onback={() => back('/hand/host')}>
  <div class="settings">
    {#if locked}<p class="note">A game is running: these apply to the next one.</p>{/if}
    <fieldset>
      <legend>Card packs</legend>
      {#each packs as p (p.id)}
        <label>
          <input type="checkbox" checked={on(p.id)} disabled={on(p.id) && packs.filter((x) => on(x.id)).length === 1} onchange={() => toggle(p.id)} />
          <span>{p.name} · {p.prompts.length} prompts, {p.answers.length} answers</span>
        </label>
      {:else}<p>No card packs yet.</p>{/each}
    </fieldset>
    <Segmented label="Seconds to answer" bind:value={seconds} onchange={() => update({ seconds })}
      options={ANSWER_TIMES.map((s) => ({ value: s as number, label: s ? `${s}` : 'No limit' }))} />
    <Segmented label="Points to win" bind:value={target} onchange={() => update({ target })}
      options={TARGETS.map((t) => ({ value: t as number, label: `${t}` }))} />
    <h3>House rules</h3>
    <Toggle bind:checked={trade} label="Trade a point" hint="Give up a point to swap any of your cards for new ones, outside judging."
      onchange={() => update({ trade })} />
    <Toggle bind:checked={house} label="House player" hint="Each round the house plays random cards from the deck, as many as the prompt takes. If the house reaches the target, everyone loses."
      onchange={() => update({ house })} />
    <Toggle bind:checked={blanks} label="Blank cards" hint="About one card in twenty is blank: write your own answer when you play it."
      onchange={() => update({ blanks })} />
  </div>
  {#snippet actions()}<Button size="lg" onclick={() => back('/hand/host')}>Done</Button>{/snippet}
</Screen>

<style>
  .settings { display: grid; gap: var(--s-3); }
  fieldset { padding: var(--s-3); border: 1px solid var(--line-strong); border-radius: var(--r-md); }
  legend { font-weight: 800; }
  label { display: flex; align-items: center; gap: var(--s-2); min-height: 44px; }
  .note { padding: var(--s-3) var(--s-4); border-radius: var(--r-md); background: color-mix(in srgb, var(--c-pass) 14%, var(--surface)); font-weight: 600; }
</style>
