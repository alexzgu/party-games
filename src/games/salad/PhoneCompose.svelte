<script lang="ts">
  import Button from '../../components/Button.svelte';
  import type { PlayerView } from './view';
  import type { ToHost } from './protocol';

  let { draft, guesses, players, prepare, send, serial }: {
    draft: NonNullable<PlayerView['draft']>; guesses: PlayerView['guesses']; players: PlayerView['players'];
    prepare: boolean; send: (m: ToHost) => void; serial: number;
  } = $props();

  let active = $state(0);
  const parts = $derived(draft.frame.text.split('___'));
  const slot = $derived(draft.frame.slots[active]);
  const choices = $derived.by(() => {
    const bank = draft.choices[active] ?? [];
    return slot === 'guess' ? [...bank].reverse() : bank;
  });
  const complete = $derived(draft.values.every((value) => value !== null));

  const guessFor = (id: string) => guesses.find((g) => String(g.id) === id);
  function label(i: number, value: string) {
    return draft.frame.slots[i] === 'guess' ? guessFor(value)?.text ?? 'Guess' : value;
  }

  function pick(value: string) {
    send({ serial, frame: draft.index, t: 'word', slot: active, value });
    const next = draft.values.findIndex((word, i) => i !== active && word === null);
    if (next >= 0) active = next;
  }
</script>

<div class="compose">
  <div class="sentence" aria-label="Build a sentence">
    {#each parts as part, i (i)}
      {part}
      {#if i < draft.frame.slots.length}
        {@const value = draft.values[i]}
        <button class="blank" aria-pressed={i === active} aria-label="Blank {i + 1}{value ? `: ${label(i, value)}` : ''}" onclick={() => (active = i)}>
          {value ? label(i, value) : '___'}
        </button>
      {/if}
    {/each}
  </div>
  <div class="bank" class:comparison={slot === 'guess'} aria-label="Choices for blank {active + 1}">
    {#each choices as value (value)}
      {@const guess = slot === 'guess' ? guessFor(value) : undefined}
      <button class="word" aria-pressed={value === draft.values[active]} onclick={() => pick(value)}>
        <b>{label(active, value)}</b>
        {#if guess}<small>{players.find((p) => p.pid === guess.pid)?.name ?? 'Player'}</small>{/if}
      </button>
    {:else}
      <p class="muted">A guess is needed for this frame.</p>
    {/each}
  </div>
  <div class="tools">
    {#if slot !== 'guess'}
      <Button size="sm" variant="secondary" onclick={() => send({ serial, frame: draft.index, t: 'more', slot: active })}>More words</Button>
    {/if}
    {#if !prepare}
      <Button size="sm" variant="ghost" onclick={() => send({ serial, frame: draft.index, t: 'skipFrame' })}>Different sentence</Button>
    {/if}
  </div>
  <Button disabled={!complete} onclick={() => send({ serial, frame: draft.index, t: 'publish' })}>
    {prepare ? 'Ready' : 'Send clue'}
  </Button>
</div>

<style>
  .compose { display: grid; gap: var(--s-3); }
  .sentence {
    padding: var(--s-3) var(--s-4); background: var(--surface); border: 2px solid var(--line);
    border-radius: var(--r-lg); font: 800 1.5rem / 1.45 var(--font-display); overflow-wrap: anywhere;
  }
  .blank {
    display: inline-block; vertical-align: baseline; padding: 0 var(--s-2); min-height: 44px; min-width: 44px; max-width: 100%;
    border-radius: var(--r-md); background: var(--bg-sunk); color: var(--text); border: 2px solid var(--line);
    overflow-wrap: anywhere; font: inherit; line-height: 1.2;
  }
  .blank[aria-pressed="true"], .word[aria-pressed="true"] { border-color: var(--accent); color: var(--accent); }
  .bank { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s-2); }
  .comparison { display: flex; flex-direction: column; max-height: 34dvh; overflow: auto; }
  .comparison .word { text-align: left; grid-template-columns: 1fr auto; justify-items: start; }
  .word {
    display: grid; align-items: baseline; justify-items: center; gap: var(--s-2); padding: var(--s-1) var(--s-2);
    min-width: 0; min-height: 44px; border-radius: var(--r-md); background: var(--surface); border: 2px solid var(--line);
    overflow-wrap: anywhere;
  }
  .word small { color: var(--text-dim); }
  .tools { display: flex; justify-content: space-between; gap: var(--s-2); }
</style>
