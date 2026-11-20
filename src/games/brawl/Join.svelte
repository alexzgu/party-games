<script lang="ts">
  import { gameName } from '../../app.config';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import HowTo from '../../components/HowTo.svelte';
  import Connection from '../../components/room/Connection.svelte';
  import { go } from '../../lib/router.svelte';
  import { cleanCode, isCode } from '../../lib/room/code';
  import { phone } from './player.svelte';
  import Rules from './Rules.svelte';

  let { code: initial, fixed }: { code: string; fixed: boolean } = $props();
  // svelte-ignore state_referenced_locally
  let code = $state(cleanCode(initial));
  let name = $state(phone.me?.name ?? '');
  let connection = $state(false);
  const ready = $derived(isCode(code) && !!name.trim() && phone.link !== 'joining');
</script>

<Screen title="Join {gameName('brawl')}" onback={() => { if (!fixed) phone.leave(); go('/brawl'); }}>
  {#snippet trailing()}<HowTo><Rules /></HowTo>{/snippet}
  <form onsubmit={(e) => { e.preventDefault(); if (ready && !fixed) phone.join(code, name.trim()); }}>
    {#if !fixed && (phone.stopped || phone.trouble)}<p role="status">{phone.stopped || phone.trouble}</p>{/if}
    <label>Room code <input value={code} maxlength={6} oninput={(e) => {
      code = cleanCode(e.currentTarget.value);
      e.currentTarget.value = code;
    }} placeholder="ABCD" autocapitalize="characters" autocomplete="off" /></label>
    <label>Your name <input bind:value={name} maxlength={20} autocomplete="nickname" /></label>
    <button class="join" disabled={!ready}>{phone.link === 'joining' ? 'Joining…' : 'Join'}</button>
    <Button variant="secondary" onclick={() => (connection = true)}>Connection settings</Button>
  </form>
</Screen>
{#if connection}<Connection onclose={() => (connection = false)} />{/if}

<style>
  form, label { display: grid; gap: var(--s-2); }
  form { gap: var(--s-4); }
  input, .join { min-height: 44px; }
  .join { background: var(--accent); color: var(--on-accent); border-radius: var(--r-md); font-weight: 800; }
</style>
