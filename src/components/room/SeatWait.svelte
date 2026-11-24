<script lang="ts">
  import Button from '../Button.svelte';
  import { WAITING } from '../../lib/room/seats';

  // Phone: while the host is asked whether this phone may have a seat, the whole screen shows this
  // phone's own fixed words, large, and nothing from the other end; the host's question quotes them,
  // so the host can see that the phone in front of them is the one asking.
  let { link }: { link: { waiting: boolean; leave(): void } } = $props();
</script>

{#if link.waiting}
  <div class="wait fade-in" role="alertdialog" aria-label={WAITING}>
    <p class="words">{WAITING}</p>
    <p>Show this screen to the host.</p>
    <Button variant="secondary" onclick={() => link.leave()}>Cancel</Button>
  </div>
{/if}

<style>
  .wait {
    position: fixed; inset: 0; z-index: var(--z-raised); display: grid; place-content: center; justify-items: center;
    gap: var(--s-4); padding: var(--s-6) var(--s-4); text-align: center; background: var(--bg);
  }
  .words { margin: 0; max-width: 14ch; font-family: var(--font-display); font-weight: 800; font-size: 2.6rem; line-height: 1.1; }
  p { margin: 0; }
</style>
