<script lang="ts">
  import { untrack } from 'svelte';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import Segmented from '../../components/Segmented.svelte';
  import RulesCard from '../../components/RulesCard.svelte';
  import { sketchPacks } from '../../lib/content';
  import { back } from '../../lib/router.svelte';
  import { DRAW_TIMES, GUESS_TIMES, ROUND_CHOICES, WRITE_TIMES, type Mode } from './core';
  import { loadSettings } from './store';
  import { host } from './host.svelte';
  import { settingsSummary } from './summary';

  // The room's settings: mode and packs on the page, the mode's timers behind the Rules row.
  // Saved on this device at once and into the lobby's game; a game already running keeps its own.
  const s = loadSettings();
  const packs = sketchPacks();
  let mode = $state<Mode>(s.mode);
  let writeSecs = $state(s.writeSecs);
  let drawSecs = $state(s.drawSecs);
  let rounds = $state(s.rounds);
  let guessSecs = $state(s.guessSecs);
  let chosen = $state(s.packs.filter((id) => packs.some((p) => p.id === id)));
  const settings = $derived({ mode, writeSecs, drawSecs, rounds, guessSecs, packs: chosen.length ? [...chosen] : s.packs });
  const locked = host.game !== null && host.game.phase !== 'lobby';
  const options = (xs: readonly number[]) => xs.map((x) => ({ value: x, label: `${x}` }));

  $effect(() => {
    const next = settings;
    untrack(() => host.settings(next));
  });
  function toggle(id: string) {
    const next = chosen.includes(id) ? chosen.filter((p) => p !== id) : [...chosen, id];
    if (next.length) chosen = next;
  }
</script>

<Screen title="Room settings" onback={() => back('/sketch/host')}>
  {#if locked}<p class="note">A game is running: these apply to the next one.</p>{/if}
  <div class="opt">
    <span class="label">Mode</span>
    <Segmented label="Mode" bind:value={mode} options={[{ value: 'telephone', label: 'Telephone' }, { value: 'guess', label: 'Draw & guess' }]} />
    <span class="hint">{mode === 'telephone' ? 'Write, draw, describe, pass it on; then laugh at the album. No scores.' : 'Take turns drawing a word while the others race to guess it.'}</span>
  </div>
  <fieldset>
    <legend>Packs</legend>
    {#each packs as p (p.id)}
      <label>
        <input type="checkbox" checked={chosen.includes(p.id)} disabled={chosen.length === 1 && chosen.includes(p.id)} onchange={() => toggle(p.id)} />
        <span>{p.name} · {mode === 'telephone' ? `${p.ideas.length} ideas` : `${p.words.length} words`}</span>
      </label>
    {:else}<p class="hint">No packs yet: the game uses a few spare words.</p>{/each}
  </fieldset>
  {#snippet actions()}
    <RulesCard compact summary={settingsSummary(settings)}>
      {#if mode === 'telephone'}
        <div class="opt">
          <span class="label">Seconds to write</span>
          <Segmented label="Seconds to write" bind:value={writeSecs} options={options(WRITE_TIMES)} />
          <span class="hint">For the first line and every description.</span>
        </div>
        <div class="opt">
          <span class="label">Seconds to draw</span>
          <Segmented label="Seconds to draw" bind:value={drawSecs} options={options(DRAW_TIMES)} />
        </div>
        <p class="hint">As many steps as players.</p>
      {:else}
        <div class="opt">
          <span class="label">Rounds</span>
          <Segmented label="Rounds" bind:value={rounds} options={options(ROUND_CHOICES)} />
          <span class="hint">Each round everyone draws once.</span>
        </div>
        <div class="opt">
          <span class="label">Seconds to draw</span>
          <Segmented label="Seconds to draw" bind:value={guessSecs} options={options(GUESS_TIMES)} />
        </div>
      {/if}
    </RulesCard>
    <Button size="lg" onclick={() => back('/sketch/host')}>Done</Button>
  {/snippet}
</Screen>

<style>
  .opt { display: flex; flex-direction: column; gap: var(--s-2); background: var(--surface); border-radius: var(--r-md); padding: var(--s-3) var(--s-3) var(--s-3) var(--s-4); margin-bottom: var(--s-3); }
  .label, legend { font-weight: 700; }
  .hint { color: var(--text-faint); font-size: 0.88rem; }
  fieldset { padding: var(--s-3); margin: 0 0 var(--s-3); border: 1px solid var(--line-strong); border-radius: var(--r-md); }
  label { display: flex; align-items: center; gap: var(--s-2); min-height: 44px; }
  input { width: 22px; height: 22px; accent-color: var(--accent); }
  .note { margin-bottom: var(--s-3); padding: var(--s-3) var(--s-4); border-radius: var(--r-md); background: color-mix(in srgb, var(--c-pass) 14%, var(--surface)); font-weight: 600; }
</style>
