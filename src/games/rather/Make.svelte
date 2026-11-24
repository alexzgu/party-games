<script lang="ts">
  import ListPackMake from '../../components/ListPackMake.svelte';
  import { ratherPacks } from '../../lib/content';
  import { RATHER_LISTS } from './rules';
  import { MAKE_RANGE, THEME_CHIPS, WIZARD } from './generate';

  // "Make a pack" for Would You Rather: paste questions or ask the wizard (components/ListPackMake.svelte).
  let { onsaved, onback }: { onsaved: (ids: string[]) => void; onback: () => void } = $props();
</script>

<ListPackMake game="rather" specs={RATHER_LISTS} packs={ratherPacks} wizard={WIZARD} range={MAKE_RANGE} chips={THEME_CHIPS}
  route={() => 'prompts'} pasteLabel={'One question per line: two choices joined by "or"'}
  pastePlaceholder={"be able to fly or be invisible\nonly eat pizza or never eat pizza again\nlive without music or without movies"}
  defaultName="My questions" themeQuestion="What should the questions be about?" {onsaved} {onback} />
