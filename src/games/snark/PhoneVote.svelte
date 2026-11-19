<script lang="ts">
  import { haptic } from '../../lib/haptics';
  import { sfx } from '../../lib/sound';

  type VoteScreen = { at: number; prompt: string; choices: { id: 'a' | 'b'; text: string }[]; own: boolean; voted: 'a' | 'b' | null };
  // Two big answer buttons. Your own prompt: both answers shown, no buttons.
  let { screen, onvote }: { screen: VoteScreen; onvote: (c: 'a' | 'b') => void } = $props();

  // svelte-ignore state_referenced_locally
  let picked = $state<'a' | 'b' | null>(screen.voted);
  const chosen = $derived(screen.voted ?? picked);
  const shownAt = performance.now();

  function vote(c: 'a' | 'b') {
    if (chosen || performance.now() - shownAt < 400) return;
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
      <button class="choice pop-in" class:on={chosen === c.id} class:off={!!chosen && chosen !== c.id} disabled={screen.own}
        style:animation-delay="{i * 90}ms" aria-pressed={chosen === c.id} onclick={() => vote(c.id)}>
        {#if chosen === c.id}<span class="tick" aria-hidden="true">✓</span>{/if}
        {c.text}
      </button>
    {/each}
  </div>
  <p class="note muted" aria-live="polite">{screen.own ? "That's yours! Sit tight while the others vote." : chosen ? 'Vote sent. Eyes on the host screen.' : 'Tap the one you like best.'}</p>
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
  .tick { position: absolute; top: 8px; right: 12px; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; background: var(--accent); color: var(--on-accent); font-size: 0.95rem; }
  .note { text-align: center; }
</style>
