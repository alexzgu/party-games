<script lang="ts">
  import { gameName } from '../../app.config';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import HowTo from '../../components/HowTo.svelte';
  import Stepper from '../../components/Stepper.svelte';
  import Toggle from '../../components/Toggle.svelte';
  import RulesCard from '../../components/RulesCard.svelte';
  import PackList from '../../components/PackList.svelte';
  import { spectrumPacks, type SpectrumPack } from '../../lib/content';
  import { back, go } from '../../lib/router.svelte';
  import { teamColor } from './look';
  import { packEntry } from './find';
  import { saveConfig } from './persist';
  import { rulesSummary } from './rulesSummary';
  import type { Config } from './state';

  let { config, onstart, onmake }: { config: Config; onstart: (c: Config) => void; onmake: () => void } = $props();

  let packs = $state.raw<SpectrumPack[]>(spectrumPacks());
  // svelte-ignore state_referenced_locally
  let cfg = $state<Config>({ ...config, names: [...config.names], packIds: config.packIds.filter((id) => packs.some((p) => p.id === id)) });

  const cardCount = $derived(packs.filter((p) => cfg.packIds.includes(p.id)).reduce((n, p) => n + p.cards.length, 0));

  const entries = $derived(packs.map(packEntry));

  $effect(() => saveConfig($state.snapshot(cfg) as Config));

  function start() {
    cfg.names = cfg.names.map((n, i) => n.trim() || ['Team 1', 'Team 2'][i]) as [string, string];
    onstart($state.snapshot(cfg) as Config);
  }
</script>

<Screen fill title={gameName('dial')} accent="var(--c-dial)" onback={() => back('/')} backLabel="Home">
  {#snippet trailing()}
    <HowTo title="How to play {gameName('dial')}">
      <ol>
        <li>Two teams take turns. Each turn, one player on the team is the <b>reader</b>.</li>
        <li>Only the reader sees where the hidden <b>target</b> sits on a scale between two opposites, like Cold and Hot.</li>
        <li>The reader gives <b>one clue</b> that fits that spot. No other hints.</li>
        <li>Their team turns the <b>dial</b> to where they think the target is, then locks it in.</li>
        <li>Scoring: right on target <b>4</b> points, close <b>3</b>, near <b>2</b>, further off nothing.</li>
        <li><b>Steal</b> (optional): the other team then calls whether the target is left or right of the needle. A right call wins them <b>1</b> point.</li>
        <li>First team to the points goal wins. A tie keeps playing.</li>
      </ol>
    </HowTo>
  {/snippet}

  <PackList game="dial" {entries} bind:selected={cfg.packIds} noun="cards" placeholder="Search packs and cards" makeHint="Paste a list or ask the wizard" topName="teams"
    onedit={(id) => go('/dial/pack?id=' + encodeURIComponent(id))} onmake={onmake} onimported={() => (packs = spectrumPacks())}>
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
    <RulesCard compact summary={rulesSummary(cfg.goal, cfg.steal)}>
      <Stepper label="Points to win" bind:value={cfg.goal} min={5} max={30} />
      <Toggle label="Steal rule" hint="After each guess, the other team calls left or right of the needle for 1 point" bind:checked={cfg.steal} />
    </RulesCard>
    <Button size="lg" disabled={cardCount === 0} onclick={start}>{cardCount === 0 ? 'Pick packs' : 'Start game'}</Button>
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
  .vs {
    align-self: center; font-family: var(--font-display); font-weight: 800; font-size: 0.85rem;
    color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.08em; line-height: 1;
  }
</style>
