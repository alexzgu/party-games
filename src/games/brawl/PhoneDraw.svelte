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
<Canvas drawing={draft.drawing} onchange={(drawing) => update({ drawing })} disabled={sent || v.paused || expired} />
<label>Fighter name
  <input maxlength={30} placeholder="Nameless" value={draft.name} disabled={sent || v.paused || expired}
    oninput={(e) => update({ name: e.currentTarget.value })} />
</label>
<Button disabled={sent || v.paused || expired || !draft.drawing.length} onclick={submit}>{sent ? 'Drawing sent' : 'Submit fighter'}</Button>

<style>
  .opponent { display: grid; grid-template-columns: 30% 1fr; align-items: center; gap: var(--s-3); }
  label { display: grid; gap: var(--s-1); }
  input { min-height: 44px; }
</style>
