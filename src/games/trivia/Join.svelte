<script lang="ts">
  import { gameName } from '../../app.config';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import HowTo from '../../components/HowTo.svelte';
  import ConnectionLink from '../../components/room/ConnectionLink.svelte';
  import { back } from '../../lib/router.svelte';
  import { cleanCode, isCode } from '../../lib/room/code';
  import { joinName } from '../../lib/username';
  import { NAME_MAX } from './logic';
  import { phone } from './player.svelte';
  import Rules from './Rules.svelte';

  let { code: initial, fixed }: { code: string; fixed: boolean } = $props();
  // svelte-ignore state_referenced_locally
  let code = $state(cleanCode(initial));
  // The phone's username, or after a refused join what was typed for it, so it can be fixed.
  let name = $state(joinName(NAME_MAX, phone.stopped ? phone.me?.name : ''));
  // Trying, or connected and waiting for the host's first screen: one Join is enough.
  const joining = $derived(!fixed && phone.link !== 'idle' && phone.link !== 'stopped');
  const ready = $derived(isCode(code) && !!name.trim() && !joining);
</script>

<Screen title="Join {gameName('trivia')}" onback={() => { if (!fixed) phone.leave(); back('/trivia'); }}>
  {#snippet trailing()}<HowTo><Rules /></HowTo>{/snippet}
  <form onsubmit={(e) => { e.preventDefault(); if (ready && !fixed) phone.join(code, name.trim()); }}>
    {#if !fixed && (phone.stopped || phone.trouble)}<p role="status">{phone.stopped || phone.trouble}</p>{/if}
    <label>Room code <input value={code} maxlength={6} oninput={(e) => {
      code = cleanCode(e.currentTarget.value);
      e.currentTarget.value = code;
    }} placeholder="ABCD" autocapitalize="characters" autocomplete="off" /></label>
    <label>Your name <input bind:value={name} maxlength={NAME_MAX} autocomplete="nickname" /></label>
    <button class="join" disabled={!ready}>{joining ? 'Joining…' : 'Join'}</button>
    {#if joining}<Button variant="secondary" onclick={() => phone.leave()}>Cancel</Button>{/if}
  </form>
  <ConnectionLink onchange={() => { if (joining && phone.me) phone.join(phone.me.code, phone.me.name); }} />
</Screen>

<style>
  form, label { display: grid; gap: var(--s-2); }
  form { gap: var(--s-4); }
  input, .join { min-height: 44px; }
  .join { background: var(--accent); color: var(--on-accent); border-radius: var(--r-md); font-weight: 800; }
</style>
