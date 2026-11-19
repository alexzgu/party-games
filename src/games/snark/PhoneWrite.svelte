<script lang="ts">
  import Button from '../../components/Button.svelte';
  import { ANSWER_MAX, cleanAnswer } from './logic';
  import { loadDraft, saveDraft } from './store';

  // One prompt at a time: type, Done, next. A sent answer leaves the screen at once (the host
  // confirms by dropping it from the list); half-typed answers survive a reload.
  let { code, round, tasks, total, final, onsend }: {
    code: string;
    round: number;
    tasks: { i: number; prompt: string }[];
    total: number;
    final: boolean;
    onsend: (i: number, text: string) => void;
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
</script>

{#if task}
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
      <Button size="lg" type="submit" disabled={!cleanAnswer(text)}>Done</Button>
    </form>
  {/key}
{:else}
  <div class="wait pop-in">
    <p class="emoji" aria-hidden="true">✅</p>
    <p class="big">All done!</p>
    <p class="muted">Look at the host screen while the others finish.</p>
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
  .wait { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--s-3); text-align: center; padding: var(--s-5) 0; }
  .emoji { font-size: 4rem; line-height: 1; }
  .big { font-family: var(--font-display); font-weight: 800; font-size: 1.8rem; }
</style>
