<script lang="ts">
  import { untrack } from 'svelte';
  import { gameName } from '../../app.config';
  import Screen from '../../components/Screen.svelte';
  import HowTo from '../../components/HowTo.svelte';
  import Button from '../../components/Button.svelte';
  import Timer from '../../components/room/Timer.svelte';
  import Confetti from '../../components/room/Confetti.svelte';
  import { triviaPacks } from '../../lib/content';
  import { back, go } from '../../lib/router.svelte';
  import { sfx } from '../../lib/sound';
  import { keepAwake } from '../../lib/wakelock';
  import { CATEGORY_MS, type Choice } from './logic';
  import { roomQuestions } from './pack';
  import { current, shown, SOLO_COUNT, soloLeft, soloNext, soloPick, soloStart, soloTick, type Solo } from './solo';
  import { loadSettings, loadSolo, saveSolo } from './store';
  import { gain } from './labels';
  import Answers from './Answers.svelte';
  import Rules from './Rules.svelte';

  // Solo: the room's questions and scoring on this phone alone (solo.ts). The picks and seconds are
  // the room settings'; the best score and the questions shown are kept on this phone (a reload
  // mid-run loses the run, not what it showed).
  let solo = $state.raw<Solo | null>(null);
  let now = $state(Date.now());
  let best = $state(loadSolo().best);
  let record = $state(false);

  function begin() {
    const mem = loadSolo();
    const s = loadSettings();
    const run = soloStart(roomQuestions(triviaPacks(), s.packs), mem.asked, s.seconds, Date.now());
    record = false;
    solo = run?.solo ?? null;
    if (run) saveSolo({ ...mem, asked: shown(run.asked, run.solo) });
  }
  untrack(begin);

  /** The end: keep the best score. */
  function finish(s: Solo) {
    const mem = loadSolo();
    record = s.score > mem.best;
    if (record) saveSolo({ ...mem, best: s.score });
    best = Math.max(mem.best, s.score);
    sfx.win();
  }

  function move(next: Solo) {
    if (next === solo) return;
    if (next.phase === 'over') finish(next);
    else if (next.n !== solo?.n) { const mem = loadSolo(); saveSolo({ ...mem, asked: shown(mem.asked, next) }); }
    solo = next;
  }

  $effect(() => {
    const t = setInterval(() => { now = Date.now(); if (solo) untrack(() => move(soloTick(solo!, now))); }, 200);
    return () => clearInterval(t);
  });
  $effect(() => {
    keepAwake(true);
    return () => keepAwake(false);
  });

  function pick(c: Choice) {
    if (!solo) return;
    const next = soloPick(solo, c, Date.now());
    if (next === solo) return;
    if (c === current(solo).right) sfx.reveal(); else sfx.tap();
    move(next);
  }

  const q = $derived(solo && solo.phase !== 'over' ? current(solo) : null);
  const total = $derived(!solo ? 0 : solo.phase === 'category' ? CATEGORY_MS : solo.phase === 'answer' ? solo.seconds * 1000 : 0);
</script>

<Screen title="{gameName('trivia')} · Solo" onback={() => back('/trivia')}>
  {#snippet trailing()}<HowTo><Rules /></HowTo>{/snippet}
  <div class="solo">
    {#if !solo}
      <h2>No questions</h2>
      <p class="muted">The picked packs hold no questions. Pick packs in Settings.</p>
      <Button size="lg" onclick={() => go('/trivia/settings')}>Settings</Button>
    {:else if solo.phase === 'over'}
      <Confetti colors={['var(--c-answer-1)', 'var(--c-answer-2)', 'var(--c-answer-3)', 'var(--c-answer-4)']} />
      <h2 class="score">{solo.score} points</h2>
      <p class="center">{solo.correct} of {solo.questions.length} right.</p>
      <p class="center muted">{record ? 'A new best on this phone!' : `Best on this phone: ${best}`}</p>
      <Button size="lg" onclick={begin}>Play again</Button>
      <Button variant="secondary" onclick={() => go('/trivia/settings')} tip="Pick question packs and time to answer">Packs</Button>
    {:else if q}
      <div class="me">
        <p><b>{solo.score} {solo.score === 1 ? 'point' : 'points'}</b> · Question {solo.n} of {solo.questions.length}</p>
        <Timer left={soloLeft(solo, now)} {total} size={46} />
      </div>
      {#if solo.phase === 'category'}
        <p class="muted center">Get ready…</p>
        <button class="category" onclick={() => move(soloNext(solo!, Date.now()))} aria-label="{q.category}: show the question now">{q.category}</button>
      {:else}
        <p class="cat">{q.category}</p>
        <h2 class="question">{q.question}</h2>
        {#if solo.phase === 'answer'}
          <Answers answers={q.answers} size="md" onpick={pick} disabled={!soloLeft(solo, now)} />
          <p class="hint">Your first tap is final. Faster scores more.</p>
        {:else}
          <p class="verdict" class:win={solo.pick === q.right} role="status">
            {solo.pick === null ? 'Time’s up!' : solo.pick === q.right ? `Right! ${gain(solo.gained)}` : 'Not quite.'}
            {#if solo.pick !== q.right} The answer: <b>{q.answers[q.right]}</b>{/if}
          </p>
          <Answers answers={q.answers} size="sm" picked={solo.pick ?? undefined} right={q.right} />
          <Button size="lg" onclick={() => move(soloNext(solo!, Date.now()))}>{solo.n >= solo.questions.length ? 'Score' : 'Next'}</Button>
        {/if}
      {/if}
    {/if}
  </div>
</Screen>

<style>
  .solo { display: grid; gap: var(--s-3); padding-bottom: var(--s-4); }
  .me { display: flex; align-items: center; justify-content: space-between; gap: var(--s-2); color: var(--text-dim); }
  .me b { color: var(--accent); font-family: var(--font-display); }
  h2 { overflow-wrap: anywhere; }
  .question { font-size: 1.3rem; line-height: 1.25; }
  .cat { color: var(--accent); font: 800 0.95rem / 1.2 var(--font-display); text-transform: uppercase; letter-spacing: 0.04em; }
  .category { margin-block: var(--s-5); background: none; color: var(--accent); text-align: center; overflow-wrap: anywhere; font: 800 clamp(2.2rem, 11vw, 3.4rem) / 1.1 var(--font-display); }
  .center { text-align: center; }
  .hint { color: var(--text-dim); text-align: center; }
  .verdict { font: 800 1.2rem / 1.3 var(--font-display); overflow-wrap: anywhere; }
  .verdict b { font-family: inherit; }
  .win { color: var(--accent); }
  .score { color: var(--accent); text-align: center; font-size: clamp(2rem, calc(10vw * var(--text-scale)), 3.2rem); }
</style>
