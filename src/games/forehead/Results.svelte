<script lang="ts">
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import { sfx } from '../../lib/sound';
  import { haptic } from '../../lib/haptics';
  import { score, toggle, type Round } from './round';
  import { relogRound } from './log';
  import { clearSession, deckLabel, recordScore, selectedDecks, session, setRound } from './state.svelte';

  // Score headline, every word (tap to fix a mis-tilt), this sitting's scores, what next.
  let { round, onagain, ondecks, onhome }: {
    round: Round;
    onagain: () => void;
    ondecks: () => void;
    onhome: () => void;
  } = $props();

  const points = $derived(score(round.shown));
  const decks = $derived(deckLabel(selectedDecks(round.deckIds)));
  const best = $derived(Math.max(0, ...session.rounds.map((r) => r.score)));
  const cheer = $derived(
    points >= 12 ? 'Legend 👑' : points >= 8 ? 'On fire 🔥' : points >= 5 ? 'Nice one!' : points >= 2 ? 'Warming up' : 'Tough crowd',
  );

  function fix(i: number) {
    const shown = toggle(round.shown, i);
    const next = { ...round, shown };
    setRound(next);
    if (round.logId) relogRound(round.logId, next);
    recordScore({ id: round.id, score: score(shown), total: shown.length, decks });
    if (shown[i].ok) { sfx.correct(); haptic.correct(); } else { sfx.pass(); haptic.pass(); }
  }
</script>

<Screen title="Round over" accent="var(--c-forehead)" onback={ondecks} backLabel="Change packs">
  <div class="hero pop-in">
    <span class="big" aria-hidden="true">{points}</span>
    <div class="hero-txt">
      <p class="cheer">{cheer}</p>
      <p class="muted">{points} got · {round.shown.length - points} passed · {decks}</p>
    </div>
  </div>

  {#if round.shown.length}
    <p class="faint tip">{round.tilt ? 'Tilted the wrong way?' : 'Tapped the wrong side?'} Tap a word to fix it.</p>
    <ul class="words">
      {#each round.shown as s, i (i)}
        <li class="pop-in" style:animation-delay="{Math.min(i, 20) * 22}ms">
          <button class="w" class:ok={s.ok} onclick={() => fix(i)} aria-label="{s.word}: {s.ok ? 'got it' : 'passed'}. Tap to change.">
            <span class="mark" aria-hidden="true">{s.ok ? '✓' : '✗'}</span>
            <span class="text">{s.word}</span>
            <span class="state">{s.ok ? 'Got it' : 'Passed'}</span>
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="muted">No words this round.</p>
  {/if}

  {#if session.rounds.length > 1}
    <section class="session">
      <div class="sess-head">
        <h3>This session</h3>
        <button class="link" onclick={clearSession}>Clear</button>
      </div>
      <ol>
        {#each session.rounds as r, i (r.id)}
          <li class:me={r.id === round.id}>
            <span class="rn">Round {i + 1}</span>
            <span class="rd faint">{r.decks}</span>
            <span class="rs">{r.score === best ? '👑 ' : ''}{r.score}</span>
          </li>
        {/each}
      </ol>
    </section>
  {/if}

  {#snippet actions()}
    <Button size="lg" onclick={onagain}>Next player · Play again</Button>
    <div class="row2">
      <Button variant="secondary" onclick={ondecks}>Change packs</Button>
      <Button variant="ghost" onclick={onhome}>Home</Button>
    </div>
  {/snippet}
</Screen>

<style>
  .hero { display: flex; align-items: center; gap: var(--s-4); padding: var(--s-2) 0; }
  .big {
    font-family: var(--font-display); font-weight: 800; font-size: clamp(5rem, 26vw, 7.5rem); line-height: 0.9;
    color: var(--accent); letter-spacing: -0.05em; font-variant-numeric: tabular-nums;
    text-shadow: 0 10px 40px color-mix(in srgb, var(--accent) calc(40% * var(--glow)), transparent);
  }
  .hero-txt { display: flex; flex-direction: column; gap: var(--s-1); }
  .cheer { font-family: var(--font-display); font-weight: 800; font-size: 1.7rem; line-height: 1.05; letter-spacing: -0.02em; }
  .tip { font-size: 0.92rem; margin-bottom: calc(-1 * var(--s-2)); }
  .words { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .w {
    width: 100%; min-height: var(--tap); display: flex; align-items: center; gap: var(--s-3); text-align: left;
    padding: var(--s-2) var(--s-4) var(--s-2) var(--s-2); border-radius: var(--r-md); border: 1.5px solid transparent;
    background: var(--surface); transition: background var(--dur) ease, border-color var(--dur) ease, transform var(--dur-fast) var(--ease-out);
  }
  .w:active { transform: scale(0.98); }
  .w.ok { background: color-mix(in srgb, var(--c-good) 16%, var(--surface)); border-color: color-mix(in srgb, var(--c-good) 45%, transparent); }
  .mark {
    flex: none; width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; font-weight: 900; font-size: 1.1rem;
    background: color-mix(in srgb, var(--c-pass) 22%, transparent); color: var(--c-pass);
    transition: background var(--dur) ease, color var(--dur) ease;
  }
  .ok .mark { background: var(--c-good); color: var(--on-accent); }
  .text { flex: 1; font-family: var(--font-display); font-weight: 700; font-size: 1.2rem; letter-spacing: -0.01em; }
  .w:not(.ok) .text { color: var(--text-dim); }
  .state { font-size: 0.82rem; font-weight: 600; color: var(--c-pass); }
  .ok .state { color: var(--c-good); }
  .session { background: var(--bg-raised); border-radius: var(--r-lg); padding: var(--s-3) var(--s-4); border: 1.5px solid var(--line); }
  .sess-head { display: flex; justify-content: space-between; align-items: center; }
  .link { border: 0; background: transparent; color: var(--text-faint); min-height: 44px; padding: 0 var(--s-2); font-weight: 600; }
  .session ol { list-style: none; margin: 0; padding: 0; }
  .session li { display: flex; align-items: baseline; gap: var(--s-3); padding: 6px 0; border-top: 1px solid var(--line); }
  .session li.me .rn, .session li.me .rs { color: var(--accent); }
  .rn { font-weight: 700; flex: none; }
  .rd { flex: 1; font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rs { font-family: var(--font-display); font-weight: 800; font-size: 1.25rem; font-variant-numeric: tabular-nums; }
  .row2 { display: flex; gap: var(--s-2); }
</style>
