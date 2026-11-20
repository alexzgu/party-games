<script lang="ts">
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import ListTools from '../../components/ListTools.svelte';
  import { saladPacks } from '../../lib/content';
  import { matches, sorted, type SortKey } from '../../lib/listing';
  import { back } from '../../lib/router.svelte';
  import { host } from './host.svelte';
  import { PICK_MS, PREPARE_MS, PRESENT_MS } from './logic';
  import { loadSettings } from './store';

  const packs = saladPacks();
  const goBack = () => back('/salad/host');
  const locked = host.game !== null && host.game.phase !== 'lobby';
  const initial = host.game?.phase === 'lobby' ? host.game.packIds : loadSettings();
  let selected = $state<string[]>(initial.filter((id) => packs.some((p) => p.id === id)));
  let query = $state('');
  let sort = $state<SortKey>('suggested');
  const shown = $derived(sorted(packs.filter((p) => matches(`${p.name} ${p.blurb}`, query) ||
    p.secrets.some((s) => matches(s.answer, query))), sort, (p) => p.name, (p) => Date.parse(p.added ?? '') || 0));
  const count = $derived(packs.filter((p) => selected.includes(p.id)).reduce((n, p) => n + p.secrets.length, 0));

  function toggle(id: string) {
    selected = selected.includes(id) ? selected.filter((p) => p !== id) : [...selected, id];
  }

  function done() {
    host.settings($state.snapshot(selected));
    goBack();
  }
</script>

<Screen title="Game settings" onback={goBack}>
  {#if locked}<p class="muted">Pack selections apply when you open a new room.</p>{/if}
  <p class="muted">2 rounds · {PICK_MS / 1000} seconds to pick · {PREPARE_MS / 1000} seconds to prepare · {PRESENT_MS / 1000} seconds to present</p>
  <section aria-labelledby="salad-packs">
    <ListTools key="salad:packs" bind:query bind:sort placeholder="Search packs and secrets" shown={shown.length} total={packs.length}>
      {#snippet title()}<h3 id="salad-packs">Secret packs</h3>{/snippet}
    </ListTools>
    <div class="packs">
      {#each shown as pack (pack.id)}
        {@const on = selected.includes(pack.id)}
        <button class="pack" aria-pressed={on} onclick={() => toggle(pack.id)}>
          <b>{pack.name}</b>
          <span>{pack.blurb}</span>
          <small>{pack.secrets.length} secrets · {on ? 'Selected' : 'Tap to select'}</small>
        </button>
      {:else}
        <p class="muted">No matching packs.</p>
      {/each}
    </div>
  </section>
  <p class="muted">{count} secrets selected</p>
  {#snippet actions()}
    <Button size="lg" disabled={!selected.length} onclick={done}>{selected.length ? 'Done' : 'Pick at least one pack'}</Button>
  {/snippet}
</Screen>

<style>
  .packs { display: grid; grid-template-columns: repeat(auto-fit, minmax(148px, 1fr)); gap: var(--s-2); }
  .pack {
    display: grid; align-content: start; gap: var(--s-2); padding: var(--s-3); text-align: left;
    background: var(--surface); border: 2px solid var(--line); border-radius: var(--r-md);
  }
  .pack[aria-pressed="true"] { border-color: var(--accent); }
  .pack b { font-family: var(--font-display); font-size: 1.2rem; }
  .pack small { color: var(--text-dim); }
</style>
