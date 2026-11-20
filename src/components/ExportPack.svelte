<script lang="ts">
  // "Export pack" in a pack editor: the pack as it is now, in a file to keep or send to friends.
  import type { GameId } from '../app.config';
  import Button from './Button.svelte';
  import { packFile, type AnyPack } from '../lib/packfile';
  import { shareOrDownload } from '../lib/share';

  let { game, pack, disabled = false }: { game: GameId; pack: AnyPack; disabled?: boolean } = $props();
  let note = $state('');

  async function send() {
    const file = packFile(game, [pack], pack.id);
    note = (await shareOrDownload(file)) === 'saved' ? `Saved ${file.name}` : '';
  }
</script>

<div class="export">
  <Button variant="secondary" size="sm" onclick={send} {disabled}>Export pack</Button>
  <p class="note" role="status">{note}</p>
</div>

<style>
  .export { display: flex; flex-direction: column; align-items: flex-start; gap: var(--s-1); }
  .note { margin: 0; color: var(--text-dim); font-size: 0.85rem; overflow-wrap: anywhere; }
  .note:empty { display: none; }
</style>
