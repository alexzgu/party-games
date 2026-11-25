<script lang="ts">
  import { onDestroy } from 'svelte';
  import Canvas from '../../components/draw/Canvas.svelte';
  import type { Drawing } from '../../lib/ink';
  import { outgoing, SEND_MS } from './live';
  import { hasDraft, loadDraft, saveDraft } from './store';
  import { gallery, phone } from './player.svelte';
  import WordShape from './WordShape.svelte';
  import Feed from './Feed.svelte';
  import type { View } from './view';
  // The drawer's phone in Draw & guess: the word, the pad, and the guesses coming in. What is
  // drawn goes to the host about every 100 ms: only what was added, or all of it after an undo
  // or clear, after a reconnect, or when the host missed some.
  let { v, me, expired, demo = false, fit = false }: { v: View; me?: string; expired: boolean; demo?: boolean; fit?: boolean } = $props();
  // The parent keys this screen to the turn.
  // svelte-ignore state_referenced_locally
  const id = v.ink!;
  // svelte-ignore state_referenced_locally
  const at = v.at;
  let draft = $state.raw(loadDraft(id));
  /** This phone has a drawing of its own, a cleared one too: the host's never replaces it. */
  let mine = hasDraft(id);
  /** What the host has been sent (null: send it all next time), and the number of that send. */
  let sent: Drawing | null = null;
  let n = 0;

  function change(drawing: Drawing) {
    draft = { ...draft, drawing };
    mine = true;
    if (!demo) saveDraft(draft);
  }

  function flush() {
    const d = draft.drawing;
    const ink = demo || phone.link !== 'live' ? null : outgoing(sent, n, d, mine);
    if (!ink) return;
    phone.ask({ t: 'ink', at, n: ++n, ...ink });
    sent = d;
  }

  // A phone that took over this turn carries on from the drawing the host has: with none of its
  // own, its pad opens when the host has sent that (blank or not), or soon anyway.
  // svelte-ignore state_referenced_locally
  let ready = $state(demo || mine);
  $effect(() => {
    const had = gallery.art[id];
    if (had?.length && !n && !mine) change(had);
    if (had) ready = true;
  });
  const soon = setTimeout(() => { ready = true; }, 3000);
  onDestroy(() => clearTimeout(soon));

  const timer = setInterval(flush, SEND_MS);
  onDestroy(() => clearInterval(timer));
  // A fresh link, or the host asking: send the whole drawing.
  $effect(() => {
    void gallery.resync;
    if (phone.link === 'live') sent = null;
  });
</script>

<WordShape word={v.word} />
<div class="pad" style:--draw-chrome="420px">
  <Canvas eraser label="Draw the word" drawing={draft.drawing} onchange={change} disabled={v.paused || expired || !ready} />
</div>
<p class="count">{v.got?.length ?? 0} of {v.guessers ?? 0} got it</p>
<div class="feed" class:fit><Feed feed={v.feed ?? []} {me} /></div>

<style>
  .pad { display: grid; gap: var(--s-1); }
  .count { color: var(--text-dim); text-align: center; }
  /* On a screen that fits the phone (Phone.svelte) the list takes all the room left under the pad,
     never under about two and a half rows, as tall as its guesses and scrolling inside past that;
     on a screen that scrolls as one piece it is as tall as its guesses up to 22% of the screen. */
  .feed { display: grid; max-height: 22dvh; min-height: 3.5em; }
  .feed.fit { display: flex; flex-direction: column; flex: 1 1 0; max-height: none; min-height: 5.2em; }
  .feed.fit :global(ol) { flex: 0 1 auto; min-height: 3.5em; }
</style>
