<script lang="ts">
  import ListPackMake from '../../components/ListPackMake.svelte';
  import { sketchPacks } from '../../lib/content';
  import { SKETCH_LISTS } from './rules';
  import { MAKE_RANGE, THEME_CHIPS, WIZARD } from './generate';

  // "Make a pack" for Sketchy: paste words or ideas (a switch says which) or ask the wizard for
  // both (components/ListPackMake.svelte).
  let { onsaved, onback }: { onsaved: (ids: string[]) => void; onback: () => void } = $props();
</script>

<ListPackMake game="sketch" specs={SKETCH_LISTS} packs={sketchPacks} wizard={WIZARD} range={MAKE_RANGE} chips={THEME_CHIPS}
  pasteExamples={{ words: 'Bunk bed\nRamen\nLava lamp', ideas: 'A raccoon cramming for finals\nA cat filing its taxes\nA shark taking a selfie' }}
  defaultName="My drawings" requestHint="e.g. a beach holiday, things easy enough to draw on a phone in a minute" {onsaved} {onback} />
