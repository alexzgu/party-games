<script lang="ts">
  import { onDestroy } from 'svelte';
  import Canvas from '../../components/draw/Canvas.svelte';
  import type { Drawing } from '../../lib/ink';
  import { outgoing, SEND_MS } from './live';
  import { loadDraft, saveDraft } from './store';
  import { gallery, phone } from './player.svelte';
  import WordShape from './WordShape.svelte';
  import Feed from './Feed.svelte';
  import type { View } from './view';
  // The drawer's phone in Draw & guess: the word, the pad, and the guesses coming in. What is
  // drawn goes to the host about every 100 ms: only what was added, or all of it after an undo
  // or clear, after a reconnect, or when the host missed some.
  let { v, me, expired, demo = false }: { v: View; me?: string; expired: boolean; demo?: boolean } = $props();
  // The parent keys this screen to the turn.
  // svelte-ignore state_referenced_locally
  const id = v.ink!;
  // svelte-ignore state_referenced_locally
  const at = v.at;
  let draft = $state.raw(loadDraft(id));
  /** What the host has been sent (null: send it all next time), and the number of that send. */
  let sent: Drawing | null = null;
  let n = 0;

  function change(drawing: Drawing) {
    draft = { ...draft, drawing };
    if (!demo) saveDraft(draft);
  }

  function flush() {
    const d = draft.drawing;
    const ink = demo || phone.link !== 'live' ? null : outgoing(sent, n, d);
    if (!ink) return;
    phone.ask({ t: 'ink', at, n: ++n, ...ink });
    sent = d;
  }

  // A phone that took over this turn carries on from the drawing the host has.
  $effect(() => {
    const had = gallery.art[id];
    if (had?.length && !n && !draft.drawing.length) change(had);
  });

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
  <Canvas eraser label="Draw the word" drawing={draft.drawing} onchange={change} disabled={v.paused || expired} />
</div>
<p class="count">{v.got?.length ?? 0} of {v.guessers ?? 0} got it</p>
<div class="feed"><Feed feed={v.feed ?? []} {me} /></div>

<style>
  .pad { display: grid; gap: var(--s-1); }
  .count { color: var(--text-dim); text-align: center; }
  .feed { display: grid; max-height: 22dvh; min-height: 3.5em; }
</style>
