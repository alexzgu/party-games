<script lang="ts">
  import Button from '../Button.svelte';
  import type { Sign } from '../../lib/room/seats';
  import { ELSEWHERE } from '../../lib/room/phone-link.svelte';

  // Phone: while the host is asked whether this phone may have a seat, the whole screen shows the
  // picture the host picked for this request, large, with its word; the host's question shows the
  // same one, so the host can see that the phone in front of them is the one asking. Once another
  // tab has taken this seat, the screen says so, with the way back.
  let { link }: { link: { sign: Sign | null; elsewhere: boolean; leave(): void; here(): void } } = $props();
</script>

{#if link.sign}
  <div class="wait fade-in" role="alertdialog" aria-label="Show this screen to the host">
    <span class="emoji" role="img" aria-label={link.sign.word}>{link.sign.emoji}</span>
    <p class="words" aria-hidden="true">{link.sign.word}</p>
    <p>Show this screen to the host</p>
    <Button variant="secondary" onclick={() => link.leave()}>Cancel</Button>
  </div>
{:else if link.elsewhere}
  <div class="wait fade-in" role="alertdialog" aria-label={ELSEWHERE}>
    <p class="words">{ELSEWHERE}</p>
    <Button onclick={() => link.here()}>Play here</Button>
  </div>
{/if}

<style>
  .wait {
    position: fixed; inset: 0; z-index: var(--z-raised); display: grid; place-content: center; justify-items: center;
    gap: var(--s-4); padding: var(--s-6) var(--s-4); text-align: center; background: var(--bg);
  }
  .emoji { font-size: min(40vw, 12rem); line-height: 1; }
  .words { margin: 0; max-width: 14ch; font-family: var(--font-display); font-weight: 800; font-size: 2.6rem; line-height: 1.1; }
  p { margin: 0; }
</style>
