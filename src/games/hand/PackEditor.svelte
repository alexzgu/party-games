<script lang="ts">
  import ListPackEditor from '../../components/ListPackEditor.svelte';
  import { customHand, handPacks } from '../../lib/content';
  import { HAND_LISTS } from './rules';
  import { MORE_RANGE, WIZARD } from './generate';

  // One Bad Hand pack: its prompt cards, then its answer cards (components/ListPackEditor.svelte).
  let { id, onback }: { id: string; onback: () => void } = $props();
</script>

<ListPackEditor game="hand" {id} specs={HAND_LISTS} store={customHand} packs={handPacks} wizard={WIZARD} moreRange={MORE_RANGE}
  steerHint="e.g. more about work, meaner answers" addLabel="+ Card" totalNoun="cards" {onback} />
