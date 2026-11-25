<script lang="ts">
  import ListPackMake from '../../components/ListPackMake.svelte';
  import { handPacks } from '../../lib/content';
  import { cardList, HAND_LISTS } from './rules';
  import { MAKE_RANGE, THEME_CHIPS, WIZARD } from './generate';

  // "Make a pack" for Bad Hand: paste cards (a line with ___ or a question is a prompt, the rest
  // answers) or ask the wizard (components/ListPackMake.svelte).
  let { onsaved, onback }: { onsaved: (ids: string[]) => void; onback: () => void } = $props();
</script>

<ListPackMake game="hand" specs={HAND_LISTS} packs={handPacks} wizard={WIZARD} range={MAKE_RANGE} chips={THEME_CHIPS}
  route={cardList} pasteLabel="One card per line: a line with ___ or a question mark is a prompt, the rest are answers"
  pastePlaceholder={'My RA wrote me up for ___\nWhat got me through finals?\nA suspiciously large rice cooker\nCrying in the library stairwell'}
  defaultName="My cards" requestHint="e.g. wedding season: bridesmaids, open bars, awkward speeches, a bit edgy" {onsaved} {onback} />
