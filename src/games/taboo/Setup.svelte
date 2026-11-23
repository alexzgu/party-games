<script lang="ts">
  import { gameName } from '../../app.config';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import Rules from './Rules.svelte';
  import Segmented from '../../components/Segmented.svelte';
  import Stepper from '../../components/Stepper.svelte';
  import Toggle from '../../components/Toggle.svelte';
  import RulesCard from '../../components/RulesCard.svelte';
  import PackList from '../../components/PackList.svelte';
  import { tabooPacks, type TabooPack } from '../../lib/content';
  import { back, go } from '../../lib/router.svelte';
  import { teamColor } from './look';
  import { packEntry } from './find';
  import { GOAL, ROUNDS, saveConfig } from './persist';
  import { SECONDS, type Config, type EndMode } from './state';
  import { rulesSummary } from './rulesSummary';

  let { config, onstart }: { config: Config; onstart: (c: Config) => void } = $props();

  let packs = $state.raw<TabooPack[]>(tabooPacks());
  // svelte-ignore state_referenced_locally
  let cfg = $state<Config>({ ...config, names: [...config.names], packIds: config.packIds.filter((id) => packs.some((p) => p.id === id)) });

  const cardCount = $derived(packs.filter((p) => cfg.packIds.includes(p.id)).reduce((n, p) => n + p.cards.length, 0));

  const entries = $derived(packs.map(packEntry));

  $effect(() => saveConfig($state.snapshot(cfg) as Config));

  function start() {
    cfg.names = cfg.names.map((n, i) => n.trim() || ['Team 1', 'Team 2'][i]) as [string, string];
    onstart($state.snapshot(cfg) as Config);
  }

  const secondsOptions = SECONDS.map((s) => ({ value: s as number, label: `${s} s` }));
  const modeOptions: { value: EndMode; label: string; tip: string }[] = [{ value: 'score', label: 'Points', tip: 'First team to a set score wins' }, { value: 'rounds', label: 'Rounds', tip: 'The team ahead after a set number of rounds wins' }];
</script>

<Screen fill title={gameName('taboo')} accent="var(--c-taboo)" onback={() => back('/')} backLabel="Home">
  {#snippet trailing()}<Rules />{/snippet}

  <PackList game="taboo" {entries} bind:selected={cfg.packIds} noun="cards" placeholder="Search packs and words" makeHint="Write cards or ask the wizard" topName="teams"
    onedit={(id) => go('/taboo/pack?id=' + encodeURIComponent(id))} onmake={() => go('/taboo/new')} onimported={() => (packs = tabooPacks())}>
    {#snippet top()}
      <section class="stack">
        <h3>Teams</h3>
        <div class="teams">
          {#each cfg.names as _, i (i)}
            {#if i === 1}<span class="vs" aria-hidden="true">vs</span>{/if}
            <label class="team" style:--team={teamColor(i as 0 | 1)}>
              <span class="sr-only">Team {i + 1} name</span>
              <input type="text" maxlength="18" autocomplete="off" bind:value={cfg.names[i]} />
            </label>
          {/each}
        </div>
      </section>
    {/snippet}
  </PackList>

  {#snippet actions()}
    <RulesCard compact summary={rulesSummary(cfg)}>
      <div class="field"><span class="lbl">Turn length</span><Segmented label="Turn length" bind:value={cfg.seconds} options={secondsOptions} /></div>
      <div class="field"><span class="lbl">Play until</span><Segmented label="Play until" bind:value={cfg.mode} options={modeOptions} /></div>
      {#if cfg.mode === 'score'}
        <Stepper label="Points to win" bind:value={cfg.goal} min={GOAL.min} max={GOAL.max} step={GOAL.step} />
      {:else}
        <Stepper label="Rounds to play" bind:value={cfg.rounds} min={ROUNDS.min} max={ROUNDS.max} />
      {/if}
      <Toggle label="Skips cost a point" hint={cfg.skipCost ? 'Each skip is −1' : 'Skipping is free'} bind:checked={cfg.skipCost} />
    </RulesCard>
    <Button size="lg" disabled={cardCount === 0} onclick={start}>{cardCount === 0 ? 'Pick at least one pack' : 'Start game'}</Button>
  {/snippet}
</Screen>

<style>
  .teams { display: flex; flex-direction: column; gap: var(--s-2); }
  .team { display: block; }
  .team input {
    border: 2px solid color-mix(in srgb, var(--team) 60%, transparent);
    background: color-mix(in srgb, var(--team) 10%, var(--bg-sunk));
    color: var(--team); font-family: var(--font-display); font-weight: 800; font-size: 1.2rem;
  }
  .team input:focus { border-color: var(--team); box-shadow: 0 0 18px color-mix(in srgb, var(--team) calc(35% * var(--glow)), transparent); }
  .vs { align-self: center; font-family: var(--font-display); font-weight: 800; font-size: 0.85rem; color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.08em; line-height: 1; }
  .field { display: flex; flex-direction: column; gap: var(--s-1); }
  .lbl { font-weight: 600; font-size: 0.92rem; color: var(--text-dim); padding-left: var(--s-1); }
</style>
