<script lang="ts">
  import { gameName } from '../../app.config';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import Stepper from '../../components/Stepper.svelte';
  import Toggle from '../../components/Toggle.svelte';
  import { spectrumPacks, customSpectra, type SpectrumPack } from '../../lib/content';
  import { go } from '../../lib/router.svelte';
  import { teamColor } from './look';
  import { saveConfig } from './persist';
  import type { Config } from './state';

  let { config, onstart, onmake }: { config: Config; onstart: (c: Config) => void; onmake: () => void } = $props();

  let packs = $state<SpectrumPack[]>(spectrumPacks());
  // svelte-ignore state_referenced_locally
  let cfg = $state<Config>({ ...config, names: [...config.names], packIds: config.packIds.filter((id) => packs.some((p) => p.id === id)) });
  let confirmDelete = $state<string | null>(null);
  let howOpen = $state(false);

  const selected = $derived(new Set(cfg.packIds));
  const cardCount = $derived(packs.filter((p) => selected.has(p.id)).reduce((n, p) => n + p.cards.length, 0));

  $effect(() => saveConfig($state.snapshot(cfg) as Config));

  function togglePack(id: string) {
    cfg.packIds = selected.has(id) ? cfg.packIds.filter((x) => x !== id) : [...cfg.packIds, id];
  }

  function remove(id: string) {
    if (confirmDelete !== id) { confirmDelete = id; return; }
    customSpectra.remove(id);
    packs = spectrumPacks();
    cfg.packIds = cfg.packIds.filter((x) => x !== id);
    confirmDelete = null;
  }

  function start() {
    cfg.names = cfg.names.map((n, i) => n.trim() || ['Team 1', 'Team 2'][i]) as [string, string];
    onstart($state.snapshot(cfg) as Config);
  }
</script>

<Screen title={gameName('dial')} accent="var(--c-dial)" onback={() => go('/')} backLabel="Home">
  <section class="intro">
    <p class="lead">One clue. A secret spot on a scale. Can your team read your mind?</p>
    <button class="how-btn" aria-expanded={howOpen} onclick={() => (howOpen = !howOpen)}>{howOpen ? 'Hide rules' : 'How to play'}</button>
    {#if howOpen}
      <ol class="how fade-in">
        <li>Split into two teams. Each turn, one player is the <b>reader</b>.</li>
        <li>Only the reader sees where the target sits between two opposites, like <i>Cold</i> and <i>Hot</i>.</li>
        <li>The reader says one clue that belongs at that spot. Their team drags the needle to it.</li>
        <li>Reveal: closer is better, up to 4 points. Teams take turns. First to the goal wins.</li>
      </ol>
    {/if}
  </section>

  <section class="stack">
    <h3>Teams</h3>
    {#each cfg.names as _, i (i)}
      <label class="team" style:--team={teamColor(i as 0 | 1)}>
        <span class="dot" aria-hidden="true"></span>
        <span class="sr-only">Team {i + 1} name</span>
        <input type="text" maxlength="18" autocomplete="off" bind:value={cfg.names[i]} />
      </label>
    {/each}
  </section>

  <section class="stack">
    <h3>Rules</h3>
    <Stepper label="Points to win" bind:value={cfg.goal} min={5} max={30} />
    <Toggle label="Steal rule" hint="After each guess, the other team calls left or right of the needle for 1 point" bind:checked={cfg.steal} />
  </section>

  <section class="stack">
    <div class="packs-head"><h3>Card packs</h3><span class="faint">{cardCount} cards</span></div>
    <ul class="packs">
      {#each packs as p (p.id)}
        <li class="pack-item">
          <button class="pack" class:on={selected.has(p.id)} aria-pressed={selected.has(p.id)} onclick={() => togglePack(p.id)}>
            <span class="check" aria-hidden="true">{selected.has(p.id) ? '✓' : ''}</span>
            <span class="txt">
              <span class="name">{p.name}{#if p.custom}<span class="yours">yours</span>{/if}</span>
              <span class="blurb">{p.blurb || `${p.cards.length} cards`}</span>
            </span>
            <span class="n">{p.cards.length}</span>
          </button>
          {#if p.custom}
            <button class="del" class:armed={confirmDelete === p.id} onclick={() => remove(p.id)}
              aria-label={confirmDelete === p.id ? `Confirm delete ${p.name}` : `Delete ${p.name}`}>
              {confirmDelete === p.id ? 'Delete?' : '✕'}
            </button>
          {/if}
        </li>
      {/each}
    </ul>
    <Button variant="secondary" onclick={onmake}>✨ Make a pack</Button>
  </section>

  {#snippet actions()}
    <Button size="lg" disabled={cardCount === 0} onclick={start}>{cardCount === 0 ? 'Pick at least one pack' : 'Start game'}</Button>
  {/snippet}
</Screen>

<svelte:window onclick={(e) => { if (confirmDelete && !(e.target as Element).closest?.('.del')) confirmDelete = null; }} />

<style>
  .intro { display: flex; flex-direction: column; align-items: flex-start; gap: var(--s-2); }
  .lead { font-size: 1.15rem; }
  .how-btn { background: none; border: 0; padding: var(--s-2) 0; min-height: 44px; color: var(--accent); font-weight: 700; text-decoration: underline; text-underline-offset: 4px; }
  .how { margin: 0; padding-left: 1.3em; display: flex; flex-direction: column; gap: var(--s-2); color: var(--text-dim); }
  .team { display: flex; align-items: center; gap: var(--s-3); }
  .dot { width: 22px; height: 22px; border-radius: 50%; background: var(--team); flex: none; }
  .team input { border-color: color-mix(in srgb, var(--team) 55%, transparent); font-weight: 700; }
  .packs-head { display: flex; justify-content: space-between; align-items: baseline; }
  .packs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--s-2); }
  .pack-item { display: flex; gap: var(--s-2); align-items: stretch; }
  .pack {
    flex: 1; display: flex; align-items: center; gap: var(--s-3); text-align: left;
    min-height: var(--tap); padding: var(--s-3) var(--s-4); border-radius: var(--r-md);
    background: var(--surface); border: 2px solid transparent;
    transition: background var(--dur-fast) ease, border-color var(--dur-fast) ease;
  }
  .pack.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, var(--surface)); }
  .check {
    flex: none; width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center;
    border: 2px solid var(--line-strong); font-weight: 800; color: var(--on-accent);
  }
  .pack.on .check { background: var(--accent); border-color: var(--accent); }
  .txt { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  .name { font-weight: 700; font-size: 1.05rem; display: flex; align-items: center; gap: var(--s-2); }
  .yours { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em; padding: 1px 6px; border-radius: var(--r-pill); background: var(--surface-hi); color: var(--text-dim); }
  .blurb { color: var(--text-dim); font-size: 0.9rem; }
  .n { color: var(--text-faint); font-variant-numeric: tabular-nums; font-size: 0.9rem; }
  .del {
    flex: none; min-width: 52px; border-radius: var(--r-md); border: 0; background: var(--surface); color: var(--text-faint);
    font-weight: 700; padding: 0 var(--s-3);
  }
  .del.armed { background: color-mix(in srgb, var(--c-bad) 25%, var(--surface)); color: var(--text); }
</style>
