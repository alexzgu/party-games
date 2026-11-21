<script lang="ts">
  import type { PackGameId } from '../app.config';
  import type { AnyPack } from '../lib/packfile';
  import ExportPack from './ExportPack.svelte';
  import SharePack from './SharePack.svelte';

  let { game, pack, onshared }: { game: PackGameId; pack: AnyPack; onshared?: () => void } = $props();
</script>

<div class="actions">
  <ExportPack {game} {pack} />
  <SharePack {game} {pack} {onshared} />
</div>

<style>
  .actions { display: flex; flex-wrap: wrap; align-items: flex-start; gap: var(--s-2); }
</style>
