<script lang="ts">
  import ListPackEditor from '../../components/ListPackEditor.svelte';
  import { brawlPacks, customBrawl } from '../../lib/content';
  import { BRAWL_LISTS } from './rules';
  import { MORE_RANGE, WIZARD } from './generate';

  // One Doodle Brawl pack: its titles (components/ListPackEditor.svelte).
  let { id, onback }: { id: string; onback: () => void } = $props();
</script>

<ListPackEditor game="brawl" {id} specs={BRAWL_LISTS} store={customBrawl} packs={brawlPacks} wizard={WIZARD} moreRange={MORE_RANGE}
  steerHint="e.g. more about work, sillier" addLabel="+ Add a title" {onback} />
