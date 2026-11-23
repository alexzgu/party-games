<script lang="ts">
  import Popup from '../Popup.svelte';
  import Button from '../Button.svelte';
  import { brokerLabel, brokerSetting, setBroker } from '../../lib/room/broker';

  // Which service phones use to find the host screen. The backup is any PeerJS server, e.g. a
  // laptop running `npx peer --port 9000`; the host's QR code passes the choice on to the phones.
  let { onclose, onchange }: { onclose: () => void; onchange?: () => void } = $props();
  let text = $state(brokerSetting());
  let problem = $state('');
  const backup = brokerSetting() !== '';

  function apply(raw: string) {
    if (!setBroker(raw)) { problem = 'Type it as address:port, e.g. 192.168.1.20:9000'; return; }
    onchange?.();
    onclose();
  }
</script>

<Popup title="Trouble connecting?" {onclose}>
  <div class="conn">
    <p>Phones find the host screen through a free online service, then talk to it directly. Both need the internet.</p>
    <p>Now using: <b>{backup ? `a backup server at ${brokerLabel()}` : 'the usual free service'}</b>.</p>
    {#if backup}
      <p class="muted">Scanning the host's QR code sets each phone to whatever the host screen uses.</p>
      <Button onclick={() => apply('')} tip="Connects through the usual free online service again">Go back to the usual service</Button>
    {/if}
    <details open={backup}>
      <summary>Use a backup server</summary>
      <p class="muted">If the usual service can't be reached, run one on a computer (<code>npx peer --port 9000</code>) and type its address here, on the host screen first. The host's QR code then sends phones to the same place.</p>
      <label class="field">
        <span>Backup server (address:port)</span>
        <input type="text" bind:value={text} placeholder="192.168.1.20:9000" autocomplete="off" autocapitalize="off" spellcheck="false" oninput={() => (problem = '')} />
      </label>
      {#if problem}<p class="problem" role="alert">{problem}</p>{/if}
      <Button variant="secondary" onclick={() => apply(text)} disabled={!text.trim()} tip="Connects through the address typed above">Use this server</Button>
    </details>
  </div>
</Popup>

<style>
  .conn, details { display: flex; flex-direction: column; gap: var(--s-3); }
  summary { min-height: 44px; display: flex; align-items: center; font-weight: 700; color: var(--accent); cursor: pointer; }
  .field { display: flex; flex-direction: column; gap: var(--s-1); font-weight: 600; color: var(--text-dim); }
  code { font-size: 0.9em; background: var(--overlay); padding: 1px 6px; border-radius: 6px; }
  .problem { color: var(--bad-ink); font-weight: 600; }
</style>
