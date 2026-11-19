<script lang="ts">
  import HowTo from '../../components/HowTo.svelte';
  // The "?" rules popup, used on setup and on the board.
</script>

<HowTo>
  <ol>
    <li>One person is the <b>host</b>. They run this screen (a phone, or a laptop on the TV) and read every clue out loud.</li>
    <li>Teams take turns choosing a category and a value. Bigger values, harder clues.</li>
    <li>The host taps that tile and reads the clue. Answer however your room likes: the choosing team first, or first team to shout.</li>
    <li>Tap <b>Show answer</b>, then the team that got it: they earn the tile's points. Nobody? Tap <b>Nobody got it</b>.</li>
    <li>With <b>Wrong answers lose points</b> on, tap ✗ for a team that guessed wrong: they lose the tile's value and can't win that tile.</li>
    <li>Most points when every tile is gone wins.</li>
  </ol>
  <p>Tapped the wrong team? <b>Undo</b> on the board takes it back. Tap a team's score to fix it by hand.</p>
  <p>On a keyboard: <b>Space</b> shows the answer, <b>1–4</b> picks the team that got it, <b>0</b> is nobody, <b>Esc</b> puts the tile back.</p>
</HowTo>
