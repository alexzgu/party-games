<script lang="ts">
  // The "?" rules popup, on setup and on every hand-off, so the rules are a tap away mid-game.
  import HowTo from '../../components/HowTo.svelte';
  let { target }: { target: number } = $props();
</script>

<HowTo>
  <ol>
    <li>Each card, one player is the <b>reader</b>. The phone tells you who.</li>
    <li>The reader reads a nonsense phrase out loud, like <b>“Eye Scream”</b>. Again and again, faster each time.</li>
    <li>Everyone else shouts what it really sounds like: <b>Ice Cream</b>.</li>
    <li>Stuck? The reader can show the category and read it out.</li>
    <li>The reader taps the name of whoever said it first. They get a point.</li>
    <li>No point if the timer runs out or nobody gets it. Skip swaps in a new card, no penalty.</li>
    <li>The phone passes to the next reader. First to {target} points wins.</li>
  </ol>
</HowTo>
