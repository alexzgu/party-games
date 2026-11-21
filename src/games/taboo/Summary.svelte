<script lang="ts">
  // After the clock: the turn's total and every card with its mark. A tap on a card changes its
  // mark (got → skipped → buzzed), so a mis-tap or a word shouted at the buzzer can be fixed
  // before the points go on the scoreboard.
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import { sfx } from '../../lib/sound';
  import { haptic } from '../../lib/haptics';
  import GameMenu from './GameMenu.svelte';
  import { teamColor } from './look';
  import { nextMark, points, turnScore, winnerOf, type Game, type Mark } from './state';

  let { game, onfix, ondone, onhome, onend }:
    { game: Game; onfix: (i: number) => void; ondone: () => void; onhome: () => void; onend: () => void } = $props();
  let menu = $state(false);

  const turn = $derived(game.turns.at(-1)!);
  const pts = $derived(turnScore(turn, game.skipCost));
  const count = (m: Mark) => turn.cards.filter((c) => c.mark === m).length;
  const ran = $derived(turn.cards.at(-1)?.late ? "Time's up" : 'Out of cards');
  const ends = $derived(winnerOf(game) !== null);

  const LABEL: Record<Mark, string> = { got: 'Got it', skip: 'Skipped', buzz: 'Buzzed', time: "Time's up" };
  const ICON: Record<Mark, string> = { got: '✓', skip: '↷', buzz: '✗', time: '⏱' };

  // Rows ignore taps for a moment after the screen appears (the tail of a double tap on the turn).
  const shownAt = performance.now();
  function fix(i: number) {
    if (performance.now() - shownAt < 400) return;
    const m = nextMark(turn.cards[i]);
    onfix(i);
    if (m === 'got') { sfx.correct(); haptic.correct(); }
    else if (m === 'buzz') { sfx.pass(); haptic.pass(); }
    else { sfx.tap(); haptic.light(); }
  }
  const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
</script>

<Screen title={ran} hideBack accent={teamColor(turn.team)}>
  {#snippet trailing()}
    <button class="menu" onclick={() => (menu = true)} aria-label="Game menu" aria-expanded={menu}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="5" cy="12" r="2.2" fill="currentColor"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/><circle cx="19" cy="12" r="2.2" fill="currentColor"/></svg>
    </button>
  {/snippet}
  <div class="hero pop-in">
    <span class="big" class:neg={pts < 0} aria-hidden="true">{signed(pts)}</span>
    <div class="hero-txt">
      <p class="team">{game.names[turn.team]}</p>
      <p class="muted">{count('got')} got · {count('buzz')} buzzed · {count('skip')} skipped</p>
    </div>
  </div>

  {#if turn.cards.length}
    <p class="faint tip">Marked wrong? Tap a card to change it.</p>
    <ul class="cards">
      {#each turn.cards as c, i (i)}
        <li class="pop-in" style:animation-delay="{Math.min(i, 16) * 25}ms">
          <button class="c {c.mark}" onclick={() => fix(i)} aria-label="{c.word}: {LABEL[c.mark]}. Tap to change.">
            <span class="mark" aria-hidden="true">{ICON[c.mark]}</span>
            <span class="text">
              <span class="w">{c.word}</span>
              <span class="b">{c.banned.join(' · ')}</span>
            </span>
            <span class="state"><span>{LABEL[c.mark]}</span>{#if points(c.mark, game.skipCost) !== 0}<b>{signed(points(c.mark, game.skipCost))}</b>{/if}</span>
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="muted">No cards this turn.</p>
  {/if}

  {#snippet actions()}
    <Button size="lg" onclick={ondone}>{ends ? 'See who won' : 'Done · see the scores'}</Button>
  {/snippet}
</Screen>

{#if menu}<GameMenu {game} onclose={() => (menu = false)} {onhome} {onend} />{/if}

<style>
  .menu {
    flex: none; width: 48px; height: 48px; border-radius: var(--r-pill); border: 0;
    background: var(--surface); color: var(--text-dim); display: grid; place-items: center;
  }
  .hero { display: flex; align-items: center; gap: var(--s-4); padding: var(--s-2) 0; }
  .big {
    font-family: var(--font-display); font-weight: 800; font-size: clamp(4.5rem, 24vw, 7rem); line-height: 0.9;
    color: var(--accent); letter-spacing: -0.04em; font-variant-numeric: tabular-nums;
    text-shadow: 0 10px 40px color-mix(in srgb, var(--accent) calc(40% * var(--glow)), transparent);
  }
  .big.neg { color: var(--c-bad); }
  .hero-txt { display: flex; flex-direction: column; gap: var(--s-1); min-width: 0; }
  .team { font-family: var(--font-display); font-weight: 800; font-size: 1.6rem; line-height: 1.05; color: var(--accent); overflow-wrap: anywhere; }
  .tip { font-size: 0.92rem; margin-bottom: calc(-1 * var(--s-2)); }
  .cards { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .c {
    --m: var(--text-faint);
    width: 100%; min-height: var(--tap); display: flex; align-items: center; gap: var(--s-3); text-align: left;
    padding: var(--s-2) var(--s-3) var(--s-2) var(--s-2); border-radius: var(--r-md); border: 1.5px solid transparent;
    background: var(--surface); transition: background var(--dur) ease, border-color var(--dur) ease, transform var(--dur-fast) var(--ease-out);
  }
  .c:active { transform: scale(0.98); }
  .c.got { --m: var(--c-good); }
  .c.buzz { --m: var(--c-bad); }
  .c.skip { --m: var(--c-pass); }
  .c.got, .c.buzz { background: color-mix(in srgb, var(--m) 14%, var(--surface)); border-color: color-mix(in srgb, var(--m) 45%, transparent); }
  .mark {
    flex: none; width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; font-weight: 900; font-size: 1.1rem;
    background: color-mix(in srgb, var(--m) 22%, transparent); color: var(--m);
  }
  .got .mark, .buzz .mark { background: var(--m); color: var(--on-accent); }
  .text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .w { font-family: var(--font-display); font-weight: 700; font-size: 1.2rem; letter-spacing: -0.01em; line-height: 1.15; }
  .b { font-size: 0.8rem; color: var(--text-faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .skip .w, .time .w { color: var(--text-dim); }
  .state { flex: none; display: flex; flex-direction: column; align-items: flex-end; font-size: 0.82rem; font-weight: 700; color: var(--m); line-height: 1.2; }
  .state b { font-family: var(--font-display); font-size: 1.05rem; }
</style>
