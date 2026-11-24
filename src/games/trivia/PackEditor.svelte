<script lang="ts">
  import ListPackEditor from '../../components/ListPackEditor.svelte';
  import { customTrivia, triviaPacks } from '../../lib/content';
  import { TRIVIA_LISTS } from './rules';
  import { MORE_RANGE, WIZARD } from './generate';

  // One Smarty Pants pack: its questions (components/ListPackEditor.svelte).
  let { id, onback }: { id: string; onback: () => void } = $props();
</script>

<ListPackEditor game="trivia" {id} specs={TRIVIA_LISTS} store={customTrivia} packs={triviaPacks} wizard={WIZARD} moreRange={MORE_RANGE}
  steerHint="e.g. more about movies, harder questions" addLabel="+ Question" {onback} />
