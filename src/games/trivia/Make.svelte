<script lang="ts">
  import ListPackMake from '../../components/ListPackMake.svelte';
  import { triviaPacks } from '../../lib/content';
  import { TRIVIA_LISTS } from './rules';
  import { MAKE_RANGE, THEME_CHIPS, WIZARD } from './generate';

  // "Make a pack" for Smarty Pants: paste questions or ask the wizard (components/ListPackMake.svelte).
  let { onsaved, onback }: { onsaved: (ids: string[]) => void; onback: () => void } = $props();
</script>

<ListPackMake game="trivia" specs={TRIVIA_LISTS} packs={triviaPacks} wizard={WIZARD} range={MAKE_RANGE} chips={THEME_CHIPS}
  route={() => 'questions'} pasteLabel="One question per line: category | question | right answer | three wrong answers"
  pastePlaceholder={"Science | What gas do plants take in from the air? | Carbon dioxide | Oxygen | Nitrogen | Helium\nGeography | Which river flows through Cairo? | The Nile | The Amazon | The Danube | The Ganges"}
  defaultName="My questions" requestHint="e.g. 2000s pop music, mostly easy with a few hard ones for the music nerds" {onsaved} {onback} />
