<script lang="ts">
  import { untrack } from 'svelte';
  import { gameName } from '../../app.config';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import HowTo from '../../components/HowTo.svelte';
  import Connection from '../../components/room/Connection.svelte';
  import { go } from '../../lib/router.svelte';
  import { CODE_LENGTH, cleanCode } from '../../lib/room/code';
  import { brokerLabel } from '../../lib/room/broker';
  import { NAME_MAX } from './protocol';
  import Rules from './Rules.svelte';

  let { initialCode, initialName, stopped, onjoin, onleave }: {
    initialCode: string; initialName: string; stopped: string;
    onjoin: (code: string, name: string) => void; onleave: () => void;
  } = $props();

  let code = $state(untrack(() => cleanCode(initialCode)));
  let name = $state(untrack(() => initialName));
  let connection = $state(false);
  const ready = $derived(code.length === CODE_LENGTH && !!name.trim());

  function join(e: SubmitEvent) {
    e.preventDefault();
    if (ready) onjoin(code, name.trim());
  }
</script>

<Screen title="Join {gameName('salad')}" onback={() => { onleave(); go('/salad', true); }}>
  {#snippet trailing()}<HowTo><Rules /></HowTo>{/snippet}
  {#if stopped}<p class="status" role="alert">{stopped}</p>{/if}

  <form onsubmit={join}>
    <label>
      Room code
      <input class="code" type="text" value={code} oninput={(e) => (code = cleanCode(e.currentTarget.value))}
        maxlength={CODE_LENGTH + 2} placeholder="ABCD" autocomplete="off" autocapitalize="characters"
        spellcheck="false" enterkeyhint="next" />
    </label>
    <label>
      Your name
      <input type="text" bind:value={name} maxlength={NAME_MAX} autocomplete="nickname" autocapitalize="words" enterkeyhint="go" />
    </label>
    <p class="muted">Scanning the host’s QR code fills in the room code.</p>
    <Button type="submit" size="lg" disabled={!ready}>Join</Button>
  </form>

  <Button variant="ghost" onclick={() => (connection = true)}>Matchmaking: {brokerLabel()}</Button>
</Screen>

{#if connection}<Connection onclose={() => (connection = false)} />{/if}

<style>
  form, label { display: grid; gap: var(--s-2); }
  form { gap: var(--s-4); }
  label { font-weight: 700; }
  input { min-height: var(--tap); }
  .code {
    font-family: var(--font-display); font-weight: 800; font-size: 2.2rem; letter-spacing: 0.2em;
    text-transform: uppercase; text-align: center;
  }
  .status { padding: var(--s-3); border-radius: var(--r-md); background: var(--surface); }
</style>
