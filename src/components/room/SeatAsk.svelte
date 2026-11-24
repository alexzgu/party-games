<script lang="ts">
  import Button from '../Button.svelte';
  import type { HostLink } from '../../lib/room/host-link.svelte';

  // Host screen: the seat opened with New phone. While it is open, a minute at most; then the one
  // Yes or No when a phone asks for it, beside the picture that phone should show; or, once it closed
  // without anyone getting it, why. The game goes on meanwhile.
  let { link }: { link: HostLink } = $props();
  const r = $derived(link.recovery);
</script>

{#if r}
  {#key `${r.pid}:${r.sign?.word}:${r.note}`}
    <div class="ask pop-in" role={r.sign ? 'alertdialog' : 'status'} aria-label="New phone for {r.name}">
      {#if r.note}
        <p>{r.note}</p>
        <div class="answers"><Button size="sm" variant="secondary" onclick={() => link.stopRecovery()}>OK</Button></div>
      {:else if r.sign}
        <p>A phone asks for {r.name}’s seat. Does {r.name}’s phone show this?</p>
        <div class="sign"><span class="emoji" role="img" aria-label={r.sign.word}>{r.sign.emoji}</span> <span aria-hidden="true">{r.sign.word}</span></div>
        <p class="small">If it shows something else, or you can’t see it, tap No.</p>
        <div class="answers">
          <Button size="sm" onclick={() => link.answer(true)} tip="Only if {r.name}’s phone shows this picture">Yes</Button>
          <Button size="sm" variant="secondary" onclick={() => link.answer(false)}>No</Button>
        </div>
      {:else}
        <p>{r.name}’s seat is open to a new phone for a minute. Ask them to join now.</p>
        <div class="answers"><Button size="sm" variant="secondary" onclick={() => link.stopRecovery()} tip="Shuts the seat again">Close</Button></div>
      {/if}
    </div>
  {/key}
{/if}

<style>
  .ask {
    position: fixed; z-index: var(--z-raised); left: 50%; translate: -50% 0;
    bottom: max(var(--s-4), env(safe-area-inset-bottom)); width: min(440px, calc(100% - 2 * var(--s-4)));
    display: flex; flex-direction: column; gap: var(--s-3); padding: var(--s-4);
    background: var(--bg-raised); border: 2px solid var(--accent); border-radius: var(--r-lg); box-shadow: var(--shadow);
  }
  p { margin: 0; font-weight: 700; overflow-wrap: anywhere; }
  .small { font-weight: 400; }
  .sign { display: flex; align-items: center; gap: var(--s-3); font-family: var(--font-display); font-weight: 800; font-size: 1.6rem; }
  .emoji { font-size: 3rem; line-height: 1; }
  .answers { display: flex; gap: var(--s-3); }
</style>
