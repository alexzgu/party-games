<script lang="ts" module>
  /** "3 lines skipped: 2 not in 'Left | Right' form, 1 repeated"; empty when nothing was skipped. */
  export function skipNote(reasons: readonly string[]): string {
    if (!reasons.length) return '';
    const counts = new Map<string, number>();
    for (const r of reasons) counts.set(r, (counts.get(r) ?? 0) + 1);
    const head = `${reasons.length} ${reasons.length === 1 ? 'line' : 'lines'} skipped: `;
    if (counts.size === 1) return head + reasons[0];
    return head + [...counts].map(([r, n]) => `${n} ${r}`).join(', ');
  }
</script>

<script lang="ts" generics="T">
  import type { Snippet } from 'svelte';
  import Button from './Button.svelte';

  // Paste a list (typed, or copied from a chatbot app) → the game's parser picks out the
  // items → the caller reviews them. Says how many lines were skipped and why.
  let {
    label,
    placeholder,
    parse,
    onadd,
    text = $bindable(''),
    children,
  }: {
    /** Visible label naming the format, e.g. "One card per line: Left | Right". */
    label: string;
    /** A few example lines in the exact format. */
    placeholder: string;
    parse: (text: string) => { items: T[]; skipped: string[] };
    /** Called with the items found and the skipped-lines note ('' when none were skipped). */
    onadd: (items: T[], note: string) => void;
    text?: string;
    /** Extra fields shown between the list and the button (e.g. where to save). */
    children?: Snippet;
  } = $props();

  let problem = $state('');

  function add(e: SubmitEvent) {
    e.preventDefault();
    const { items, skipped } = parse(text);
    if (!items.length) {
      problem = skipped.length ? `Nothing to add. ${skipNote(skipped)}.` : 'Nothing to add yet.';
      return;
    }
    problem = '';
    onadd(items, skipNote(skipped));
  }
</script>

<form class="paste" onsubmit={add}>
  <label class="field">
    <span class="lbl">{label}</span>
    <textarea bind:value={text} oninput={() => (problem = '')} {placeholder} rows="9" autocapitalize="sentences" spellcheck="false"></textarea>
  </label>
  {#if problem}<p class="problem" role="alert">{problem}</p>{/if}
  {@render children?.()}
  <Button type="submit" size="lg" disabled={!text.trim()} tip="Reads your list, skipping lines it can't use">Add these</Button>
</form>

<style>
  .paste { display: flex; flex-direction: column; gap: var(--s-3); }
  .field { display: flex; flex-direction: column; gap: var(--s-1); }
  .lbl { font-weight: 600; color: var(--text-dim); font-size: 0.92rem; }
  textarea { min-height: 236px; line-height: 1.45; }
  textarea::placeholder { color: var(--text-faint); }
  .problem { color: var(--c-bad); font-weight: 600; }
</style>
