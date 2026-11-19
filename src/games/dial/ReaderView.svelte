<script lang="ts">
  // The reader's secret view: where the target sits, one free new card, an optional typed clue.
  import Frame from './Frame.svelte';
  import Dial from './Dial.svelte';
  import ScaleCard from './ScaleCard.svelte';
  import Button from '../../components/Button.svelte';
  import type { Game, Round } from './state';

  let {
    game,
    round,
    onredraw,
    onclue,
    onhide,
    onhome,
    onend,
  }: {
    game: Game;
    round: Round;
    onredraw: () => void;
    onclue: (clue: string) => void;
    onhide: () => void;
    onhome: () => void;
    onend: () => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  let clue = $state(round.clue);
</script>

<Frame {game} active={game.active} {onhome} {onend}>
  <p class="secret"><span aria-hidden="true">🤫</span> Reader only: keep it to yourself</p>
  <p class="how">Think of a clue that belongs at the <b class="gold">gold&nbsp;4</b> on this scale. Say it out loud.</p>
  <div class="tuner">
    <Dial target={round.target} open showNeedle={false} label="Target position" />
    <ScaleCard card={round.card} />
  </div>
  <div class="row">
    <Button variant="secondary" size="sm" disabled={round.redrawsLeft <= 0} onclick={onredraw}>
      ↻ {round.redrawsLeft > 0 ? 'Different card (1 free)' : 'No more new cards'}
    </Button>
  </div>
  <label class="clue">
    <span class="faint">Type your clue so it stays on screen (optional)</span>
    <input type="text" maxlength="60" placeholder="e.g. Pineapple on pizza" autocomplete="off" enterkeyhint="done"
      bind:value={clue} onchange={() => onclue(clue.trim())} />
  </label>
  {#snippet actions()}
    <Button size="lg" onclick={() => { onclue(clue.trim()); onhide(); }}>Hide target · show my team</Button>
  {/snippet}
</Frame>

<style>
  .secret {
    align-self: center; padding: var(--s-2) var(--s-4); border-radius: var(--r-pill);
    background: color-mix(in srgb, var(--c-gold) 18%, var(--surface)); color: var(--c-gold);
    font-weight: 700; font-size: 0.95rem; white-space: nowrap;
  }
  .how { font-size: 1.1rem; color: var(--text); }
  .gold { color: var(--c-gold); }
  .tuner { display: flex; flex-direction: column; gap: var(--s-3); }
  .row { display: flex; justify-content: center; }
  .clue { display: flex; flex-direction: column; gap: var(--s-1); font-size: 0.92rem; }
</style>
