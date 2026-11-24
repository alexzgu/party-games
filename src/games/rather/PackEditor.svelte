<script lang="ts">
  import ListPackEditor from '../../components/ListPackEditor.svelte';
  import { customRather, ratherPacks } from '../../lib/content';
  import { RATHER_LISTS } from './rules';
  import { MORE_RANGE, WIZARD } from './generate';

  // One Would You Rather pack: its questions (components/ListPackEditor.svelte).
  let { id, onback }: { id: string; onback: () => void } = $props();
</script>

<ListPackEditor game="rather" {id} specs={RATHER_LISTS} store={customRather} packs={ratherPacks} wizard={WIZARD} moreRange={MORE_RANGE}
  steerHint="e.g. more about food, harder choices" addLabel="+ Question" {onback} />
