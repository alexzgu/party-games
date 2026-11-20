<script lang="ts">
  import { gameName } from '../../app.config';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import HowTo from '../../components/HowTo.svelte';
  import Rules from './Rules.svelte';
  import Connection from '../../components/room/Connection.svelte';
  import { go } from '../../lib/router.svelte';
  import { phone } from './player.svelte';
  import { CODE_LENGTH, cleanCode } from '../../lib/room/code';
  import { NAME_MAX, cleanName } from './logic';
  import { brokerLabel } from '../../lib/room/broker';

  // Room code (filled in from the QR link) and a name, then Join. A reason from the host or
  // the broker (wrong code, name taken, removed) shows above the form.
  let { code: start = '', name: startName = '', stopped = '' }: { code?: string; name?: string; stopped?: string } = $props();
  // svelte-ignore state_referenced_locally
  let code = $state(cleanCode(start));
  // svelte-ignore state_referenced_locally
  let name = $state(startName);
  let showConn = $state(false);
  let nameInput = $state<HTMLInputElement>();
  const ready = $derived(code.length === CODE_LENGTH && cleanName(name) !== '');

  $effect(() => { if (code.length === CODE_LENGTH && !name) nameInput?.focus(); });

  function join(e?: SubmitEvent) {
    e?.preventDefault();
    if (!ready) return;
    phone.join(code, cleanName(name));
  }
</script>

<Screen title="Join {gameName('snark')}" onback={() => { phone.leave(); go('/snark', true); }}>
  {#snippet trailing()}<HowTo><Rules /></HowTo>{/snippet}
  <form class="join" onsubmit={join}>
    {#if stopped}<p class="stopped pop-in" role="alert">{stopped}</p>{/if}
    <label class="field">
      <span>Room code</span>
      <input class="code" type="text" value={code} oninput={(e) => (code = cleanCode(e.currentTarget.value))} maxlength={CODE_LENGTH + 2}
        placeholder="ABCD" autocomplete="off" autocapitalize="characters" spellcheck="false" inputmode="text" enterkeyhint="next" aria-label="Room code" />
    </label>
    <label class="field">
      <span>Your name</span>
      <input bind:this={nameInput} type="text" bind:value={name} maxlength={NAME_MAX} placeholder="Name on the big screen"
        autocomplete="nickname" autocapitalize="words" enterkeyhint="go" aria-label="Your name" />
    </label>
    <p class="faint hint">The code is on the host screen. Scanning its QR code fills it in.</p>
  </form>
  <button class="conn" onclick={() => (showConn = true)}>Matchmaking: {brokerLabel()}</button>
  {#snippet actions()}
    <Button size="lg" disabled={!ready} onclick={() => join()}>Join</Button>
  {/snippet}
</Screen>

{#if showConn}<Connection onclose={() => (showConn = false)} />{/if}

<style>
  .join { display: flex; flex-direction: column; gap: var(--s-4); }
  .field { display: flex; flex-direction: column; gap: var(--s-2); font-weight: 700; color: var(--text-dim); }
  .code { font-family: var(--font-display); font-weight: 800; font-size: 2.4rem; letter-spacing: 0.3em; text-transform: uppercase; text-align: center; padding: var(--s-3); }
  .code::placeholder { color: var(--text-faint); opacity: 0.5; }
  .stopped { padding: var(--s-3) var(--s-4); border-radius: var(--r-md); font-weight: 700; line-height: 1.4;
    background: color-mix(in srgb, var(--c-pass) 14%, var(--surface)); border: 1.5px solid color-mix(in srgb, var(--c-pass) 45%, transparent); }
  .hint { font-size: 0.9rem; }
  .conn { align-self: center; background: none; color: var(--text-faint); font-size: 0.85rem; min-height: 44px; padding: 0 var(--s-3); }
</style>
