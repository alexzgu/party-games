<script lang="ts">
  import ListPackEditor from '../../components/ListPackEditor.svelte';
  import { customSketch, sketchPacks } from '../../lib/content';
  import { SKETCH_LISTS } from './rules';
  import { MORE_RANGE, WIZARD } from './generate';

  // One Sketchy pack: its words (Draw & guess), then its ideas (Telephone) (components/ListPackEditor.svelte).
  let { id, onback }: { id: string; onback: () => void } = $props();
</script>

<ListPackEditor game="sketch" {id} specs={SKETCH_LISTS} store={customSketch} packs={sketchPacks} wizard={WIZARD} moreRange={MORE_RANGE}
  steerHint="e.g. harder words, more about food" addLabel="+ Item" {onback} />
