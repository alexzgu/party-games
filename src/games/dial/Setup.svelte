<script lang="ts">
  import { gameName } from '../../app.config';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import HowTo from '../../components/HowTo.svelte';
  import Stepper from '../../components/Stepper.svelte';
  import Toggle from '../../components/Toggle.svelte';
  import ListTools from '../../components/ListTools.svelte';
  import PackFile from '../../components/PackFile.svelte';
  import { spectrumPacks, customSpectra, packAge, type Spectrum, type SpectrumPack } from '../../lib/content';
  import { matches, sorted, type SortKey } from '../../lib/listing';
  import { go } from '../../lib/router.svelte';
  import { teamColor } from './look';
  import { saveConfig } from './persist';
  import type { Config } from './state';

  let { config, onstart, onmake }: { config: Config; onstart: (c: Config) => void; onmake: () => void } = $props();

  let packs = $state.raw<SpectrumPack[]>(spectrumPacks());
  // svelte-ignore state_referenced_locally
  let cfg = $state<Config>({ ...config, names: [...config.names], packIds: config.packIds.filter((id) => packs.some((p) => p.id === id)) });

  const selected = $derived(new Set(cfg.packIds));
  const cardCount = $derived(packs.filter((p) => selected.has(p.id)).reduce((n, p) => n + p.cards.length, 0));

  let query = $state('');
  let sort = $state<SortKey>('suggested');

  /** How a pack matches the search: by its name or blurb, or else by its first matching card. */
  type Hit = { pack: SpectrumPack; card?: Spectrum };
  function hit(p: SpectrumPack): Hit | null {
    if (matches(`${p.name} ${p.blurb}`, query)) return { pack: p };
    const card = p.cards.find((c) => matches(`${c.left} ${c.right}`, query));
    return card ? { pack: p, card } : null;
  }
  const hits = $derived(sorted(packs.map(hit).filter((h) => h !== null), sort, (h) => h.pack.name, (h) => packAge(h.pack)));

  $effect(() => saveConfig($state.snapshot(cfg) as Config));

  /** Imported packs are ticked, like a pack just made. */
  function imported(ids: string[]) {
    packs = spectrumPacks();
    cfg.packIds = [...ids.filter((id) => !cfg.packIds.includes(id)), ...cfg.packIds];
  }

  function togglePack(id: string) {
    cfg.packIds = selected.has(id) ? cfg.packIds.filter((x) => x !== id) : [...cfg.packIds, id];
  }

  function start() {
    cfg.names = cfg.names.map((n, i) => n.trim() || ['Team 1', 'Team 2'][i]) as [string, string];
    onstart($state.snapshot(cfg) as Config);
  }
</script>

<Screen title={gameName('dial')} accent="var(--c-dial)" onback={() => go('/')} backLabel="Home">
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

  <section class="stack">
    <h3>Rules</h3>
    <Stepper label="Points to win" bind:value={cfg.goal} min={5} max={30} />
    <Toggle label="Steal rule" bind:checked={cfg.steal} />
  </section>

  <section class="stack">
    <div>
      <ListTools key="dial:setup" bind:query bind:sort placeholder="Search packs and cards" shown={hits.length} total={packs.length}>
        {#snippet title()}<div class="packs-head"><h3>Card packs</h3><span class="faint">· {cardCount} cards</span></div>{/snippet}
      </ListTools>
      <ul class="packs">
        {#each hits as { pack: p, card } (p.id)}
          <li class="pack-item">
            <button class="pack" class:on={selected.has(p.id)} aria-pressed={selected.has(p.id)} onclick={() => togglePack(p.id)}>
              <span class="check" aria-hidden="true">{selected.has(p.id) ? '✓' : ''}</span>
              <span class="txt">
                <span class="name">{p.name}{#if p.custom}<span class="tag">yours</span>{:else if customSpectra.isEdited(p.id)}<span class="tag">edited</span>{/if}</span>
                {#if p.blurb}<span class="blurb">{p.blurb}</span>{/if}
                {#if card}<span class="has">has “{card.left} | {card.right}”</span>{/if}
              </span>
            </button>
            <button class="open" onclick={() => go(`/dial/pack?id=${encodeURIComponent(p.id)}`)} aria-label="See and edit the cards in {p.name} ({p.cards.length})">
              <span class="n">{p.cards.length}</span>
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </li>
        {/each}
      </ul>
      {#if hits.length === 0}<p class="faint none">No packs match “{query.trim()}”</p>{/if}
    </div>
    <Button variant="secondary" onclick={onmake}>✨ Make a pack</Button>
    <PackFile game="dial" onimported={imported} />
  </section>

  {#snippet actions()}
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
  .vs {
    align-self: center; font-family: var(--font-display); font-weight: 800; font-size: 0.85rem;
    color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.08em; line-height: 1;
  }
  .packs-head { display: flex; align-items: baseline; gap: var(--s-2); }
  .packs-head .faint { font-size: 0.92rem; font-variant-numeric: tabular-nums; }
  .has { color: var(--text-faint); font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .none { text-align: center; padding: var(--s-2) 0; }
  .packs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--s-2); }
  .pack-item { display: flex; gap: var(--s-2); align-items: stretch; }
  .pack {
    flex: 1; min-width: 0; display: flex; align-items: center; gap: var(--s-3); text-align: left;
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
  .tag { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em; padding: 1px 6px; border-radius: var(--r-pill); background: var(--surface-hi); color: var(--text-dim); }
  .blurb { color: var(--text-dim); font-size: 0.9rem; }
  .open {
    flex: none; width: 64px; border-radius: var(--r-md); border: 0; background: var(--surface); color: var(--text-dim);
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
  }
  .open:active { background: var(--surface-hi); }
  .n { font-variant-numeric: tabular-nums; font-size: 0.85rem; font-weight: 700; line-height: 1; }
</style>
