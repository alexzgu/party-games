<script lang="ts">
  import { haptic } from '../../lib/haptics';
  import { sfx } from '../../lib/sound';
  import Voters from './Voters.svelte';
  import type { Tick } from './view';

  type VoteScreen = { at: number; prompt: string; choices: { id: 'a' | 'b'; text: string; empty: boolean }[]; own: boolean; voted: 'a' | 'b' | null; mine?: 'a' | 'b'; voters?: Tick[] };
  // Two big answer buttons. Your own prompt: both answers shown, no buttons. A side with no
  // answer is shown but cannot be picked (the host refuses it too). Once there is nothing left
  // to do here, who has voted shows underneath, as on the host screen.
  let { screen, onvote }: { screen: VoteScreen; onvote: (c: 'a' | 'b') => void } = $props();

  // svelte-ignore state_referenced_locally
  let picked = $state<'a' | 'b' | null>(screen.voted);
  const chosen = $derived(screen.voted ?? picked);
  const shownAt = performance.now();
  const votesIn = $derived(screen.voters?.filter((v) => v.done).length ?? 0);

  function vote(c: 'a' | 'b') {
    if (chosen || screen.choices.find((x) => x.id === c)?.empty || performance.now() - shownAt < 400) return;
    picked = c;
    sfx.tap();
    haptic.correct();
    onvote(c);
  }
</script>

<div class="vote">
  <p class="step">{screen.own ? 'Your prompt' : 'Vote for the funnier one'}</p>
  <h2 class="prompt">{screen.prompt}</h2>
  <div class="choices">
    {#each screen.choices as c, i (c.id)}
      <button class="choice pop-in" class:on={chosen === c.id} class:off={!!chosen && chosen !== c.id} class:empty={c.empty} disabled={screen.own || c.empty}
        style:animation-delay="{i * 90}ms" aria-pressed={chosen === c.id} onclick={() => vote(c.id)}>
        {#if chosen === c.id}<span class="tick" aria-hidden="true">✓</span>{/if}
        {#if screen.mine === c.id}<span class="tag">Yours</span>{/if}
        {c.text}
        {#if c.empty && !screen.own}<small class="why">No answer sent, so no vote</small>{/if}
      </button>
    {/each}
  </div>
  <p class="note muted" aria-live="polite">{screen.own ? "That's yours! Sit tight while the others vote." : chosen ? 'Vote sent.' : 'Tap the one you like best.'}</p>
  {#if screen.voters?.length}
    <section class="room fade-in" aria-label="Votes so far">
      <p class="count">{votesIn} of {screen.voters.length} {screen.voters.length === 1 ? 'vote' : 'votes'} in</p>
      <Voters people={screen.voters} size={28} />
    </section>
  {/if}
</div>

<style>
  .vote { display: flex; flex-direction: column; gap: var(--s-3); }
  .step { color: var(--text-faint); font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.82rem; }
  .prompt { font-size: clamp(1.3rem, 6vw, 1.8rem); line-height: 1.15; }
  .choices { display: flex; flex-direction: column; gap: var(--s-3); }
  .choice {
    position: relative; min-height: 104px; padding: var(--s-4) var(--s-5); border-radius: var(--r-lg); text-align: center;
    background: var(--surface); border: 2.5px solid var(--line-strong); color: var(--text);
    font-family: var(--font-display); font-weight: 800; font-size: 1.35rem; line-height: 1.2; overflow-wrap: anywhere;
    transition: transform var(--dur-fast) var(--ease-out), border-color var(--dur) ease, background var(--dur) ease, opacity var(--dur) ease;
  }
  .choice:active:not(:disabled) { transform: scale(0.97); }
  .choice:disabled { opacity: 0.75; cursor: default; }
  .choice.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 20%, var(--surface)); }
  .choice.off { opacity: 0.45; }
  .choice.empty { border-style: dashed; color: var(--text-dim); font-style: italic; }
  .why { display: block; margin-top: var(--s-1); font-family: var(--font-body); font-weight: 600; font-style: normal; font-size: 0.9rem; color: var(--text-faint); }
  .tick { position: absolute; top: 8px; right: 12px; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; background: var(--accent); color: var(--on-accent); font-size: 0.95rem; }
  .note { text-align: center; }
  .tag { position: absolute; top: 8px; left: 12px; padding: 2px 10px; border-radius: var(--r-pill); background: var(--me, var(--accent)); color: var(--on-accent); font-family: var(--font-body); font-size: 0.75rem; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; font-style: normal; }
  .room { display: flex; flex-direction: column; align-items: center; gap: var(--s-2); }
  .count { color: var(--text-faint); font-weight: 700; font-size: 0.9rem; }
</style>
