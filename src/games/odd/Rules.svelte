<script lang="ts">
  // The "?" rules popup, on setup and on every hand-off, so the rules are a tap away mid-game.
  import HowTo from '../../components/HowTo.svelte';
  import { POINTS } from './logic';
  let { hint, oddNeverStarts }: { hint: boolean; oddNeverStarts: boolean } = $props();
</script>

<HowTo>
  <ol>
    <li>Pass the phone round. Each player taps <b>Show</b>, reads their screen alone, then taps <b>Hide</b>.</li>
    <li>Everyone sees the same secret word, except one player: the <b>odd one out</b>, who only learns they are it{hint ? ' and which pack the word is from' : ''}.</li>
    <li>Take turns round the room: say one word about the secret word. Not too obvious, or the odd one out works it out; not too vague, or the room suspects you.{oddNeverStarts ? ' The odd one out never goes first.' : ''}</li>
    <li>Then count to three and everyone points at who they think is the odd one out. The room settles on one name and the phone records it.</li>
    <li>Wrong pick: the odd one out scores {POINTS.escaped}.</li>
    <li>Right pick: the odd one out guesses the word out loud. Right guess, they score {POINTS.guessed}; wrong, everyone else scores {POINTS.caught}.</li>
    <li>Most points after the last round wins.</li>
  </ol>
</HowTo>
