<script lang="ts">
  import Canvas from './Canvas.svelte';
  import InkCard from './InkCard.svelte';
  import Button from '../../components/Button.svelte';
  import { loadDraft, saveDraft } from './store';
  import type { Drawing } from './ink';
  import type { View } from './view';
  let { v, art, ondraw, expired, demo = false }: {
    v: View; art: Record<string, Drawing>; expired: boolean; ondraw: (name: string, d: Drawing) => void; demo?: boolean;
  } = $props();
  // The parent keys this screen to the assignment, so state belongs to that fighter.
  // svelte-ignore state_referenced_locally
  let draft = $state.raw(loadDraft(v.draw!.id));
  let sent = $state(false);

  function update(patch: Partial<typeof draft>) {
    draft = { ...draft, ...patch };
    if (!demo) saveDraft(draft);
  }

  function submit() {
    if (!draft.drawing.length || sent || v.paused) return;
    update({ sent: true });
    sent = true;
    ondraw(draft.name, draft.drawing);
  }

  $effect(() => {
    if (draft.sent || expired) submit();
  });
</script>

{#if v.draw?.opponent}
  {@const f = v.draw.opponent}
  <div class="opponent">
    <InkCard drawing={art[f.id]} />
    <div><p>Draw a challenger for</p><h3>{f.name}</h3></div>
  </div>
{:else if v.phase === 'challenge'}
  <p>The other artist left their card blank. Draw a challenger anyway.</p>
{/if}
<!-- The challenger's card above takes room the canvas gives back on a short phone. -->
<div class="pad" style:--draw-chrome={v.draw?.opponent || v.phase === 'challenge' ? '420px' : '350px'}><Canvas drawing={draft.drawing} onchange={(drawing) => update({ drawing })} disabled={sent || v.paused || expired} /></div>
<!-- Name and Submit share a row, so both stay on screen under the canvas on a small phone. -->
<div class="send">
  <input maxlength={30} placeholder="Name your fighter" aria-label="Fighter name" value={draft.name} disabled={sent || v.paused || expired}
    oninput={(e) => update({ name: e.currentTarget.value })} />
  <Button disabled={sent || v.paused || expired || !draft.drawing.length} onclick={submit}>{sent ? 'Sent' : 'Submit fighter'}</Button>
</div>

<style>
  .opponent { display: grid; grid-template-columns: min(30%, 72px) 1fr; align-items: center; gap: var(--s-3); }
  .pad { display: grid; gap: var(--s-1); }
  .send { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--s-2); align-items: center; }
  input { min-height: 44px; min-width: 0; }
</style>
