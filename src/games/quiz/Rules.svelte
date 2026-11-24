<script lang="ts">
  import HowTo from '../../components/HowTo.svelte';
  // The "?" rules popup, used on setup and on the board.
</script>

<HowTo>
  <ol>
    <li>A <b>host</b> runs this screen and reads each clue aloud. Play with 1 to 10 teams.</li>
    <li>Teams take turns picking a <b>category</b> and a <b>value</b>. Higher values, harder clues.</li>
    <li>Tap <b>Show answer</b>, then the team that got it to give them the points, or <b>Nobody</b>.</li>
    <li>With <b>Wrong answers lose points</b> on, tap ✗ for a wrong guess: that team loses the value.</li>
    <li>Most points when the board is cleared wins.</li>
  </ol>
  <p>Mistake? <b>Undo</b>, or tap a team's score to fix it. Keyboard: <b>Space</b> shows the answer, <b>1–9</b> picks a team, <b>0</b> is nobody, <b>Esc</b> puts the tile back.</p>
</HowTo>
