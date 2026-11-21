<script lang="ts">
  // The "?" rules popup, on setup and on every hand-off, so the rules are a tap away mid-game.
  import HowTo from '../../components/HowTo.svelte';
  let { seconds, target, steal, stealUsesTurn = false }: { seconds: number; target: number; steal: boolean; stealUsesTurn?: boolean } = $props();
</script>

<HowTo>
  <ol>
    <li>Pass the phone round. The phone says whose turn it is.</li>
    <li>On your turn, tap to see your prompt, like <b>“Name 3 things you'd find in a fridge”</b>. The clock starts at once: {seconds} seconds.</li>
    <li>Say three answers out loud before the buzzer. Everyone else listens.</li>
    <li>The room decides: <b>Got 3</b> is a point, <b>Didn't</b> is not. Got them early? Tap <b>Got all 3</b> to stop the clock.</li>
    {#if steal}<li><b>Steal:</b> miss it and the next player gets the same prompt and a fresh clock. Three <i>different</i> answers steal the point. {stealUsesTurn ? 'The steal is their turn, so play then skips them.' : 'Then they take their own turn as usual.'}</li>{/if}
    <li>Wrong call? Undo takes back the last decision.</li>
    <li>Reach {target} points to win. The round always finishes, so everyone gets the same number of turns; then the top score wins. Tied on top? Play one more round.</li>
  </ol>
</HowTo>
