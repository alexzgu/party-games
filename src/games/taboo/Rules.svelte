<script lang="ts">
  // The "?" rules popup, on setup and on every hand-off, so the rules are a tap away mid-game.
  import HowTo from '../../components/HowTo.svelte';
  import { gameName } from '../../app.config';
</script>

<HowTo title="How to play {gameName('taboo')}">
  <ol>
    <li>Two teams take turns. Each turn, one player is the <b>describer</b> and holds the phone.</li>
    <li>Get your team to say the word on the card <b>without saying it</b> or any of the five words under it. No “sounds like”, no spelling, no pointing at things.</li>
    <li>Someone from the <b>other team</b> sits next to the describer and watches. A banned word slips out? They hit <b>Buzz</b>: minus 1.</li>
    <li><b>Got it</b> is plus 1. <b>Skip</b> is free, or costs 1 with the skip rule on.</li>
    <li>When time is up, check the cards. Tap any card marked wrong to fix it.</li>
    <li>Play to a points target or a set number of rounds. Both teams always get the same number of turns; a tie plays one more round each.</li>
  </ol>
</HowTo>
