<script lang="ts">
  import ListPackMake from '../../components/ListPackMake.svelte';
  import { brawlPacks } from '../../lib/content';
  import { BRAWL_LISTS } from './rules';
  import { MAKE_RANGE, THEME_CHIPS, WIZARD } from './generate';

  // "Make a pack" for Doodle Brawl: paste titles or ask the wizard (components/ListPackMake.svelte).
  let { onsaved, onback }: { onsaved: (ids: string[]) => void; onback: () => void } = $props();
</script>

<ListPackMake game="brawl" specs={BRAWL_LISTS} packs={brawlPacks} wizard={WIZARD} range={MAKE_RANGE} chips={THEME_CHIPS}
  route={() => 'titles'} pasteLabel="One title per line, 2 to 8 words"
  pastePlaceholder={"World's okayest roommate\nUndefeated at losing the TV remote\nFastest to leave the group chat"}
  defaultName="My titles" requestHint="e.g. titles about office life that are fun to draw, like the coworker who microwaves fish" {onsaved} {onback} />
