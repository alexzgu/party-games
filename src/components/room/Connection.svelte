<script lang="ts">
  import Popup from '../Popup.svelte';
  import Button from '../Button.svelte';
  import { brokerLabel, brokerSetting, setBroker } from '../../lib/room/broker';

  // Which matchmaking service this device uses. The backup is any PeerJS server, e.g. a laptop
  // running `npx peer --port 9000`; the host's QR code passes the choice on to the phones.
  let { onclose, onchange }: { onclose: () => void; onchange?: () => void } = $props();
  let text = $state(brokerSetting());
  let problem = $state('');

  function apply(raw: string) {
    if (!setBroker(raw)) { problem = 'Use the form host:port, e.g. 192.168.1.20:9000'; return; }
    onchange?.();
    onclose();
  }
</script>

<Popup title="Connection" {onclose}>
  <div class="conn">
    <p>Phones find the host screen through a free matchmaking service, then talk to it directly. Now using: <b>{brokerLabel()}</b>.</p>
    <p class="muted">If it can't be reached, run a backup on a computer (<code>npx peer --port 9000</code>) and type its address here, on the host screen first. The host's QR code then sends phones to the same place.</p>
    <label class="field">
      <span>Backup broker (host:port)</span>
      <input type="text" bind:value={text} placeholder="192.168.1.20:9000" autocomplete="off" autocapitalize="off" spellcheck="false" oninput={() => (problem = '')} />
    </label>
    {#if problem}<p class="problem" role="alert">{problem}</p>{/if}
    <Button onclick={() => apply(text)} disabled={!text.trim()}>Use this broker</Button>
    <Button variant="secondary" onclick={() => apply('')}>Use the default</Button>
  </div>
</Popup>

<style>
  .conn { display: flex; flex-direction: column; gap: var(--s-3); }
  .field { display: flex; flex-direction: column; gap: var(--s-1); font-weight: 600; color: var(--text-dim); }
  code { font-size: 0.9em; background: var(--overlay); padding: 1px 6px; border-radius: 6px; }
  .problem { color: var(--bad-ink); font-weight: 600; }
</style>
