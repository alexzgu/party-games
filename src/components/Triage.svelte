<script lang="ts" generics="T">
  import type { Snippet } from 'svelte';
  import Button from './Button.svelte';
  import WizardNote from './WizardNote.svelte';

  // Review loop for generated items: everything starts kept; tap to drop the duds.
  // Items stream in while the model is still writing.
  let {
    items,
    keyOf,
    item,
    streaming = false,
    wizard,
    saveLabel = 'Save',
    onsave,
    oncancel,
    onmore,
  }: {
    items: T[];
    keyOf: (t: T) => string;
    item: Snippet<[T]>;
    streaming?: boolean;
    /** Fizzwick wrote these (not a pasted list): the note that he can be wrong shows over them. */
    wizard: boolean;
    /** What the main button says before the count, when a step follows instead of a save. */
    saveLabel?: string;
    onsave: (kept: T[]) => void;
    oncancel: () => void;
    onmore?: () => void;
  } = $props();

  let dropped = $state(new Set<string>());
  const kept = $derived(items.filter((t) => !dropped.has(keyOf(t))));

  function toggle(t: T) {
    const k = keyOf(t);
    const next = new Set(dropped);
    next.has(k) ? next.delete(k) : next.add(k);
    dropped = next;
  }
</script>

<div class="triage">
  <p class="count" aria-live="polite">
    {#if streaming}<span class="dot" aria-hidden="true"></span>{/if}
    <span>{#if streaming}Writing… {/if}<b>{kept.length}</b> kept · {items.length - kept.length} dropped · tap to toggle</span>
  </p>
  {#if wizard && items.length}<WizardNote />{/if}
  <ul class="list">
    {#each items as t (keyOf(t))}
      <li class="pop-in">
        <button class="chip" class:off={dropped.has(keyOf(t))} onclick={() => toggle(t)} aria-pressed={!dropped.has(keyOf(t))}>
          {@render item(t)}
        </button>
      </li>
    {/each}
  </ul>
  <div class="actions">
    <Button onclick={() => onsave(kept)} disabled={kept.length === 0 || streaming} size="lg" tip="Keeps these and leaves out the dropped ones">{saveLabel} {kept.length}</Button>
    <div class="row">
      {#if onmore}<Button variant="secondary" onclick={onmore} disabled={streaming} tip="Asks Fizzwick for another batch to add to these">More</Button>{/if}
      <Button variant="ghost" onclick={oncancel} tip={streaming ? 'Stops Fizzwick; what is written so far stays' : 'Throws all of these away and goes back'}>{streaming ? 'Stop' : 'Discard all'}</Button>
    </div>
  </div>
</div>

<style>
  .triage { display: flex; flex-direction: column; gap: var(--s-3); }
  .count { color: var(--text-dim); display: flex; align-items: center; gap: var(--s-2); }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--accent); animation: pulse 1s ease-in-out infinite; }
  @keyframes pulse { 50% { opacity: 0.3; transform: scale(0.7); } }
  .list { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: var(--s-2); }
  .chip { min-height: 44px; padding: var(--s-2) var(--s-4); border-radius: var(--r-md); border: 1.5px solid var(--accent);
    background: color-mix(in srgb, var(--accent) 14%, var(--surface)); text-align: left; transition: all var(--dur-fast) ease; }
  .chip.off { border-color: var(--line); background: transparent; color: var(--text-faint); text-decoration: line-through; }
  .actions { position: sticky; bottom: 0; padding: var(--s-3) 0 calc(var(--safe-bottom) + var(--s-3)); background: linear-gradient(to top, var(--bg) 75%, transparent); display: flex; flex-direction: column; gap: var(--s-2); }
  .row { display: flex; gap: var(--s-2); }
</style>
