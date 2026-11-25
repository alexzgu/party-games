<script lang="ts" generics="T, A, S">
  import Button from './Button.svelte';
  import { hasKey } from '../lib/claude';
  import { CHANGE_MAX } from '../lib/wizardChange';
  import type { Changes } from '../lib/wizardChanges.svelte';

  // "Ask for changes" under the review of a pack Fizzwick just made, in every game: a short
  // thread (the request, then each change and what came of it), the box, "Change" and "Undo".
  // Needs the wizard on this phone, like "More".
  let { changes, request }: { changes: Changes<T, A, S>; request: string } = $props();

  /** Only the latest change shows in full; older ones fold away so Save stays on screen. */
  const SHOWN = 1;
  const older = $derived(changes.thread.slice(0, -SHOWN));
  const recent = $derived(changes.thread.slice(-SHOWN));
</script>

{#if hasKey()}
  <section class="change" aria-label="Ask for changes">
    {#if changes.thread.length}
      <ol class="thread">
        <li class="you req" title={request}>{request}</li>
        {#if older.length}
          <li class="older">
            <details>
              <summary>{older.length} earlier {older.length === 1 ? 'change' : 'changes'}</summary>
              <ol>
                {#each older as e, i (i)}<li class="you">{e.ask}</li><li class="fizz">🧙 {e.result}</li>{/each}
              </ol>
            </details>
          </li>
        {/if}
        {#each recent as e, i (i)}<li class="you">{e.ask}</li><li class="fizz">🧙 {e.result}</li>{/each}
      </ol>
    {/if}
    {#if changes.error}<p class="error" role="alert">{changes.error}</p>{/if}
    <label class="lbl" for="wizard-change">Ask for changes</label>
    <textarea id="wizard-change" bind:value={changes.draft} rows="1" maxlength={CHANGE_MAX} placeholder="e.g. only the ones from France" enterkeyhint="enter" autocomplete="off" autocapitalize="sentences"></textarea>
    <div class="row">
      <Button variant="secondary" size="sm" onclick={() => changes.ask(changes.draft)} disabled={!changes.draft.trim() || changes.busy} tip="Fizzwick writes the whole list again with your change; you can undo it">Change</Button>
      {#if changes.canUndo}<Button variant="ghost" size="sm" onclick={() => changes.undo()} tip="Brings back the list as it was before the last change">Undo</Button>{/if}
    </div>
  </section>
{/if}

<style>
  .change { display: flex; flex-direction: column; gap: var(--s-2); padding-top: var(--s-2); border-top: 1px solid var(--line); }
  .thread, .thread ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; font-size: 0.9rem; }
  .you { align-self: flex-end; max-width: 85%; padding: 4px 10px; border-radius: var(--r-md); background: var(--surface-hi); }
  .req { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .fizz { align-self: flex-start; color: var(--text-dim); }
  .older summary { color: var(--text-faint); cursor: pointer; }
  .older details[open] summary { margin-bottom: 4px; }
  .error { margin: 0; color: var(--c-bad); font-weight: 600; font-size: 0.9rem; }
  .lbl { font-weight: 600; color: var(--text-dim); }
  textarea { min-height: calc(1lh + 2 * var(--s-3)); max-height: calc(4lh + 2 * var(--s-3)); field-sizing: content; overflow-y: auto; resize: none; line-height: 1.35; }
  .row { display: flex; gap: var(--s-2); }
</style>
