<script lang="ts">
  import type { Filters } from '../lib/communityView';

  // Which Community packs to list, by what this phone has and skips.
  let { filters, onchange }: { filters: Filters; onchange: (f: Partial<Filters>) => void } = $props();
</script>

<div class="filters">
  <label>
    <span>Owned</span>
    <select bind:value={() => filters.own, (own) => onchange({ own })} data-tip="Packs you imported from Community or shared, still on this phone">
      <option value="all">All</option>
      <option value="owned">Owned</option>
      <option value="unowned">Not owned</option>
    </select>
  </label>
  <label>
    <span>Skipped</span>
    <select bind:value={() => filters.skip, (skip) => onchange({ skip })} data-tip="Packs you chose to skip on this phone">
      <option value="all">All</option>
      <option value="skipped">Skipped</option>
      <option value="unskipped">Not skipped</option>
    </select>
  </label>
</div>

<style>
  .filters { display: flex; gap: var(--s-3); }
  label { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; font-weight: 600; font-size: 0.9rem; color: var(--text-dim); }
  select { min-width: 0; width: 100%; min-height: var(--tap-sm); padding: 0 var(--s-1) 0 var(--s-3); color: var(--text); }
</style>
