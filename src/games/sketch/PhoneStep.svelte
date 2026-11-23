<script lang="ts">
  import Canvas from '../../components/draw/Canvas.svelte';
  import InkCard from '../../components/draw/InkCard.svelte';
  import Button from '../../components/Button.svelte';
  import { sketchPacks } from '../../lib/content';
  import { pick } from '../../lib/random';
  import type { Drawing } from '../../lib/ink';
  import { LINE_MAX } from './core';
  import { loadDraft, saveDraft } from './store';
  import type { View } from './view';
  // One Telephone step on a phone: write a line, draw the line handed over, or describe the
  // drawing handed over. Done sends at once; at the buzzer whatever is there is sent.
  let { v, art, expired, demo = false, ontext, ondraw }: {
    v: View; art: Record<string, Drawing>; expired: boolean; demo?: boolean;
    ontext: (text: string) => void; ondraw: (d: Drawing) => void;
  } = $props();
  // The parent keys this screen to the task, so its state belongs to this step.
  // svelte-ignore state_referenced_locally
  const task = v.task!;
  let draft = $state.raw(loadDraft(task.id));
  let sent = $state(false);
  const off = $derived(sent || v.paused || expired);
  const ready = $derived(task.kind === 'draw' ? draft.drawing.length > 0 : !!draft.text.trim());

  function update(patch: Partial<typeof draft>) {
    draft = { ...draft, ...patch };
    if (!demo) saveDraft(draft);
  }

  function submit() {
    if (sent || v.paused) return;
    update({ sent: true });
    sent = true;
    if (task.kind === 'draw') ondraw(draft.drawing);
    else ontext(draft.text.trim());
  }

  function idea() {
    const packs = sketchPacks();
    const chosen = packs.filter((p) => v.packs.includes(p.id));
    const ideas = (chosen.length ? chosen : packs).flatMap((p) => p.ideas).filter((x) => x !== draft.text);
    if (ideas.length) update({ text: pick(ideas) });
  }

  $effect(() => {
    if (draft.sent || expired) submit();
  });
</script>

{#snippet send(label: string)}
  <div class="send">
    <input maxlength={LINE_MAX} placeholder={label} aria-label={label} value={draft.text} disabled={off} enterkeyhint="done"
      oninput={(e) => update({ text: e.currentTarget.value })} onkeydown={(e) => { if (e.key === 'Enter' && ready) submit(); }} />
    <Button disabled={off || !ready} onclick={submit}>{sent ? 'Sent' : 'Done'}</Button>
  </div>
{/snippet}

{#if task.kind === 'write'}
  <p>Write something for the next player to draw: a scene, a saying, anything.</p>
  {@render send('Your line')}
  <Button variant="secondary" disabled={off} onclick={idea} tip="Fills in an idea from the packs, replacing your line">Give me an idea</Button>
{:else if task.kind === 'draw'}
  <p class="handed">Draw this: <b>{task.line}</b></p>
  <div class="pad" style:--draw-chrome="390px">
    <Canvas eraser label="Draw it" drawing={draft.drawing} onchange={(drawing) => update({ drawing })} disabled={off} />
  </div>
  <Button disabled={off || !ready} onclick={submit}>{sent ? 'Sent' : 'Done'}</Button>
{:else}
  {#if task.art}
    <div class="pic"><InkCard drawing={art[task.art]} label="The drawing handed to you" empty="Loading drawing…" /></div>
    <p>What is this? Describe it for the next player.</p>
  {:else}
    <p class="blank">Nothing was drawn. Make up what it might have been.</p>
  {/if}
  {@render send('What it shows')}
{/if}

<style>
  .handed b { font: 800 1.25rem/1.2 var(--font-display); overflow-wrap: anywhere; }
  .pad { display: grid; gap: var(--s-1); }
  .pic { width: min(100%, max(180px, 100dvh - 330px)); margin-inline: auto; }
  .blank { padding: var(--s-4); border: 2px dashed var(--line-strong); border-radius: var(--r-md); text-align: center; }
  .send { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--s-2); align-items: center; }
  input { min-height: 44px; min-width: 0; }
</style>
