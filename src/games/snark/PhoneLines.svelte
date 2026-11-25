<script lang="ts">
  import { onMount } from 'svelte';
  import Button from '../../components/Button.svelte';
  import { LINES_EACH, LINE_MAX, cleanLines } from './logic';
  import { loadDraft, saveDraft } from './store';

  // A three-line duel: up to three short lines for the prompt, at least one to send. Enter moves
  // to the next line; half-typed lines survive a reload (kept as one draft, a line per row).
  let { prompt, draft, onsend }: { prompt: string; draft: string; onsend: (lines: string[]) => void } = $props();

  // svelte-ignore state_referenced_locally
  const saved = loadDraft(draft).split('\n');
  let lines = $state(Array.from({ length: LINES_EACH }, (_, i) => saved[i] ?? ''));
  const boxes: HTMLInputElement[] = [];
  const ready = $derived(cleanLines(lines).length > 0);

  onMount(() => boxes[0]?.focus());

  const keep = () => saveDraft(draft, lines.some((l) => l.trim()) ? lines.join('\n') : '');

  function done(e?: Event) {
    e?.preventDefault();
    if (!ready) return;
    saveDraft(draft, '');
    onsend($state.snapshot(lines));
  }

  function enter(e: KeyboardEvent, i: number) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (i + 1 < LINES_EACH) boxes[i + 1]?.focus();
    else done();
  }
</script>

<form class="write pop-in" onsubmit={done}>
  <p class="step">Final duel · three lines</p>
  <h2 class="prompt">{prompt}</h2>
  <div class="lines">
    {#each lines as line, i (i)}
      <label class="line">
        <span class="n" aria-hidden="true">{i + 1}</span>
        <input type="text" bind:this={boxes[i]} bind:value={lines[i]} maxlength={LINE_MAX} aria-label="Line {i + 1}"
          placeholder={i === 0 ? 'Your first line' : 'Another one (optional)'} enterkeyhint={i + 1 < LINES_EACH ? 'next' : 'done'}
          autocapitalize="sentences" spellcheck="true" oninput={keep} onkeydown={(e) => enter(e, i)} />
        <span class="count" class:near={line.length > LINE_MAX - 8}>{line.length}/{LINE_MAX}</span>
      </label>
    {/each}
  </div>
  <p class="faint hint">Short and punchy: up to {LINE_MAX} characters a line. One line is enough to send.</p>
  <Button size="lg" type="submit" disabled={!ready}>Done</Button>
</form>

<style>
  .write { display: flex; flex-direction: column; gap: var(--s-3); }
  .step { color: var(--c-gold); font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.82rem; }
  .prompt { font-size: clamp(1.4rem, calc(6.4vw * var(--text-scale)), 2rem); line-height: 1.15; }
  .lines { display: flex; flex-direction: column; gap: var(--s-2); }
  .line { position: relative; display: flex; align-items: center; gap: var(--s-2); }
  .n { flex: none; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; background: var(--overlay-strong); font-weight: 800; font-size: 0.9rem; color: var(--text-dim); }
  input { flex: 1; min-width: 0; min-height: var(--tap); font-size: 1.15rem; padding-right: 56px; }
  .count { position: absolute; right: 12px; font-size: 0.8rem; color: var(--text-faint); font-variant-numeric: tabular-nums; pointer-events: none; }
  .count.near { color: var(--c-pass); font-weight: 700; }
  .hint { font-size: 0.88rem; }
</style>
