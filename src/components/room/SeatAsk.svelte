<script lang="ts">
  import Button from '../Button.svelte';
  import { askText } from '../../lib/room/seats';
  import type { HostLink } from '../../lib/room/host-link.svelte';

  // Host screen: a phone that cannot show it owns a seat waits for the host's Yes or No. The
  // number is on that phone only, so the host can tell whose it is. One question at a time, over
  // the game and its pause; the game goes on meanwhile.
  let { link }: { link: HostLink } = $props();
  const ask = $derived(link.asks[0]);
</script>

{#if ask}
  {#key ask.id}
    <div class="ask pop-in" role="alertdialog" aria-label="A phone is waiting">
      <p>{askText(ask)}</p>
      <div class="answers">
        <Button size="sm" onclick={() => link.answer(ask, true)} tip={ask.code === null ? 'Only if you know whose phone it is' : 'Only if you see that number on their phone'}>Yes</Button>
        <Button size="sm" variant="secondary" onclick={() => link.answer(ask, false)}>No</Button>
      </div>
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
  .answers { display: flex; gap: var(--s-3); }
</style>
