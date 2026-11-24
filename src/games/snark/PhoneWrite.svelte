<script lang="ts">
  import Button from '../../components/Button.svelte';
  import Voters from './Voters.svelte';
  import PhoneLines from './PhoneLines.svelte';
  import type { Tick } from './view';
  import { ANSWER_MAX, cleanAnswer } from './logic';
  import { loadDraft, saveDraft } from './store';

  // One prompt at a time: type, Done, next. A sent answer leaves the screen at once (the host
  // confirms by dropping it from the list); half-typed answers survive a reload. "Suggest"
  // fills the box with the prompt's stock answer (the host halves its points if sent as is).
  // `code`: the room and which of its games this is. `lines`: the final's three-line duel. Once done: who is still writing.
  let { code, round, tasks, total, final, lines = false, writers, onsend, onlines }: {
    code: string;
    round: number;
    tasks: { i: number; prompt: string; safety?: string }[];
    total: number;
    final: boolean;
    lines?: boolean;
    writers?: Tick[];
    onsend: (i: number, text: string) => void;
    onlines: (i: number, lines: string[]) => void;
  } = $props();

  let sent = $state<number[]>([]);
  const todo = $derived(tasks.filter((t) => !sent.includes(t.i)));
  const task = $derived(todo[0]);
  const key = (i: number) => `${code}/${round}/${i}`;
  let text = $state('');
  let box = $state<HTMLTextAreaElement>();
  let shown = $state<number | null>(null);

  // A new prompt on screen: its draft back in the box.
  $effect(() => {
    if (task && task.i !== shown) {
      shown = task.i;
      text = loadDraft(key(task.i));
      queueMicrotask(() => box?.focus());
    }
  });

  function done(e?: Event) {
    e?.preventDefault();
    if (!task || !cleanAnswer(text)) return;
    onsend(task.i, text);
    saveDraft(key(task.i), '');
    sent = [...sent, task.i];
    text = '';
  }

  function stock(answer: string) {
    if (!task) return;
    text = answer;
    saveDraft(key(task.i), text);
    box?.focus();
  }

  function sendLines(i: number, got: string[]) {
    onlines(i, got);
    sent = [...sent, i];
  }
</script>

{#if task && lines}
  {#key task.i}
    <PhoneLines prompt={task.prompt} draft={key(task.i)} onsend={(got) => sendLines(task.i, got)} />
  {/key}
{:else if task}
  {#key task.i}
    <form class="write pop-in" onsubmit={done}>
      <p class="step">{final ? 'Final prompt' : `Prompt ${total - todo.length + 1} of ${total}`}</p>
      <h2 class="prompt">{task.prompt}</h2>
      <label class="box">
        <span class="sr-only">Your answer</span>
        <textarea bind:this={box} bind:value={text} maxlength={ANSWER_MAX} rows="3" placeholder="Your funniest answer"
          enterkeyhint="done" autocapitalize="sentences" spellcheck="true"
          oninput={() => saveDraft(key(task.i), text)}
          onkeydown={(e) => { if (e.key === 'Enter') done(e); }}></textarea>
        <span class="count" class:near={text.length > ANSWER_MAX - 10}>{text.length}/{ANSWER_MAX}</span>
      </label>
      {#if task.safety && text !== task.safety}
        <div class="stuck">
          <span class="faint">Stuck? Take a stock answer: half points unless you change it.</span>
          <button type="button" class="give" onclick={() => stock(task.safety!)} data-tip="Fills in a ready answer, replacing yours; half points unless changed">Suggest</button>
        </div>
      {/if}
      <Button size="lg" type="submit" disabled={!cleanAnswer(text)}>Done</Button>
    </form>
  {/key}
{:else}
  <div class="wait pop-in">
    <p class="emoji" aria-hidden="true">✅</p>
    <p class="big">All done!</p>
    {#if writers?.length}
      <p class="muted">{writers.filter((w) => w.done).length} of {writers.length} done. Waiting for the others.</p>
      <Voters people={writers} label="Who is done" size={28} />
    {:else}
      <p class="muted">Waiting for the others to finish.</p>
    {/if}
  </div>
{/if}

<style>
  .write { display: flex; flex-direction: column; gap: var(--s-3); }
  .step { color: var(--text-faint); font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.82rem; }
  .prompt { font-size: clamp(1.5rem, 7vw, 2.1rem); line-height: 1.15; }
  .box { position: relative; display: block; }
  textarea { width: 100%; min-height: 120px; font-size: 1.25rem; line-height: 1.35; padding-bottom: 28px; resize: none; }
  .count { position: absolute; right: 12px; bottom: 8px; font-size: 0.8rem; color: var(--text-faint); font-variant-numeric: tabular-nums; }
  .count.near { color: var(--c-pass); font-weight: 700; }
  .stuck { display: flex; align-items: center; justify-content: space-between; gap: var(--s-3); font-size: 0.88rem; }
  .give { flex: none; min-height: 44px; padding: 0 var(--s-4); border-radius: var(--r-pill); background: var(--overlay-strong); color: var(--text); font-weight: 700; font-size: 0.95rem; }
  .give:active { transform: scale(0.96); }
  .wait { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--s-3); text-align: center; padding: var(--s-5) 0; }
  .emoji { font-size: 4rem; line-height: 1; }
  .big { font-family: var(--font-display); font-weight: 800; font-size: 1.8rem; }
</style>
