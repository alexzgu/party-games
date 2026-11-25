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
  import { DEFAULT_PACKS, roomDeck } from './deck';
  import LendAsk from '../../components/room/LendAsk.svelte';
  import { consent, keptPicks, nameList, type Ask } from '../../lib/lend';

  // `lent`: the packs the player agreed may lend to this game alone (deck.ts).
  let { config, onstart, onmake }: { config: Config; onstart: (c: Config, lent: string[]) => void; onmake: () => void } = $props();

  let packs = $state.raw<SpectrumPack[]>(spectrumPacks());
  // Picks whose packs were all deleted become Classic, ticked here.
  // svelte-ignore state_referenced_locally
  let cfg = $state<Config>({ ...config, names: [...config.names], packIds: keptPicks(packs, config.packIds, DEFAULT_PACKS) });

  // The same cards Start deals from, and the packs it would ask to borrow from when the picks have none.
  const deck = $derived(roomDeck(packs, cfg.packIds));
  /** Why no game can start with these picks, or ''. */
  const missing = $derived(!cfg.packIds.length ? 'Pick packs' : deck.problem);
  /** The question after Start, until it is answered or closed; there is no room, so a yes lasts for one game. */
  let asking = $state.raw<Ask | null>(null);

  const entries = $derived(packs.map(packEntry));

  $effect(() => saveConfig($state.snapshot(cfg) as Config));

  /** Starts the game, or asks first when other packs would lend to it (`yes`: the key of the question the player agreed to). */
  function start(yes = '') {
    if (missing) return;
    if (consent(deck.ask, '', yes) === null) {
      asking = deck.ask;
      return;
    }
    asking = null;
    cfg.names = cfg.names.map((n, i) => n.trim() || ['Team 1', 'Team 2'][i]) as [string, string];
    onstart($state.snapshot(cfg) as Config, deck.ask ? deck.lent.map((p) => p.id) : []);
  }
</script>

<Screen fill title={gameName('dial')} accent="var(--c-dial)" onback={() => back('/games')} backLabel="Games">
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
    {#snippet notice()}
      {#if !missing && deck.ask}<p class="note">{deck.ask.short} The game will ask before adding cards from {nameList(deck.ask.lenders)}.</p>{/if}
    {/snippet}
  </PackList>

  {#snippet actions()}
    <RulesCard compact summary={rulesSummary(cfg.goal, cfg.steal)}>
      <Stepper label="Points to win" bind:value={cfg.goal} min={5} max={30} />
      <Toggle label="Steal rule" hint="After each guess, the other team calls left or right of the needle for 1 point" bind:checked={cfg.steal} />
    </RulesCard>
    <Button size="lg" disabled={!!missing} onclick={() => start()}>{missing || 'Start game'}</Button>
  {/snippet}
</Screen>
{#if asking}
  <LendAsk ask={asking} onclose={() => (asking = null)} onpacks={() => (asking = null)} onyes={() => start(asking!.key)}
    packsTip="Back to the pack list: pick packs with cards or add to your own" />
{/if}

<style>
  .note { margin-bottom: var(--s-3); padding: var(--s-3) var(--s-4); border-radius: var(--r-md); background: color-mix(in srgb, var(--c-pass) 14%, var(--surface)); font-weight: 600; }
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
