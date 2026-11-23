<script lang="ts">
  import { untrack } from 'svelte';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import Segmented from '../../components/Segmented.svelte';
  import PackList from '../../components/PackList.svelte';
  import RulesCard from '../../components/RulesCard.svelte';
  import { brawlPacks } from '../../lib/content';
  import { DRAW_TIMES } from './logic';
  import { loadSettings } from './store';
  import { host } from './host.svelte';
  import { packEntry } from './find';

  // The room's settings, a pack page: title packs on the page (built-in, made, imported or from the
  // Community), seconds per drawing behind the Rules row over Done. Saved on this device at once and
  // into the lobby's game; a game already running keeps its own.
  let { onback, onedit, onmake }: { onback: () => void; onedit: (id: string) => void; onmake: () => void } = $props();

  let packs = $state.raw(brawlPacks());
  const s = loadSettings();
  let seconds = $state(s.seconds);
  // svelte-ignore state_referenced_locally
  let selected = $state(s.packs.filter((id) => packs.some((p) => p.id === id)));
  const locked = host.game !== null && host.game.phase !== 'lobby';

  $effect(() => {
    const next = { seconds, packs: $state.snapshot(selected) };
    untrack(() => { if (next.packs.length) host.settings(next); });
  });

  const titles = $derived(packs.filter((p) => selected.includes(p.id)).reduce((n, p) => n + p.titles.length, 0));
</script>

<Screen fill title="Room settings" {onback}>
  <PackList game="brawl" entries={packs.map(packEntry)} bind:selected title="Title packs" noun="titles" placeholder="Search packs and titles"
    makeHint="Paste titles or ask the wizard" keepOnImport {onedit} {onmake} onimported={() => (packs = brawlPacks())}>
    {#snippet notice()}
      {#if locked}<p class="note">A game is running: these apply to the next one.</p>{/if}
      {#if selected.length && titles < 24}<p class="note">{titles} {titles === 1 ? 'title' : 'titles'} picked: a full room of eight needs 24, so the game adds some from the other packs.</p>{/if}
    {/snippet}
  </PackList>
  {#snippet actions()}
    <RulesCard compact summary="{seconds} s per drawing">
      <div class="opt">
        <span class="label">Seconds per drawing</span>
        <Segmented label="Seconds per drawing" bind:value={seconds} options={DRAW_TIMES.map((v) => ({ value: v as number, label: `${v}` }))} />
        <span class="hint">For each of the two drawing passes in a round.</span>
      </div>
    </RulesCard>
    <Button size="lg" onclick={onback} disabled={!selected.length}>{selected.length ? 'Done' : 'Pick at least one pack'}</Button>
  {/snippet}
</Screen>

<style>
  .opt { display: flex; flex-direction: column; gap: var(--s-2); background: var(--surface); border-radius: var(--r-md); padding: var(--s-3) var(--s-3) var(--s-3) var(--s-4); }
  .label { font-weight: 700; }
  .hint { color: var(--text-faint); font-size: 0.88rem; }
  .note { margin-bottom: var(--s-3); padding: var(--s-3) var(--s-4); border-radius: var(--r-md); background: color-mix(in srgb, var(--c-pass) 14%, var(--surface)); font-weight: 600; }
</style>
