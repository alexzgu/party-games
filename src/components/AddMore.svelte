<script lang="ts" generics="T">
  import { onDestroy, type Snippet } from 'svelte';
  import Screen from './Screen.svelte';
  import Button from './Button.svelte';
  import Stepper from './Stepper.svelte';
  import Triage from './Triage.svelte';
  import WizardEffort from './WizardEffort.svelte';
  import MagicWords from './MagicWords.svelte';
  import { hasKey, WANTS } from '../lib/claude';
  import { EMPTY_HANDED, type MoreRun } from '../lib/addMore';

  // "🧙 Add more", opened from a pack editor in place of it: how many and an optional steer, then
  // the wizard's new items stream into Triage for review; the kept ones go on top of the pack.
  // The game's `ask` builds the request from the pack and what this screen already holds.
  let {
    name,
    noun,
    range = null,
    steerHint = 'e.g. more 90s ones, harder',
    ask,
    keyOf,
    item,
    onadd,
    onclose,
    size,
    cta = '',
    accent,
  }: {
    /** The pack's name, shown on the screen. */
    name: string;
    /** What the items are called, plural ("words", "cards"). */
    noun: string;
    /** The count stepper; null when `size` asks instead (Big Board). */
    range?: { start: number; min: number; max: number; step: number } | null;
    steerHint?: string;
    /** Asks the wizard for `count` more, never one of `avoid` (already on this screen); resolves to how many came. */
    ask: (o: MoreRun<T>) => Promise<number>;
    keyOf: (t: T) => string;
    item: Snippet<[T]>;
    onadd: (kept: T[]) => void;
    onclose: () => void;
    /** Shown in place of the count stepper. */
    size?: Snippet;
    /** The ask button's words, when not "Conjure N more …". */
    cta?: string;
    accent?: string;
  } = $props();

  // svelte-ignore state_referenced_locally
  let count = $state(range?.start ?? 1);
  let steer = $state('');
  let phase = $state<'form' | 'review'>('form');
  let items = $state<T[]>([]);
  let streaming = $state(false);
  let error = $state('');
  let ctrl: AbortController | null = null;
  const keyed = $derived(hasKey());
  onDestroy(() => ctrl?.abort());

  async function run() {
    error = '';
    streaming = true;
    phase = 'review';
    ctrl?.abort();
    const c = (ctrl = new AbortController());
    try {
      const n = await ask({ count, steer, avoid: $state.snapshot(items) as T[], signal: c.signal, onItem: (t) => items.push(t) });
      if (!c.signal.aborted && n === 0) error = EMPTY_HANDED;
    } catch (e) {
      error = (e as Error).message;
    } finally {
      if (ctrl === c) { streaming = false; ctrl = null; }
    }
  }

  function cancel() {
    if (streaming) { ctrl?.abort(); streaming = false; return; }
    items = [];
    error = '';
    phase = 'form';
  }

  function leave() {
    ctrl?.abort();
    onclose();
  }
</script>

<Screen title="🧙 Add more" {accent} onback={leave} backLabel="Back to the pack">
  <p class="to">To “{name}”</p>
  {#if phase === 'form' && !keyed}
    <MagicWords intro={WANTS} />
  {:else if phase === 'form'}
    <form class="stack" onsubmit={(e) => { e.preventDefault(); void run(); }}>
      {#if size}{@render size()}{:else if range}
        <Stepper label="How many" bind:value={count} min={range.min} max={range.max} step={range.step} />
      {/if}
      <label class="field">
        <span class="lbl">Anything to steer him? (optional)</span>
        <input type="text" placeholder={steerHint} bind:value={steer} maxlength="120" autocomplete="off" enterkeyhint="go" />
      </label>
      <WizardEffort />
      <Button type="submit" size="lg">{cta || `✨ Conjure ${count} more ${noun}`}</Button>
    </form>
  {:else}
    {#if error}
      <div class="error" role="alert">
        <p>{error}</p>
        <!-- A refused pass leaves the phone without the wizard: the words come back here, then Try again. -->
        {#if !keyed}<MagicWords intro={WANTS} />{:else if !streaming}<Button size="sm" variant="secondary" onclick={run}>Try again</Button>{/if}
      </div>
    {/if}
    {#if streaming && items.length === 0}
      <p class="waiting"><span class="dot" aria-hidden="true"></span> Fizzwick is conjuring more {noun}…</p>
    {/if}
    <Triage {items} {keyOf} {streaming} onsave={onadd} oncancel={cancel} onmore={range && keyed ? run : undefined} {item} />
  {/if}
</Screen>

<style>
  .to { margin: 0; color: var(--text-dim); font-weight: 600; }
  .field { display: flex; flex-direction: column; gap: var(--s-1); }
  .lbl { font-weight: 600; color: var(--text-dim); font-size: 0.92rem; }
  .error {
    display: flex; flex-direction: column; align-items: flex-start; gap: var(--s-2); padding: var(--s-3) var(--s-4);
    border-radius: var(--r-md); background: color-mix(in srgb, var(--c-bad) 16%, var(--surface));
  }
  .error p { margin: 0; }
  .waiting { display: flex; align-items: center; gap: var(--s-2); color: var(--text-dim); margin: 0; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--accent); animation: pulse 1s ease-in-out infinite; }
  @keyframes pulse { 50% { opacity: 0.3; transform: scale(0.7); } }
</style>
