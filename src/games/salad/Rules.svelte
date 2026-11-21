<script lang="ts">
  import { PICK_MS, PREPARE_MS, PRESENT_MS } from './logic';
</script>

<ol>
  <li><b>Pick a secret.</b> You have {PICK_MS / 1000} seconds to choose from three options: tap one, then <b>Pick this one</b>. If time runs out, the one you tapped is yours. You can reshuffle once per round.</li>
  <li><b>Get a clue ready.</b> Everyone has {PREPARE_MS / 1000} seconds to build an opening sentence. Tap words to fill the blanks, then send it.</li>
  <li><b>Take turns presenting.</b> Your opening clue goes up first. For {PRESENT_MS / 1000} seconds you can send more sentences using the words you’re dealt. Swap to a different sentence or ask for more words. Some sentences let you use somebody’s guess as a comparison.</li>
  <li><b>Type your guesses.</b> Send as many as you like. The first correct guess ends the turn and scores for both the guesser and the presenter. Faster solves earn more. Easy secrets pay half, and helpful comparisons earn assists when the room solves the secret.</li>
  <li><b>Play two rounds.</b> Every seat presents each round. Round two doubles the points for the presenter and correct guesser. The highest total wins.</li>
</ol>

<style>
  ol { display: grid; gap: var(--s-3); padding-left: var(--s-5); line-height: 1.5; }
</style>
