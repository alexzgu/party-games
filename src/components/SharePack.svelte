<script lang="ts">
  // "Share" in a pack editor, beside "Export": the phone's own pack, as saved,
  // into the Community library (library.ts `canShare`, `shareByHand`). The first share asks once,
  // in place; sharing needs the magic words, asked for here when the phone has no pass. The
  // library side marks the saved pack shared (like a shared wizard pack) once the share lands,
  // even if this editor has closed by then; the button then becomes a quiet "Shared in
  // Community", or "Share changes" once the pack has changed since.
  import { untrack } from 'svelte';
  import type { PackGameId } from '../app.config';
  import Button from './Button.svelte';
  import MagicWords from './MagicWords.svelte';
  import { hasKey } from '../lib/claude';
  import { hasPass, shareByHand, shareFailure, shareProblem, shareStatusNow } from '../lib/library';
  import { ownPack, type AnyPack } from '../lib/packfile';
  import { getUsername } from '../lib/username';
  import { sfx } from '../lib/sound';

  let { game, pack, onshared }: {
    game: PackGameId;
    /** The pack on screen: only its id is used, and each change of it reads the saved pack again. */
    pack: AnyPack;
    /** The share landed and the saved pack is marked: update the copy on screen (no saving). */
    onshared?: () => void;
  } = $props();

  // Every editor saves on each change, so reading the saved pack whenever the one on screen
  // changes keeps this in step; the share records (shareLog.svelte.ts) are reactive themselves.
  const status = $derived.by(() => {
    JSON.stringify(pack);
    return shareStatusNow(game, pack.id);
  });
  const problem = $derived.by(() => {
    JSON.stringify(pack);
    const saved = status === 'off' || status === 'current' || status === 'sending' ? undefined : ownPack(game, pack.id);
    return saved ? shareProblem(game, saved) : null;
  });
  /** The in-place "Anyone can see it" step before a pack's first share. */
  let confirming = $state(false);
  /** Waiting for the magic words, to share as soon as they are said. */
  let asking = $state(false);
  let note = $state('');

  function start() {
    note = '';
    if (status === 'new' && !confirming) confirming = true;
    else go();
  }

  function go() {
    confirming = false;
    if (hasPass()) void send();
    else asking = true;
  }

  // Once the magic words are said here, the share carries on by itself.
  $effect(() => {
    if (asking && hasPass()) {
      asking = false;
      untrack(() => void send());
    }
  });

  async function send() {
    if (status === 'sending') return;
    const r = await shareByHand(game, pack.id);
    if (!r.ok) {
      note = shareFailure(game, pack.id, r.reason);
      // An expired or refused pass was forgotten (library.ts): the words box comes back here.
      if (r.reason === 'pass') asking = true;
      return;
    }
    sfx.correct();
    onshared?.();
  }

  const LABEL: Record<string, string> = { new: 'Share', unsent: 'Share now', changed: 'Share changes', sending: 'Sharing…' };
</script>

{#if status !== 'off'}
  <div class="share">
    {#if status === 'current'}
      <p class="done faint" role="status">✓ Shared in Community</p>
    {:else if confirming}
      <p class="small">Anyone can see and import it. Your username, {getUsername()}, shows on it.</p>
      <div class="row">
        <Button size="sm" onclick={go} tip="Puts the pack in Community under your username">Share it</Button>
        <Button size="sm" variant="ghost" onclick={() => (confirming = false)}>Cancel</Button>
      </div>
    {:else}
      {#if status === 'changed'}<p class="done faint">Shared in Community · changed since</p>
      {:else if status === 'unsent'}<p class="done faint">This phone has no record of sharing it.</p>{/if}
      <Button variant="secondary" size="sm" onclick={start} disabled={status === 'sending' || !!problem || asking} tip={status === 'changed' ? 'Updates the copy in Community with your changes' : 'Puts this pack in Community for anyone to import'}>{LABEL[status]}</Button>
      {#if problem}<p class="faint small">{problem}</p>{/if}
    {/if}
    {#if asking}
      {#if hasKey()}<p class="faint small">Sharing needs the magic words; this phone uses the host's key.</p>
      {:else}<MagicWords intro="Sharing needs the magic words. Say the ones the host told you:" />{/if}
      <Button size="sm" variant="ghost" onclick={() => (asking = false)}>Not now</Button>
    {/if}
    {#if note}<p class="bad small" role="status">{note}</p>{/if}
  </div>
{/if}

<style>
  .share { display: flex; flex-direction: column; align-items: flex-start; gap: var(--s-2); }
  .row { display: flex; flex-wrap: wrap; gap: var(--s-2); }
  .share p { margin: 0; }
  .small, .done { font-size: 0.9rem; }
  .bad { color: var(--bad-ink); font-weight: 600; }
</style>
