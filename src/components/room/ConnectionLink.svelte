<script lang="ts">
  import Connection from './Connection.svelte';
  import { brokerLabel, brokerSetting } from '../../lib/room/broker';

  // A quiet link under a start, join or lobby screen. It says so when this device uses a backup
  // server, so a choice made at an earlier party is never kept without anyone noticing.
  let { onchange }: { onchange?: () => void } = $props();
  let open = $state(false);
  let backup = $state(brokerSetting());
</script>

<button class="conn" class:backup onclick={() => (open = true)} data-tip={backup ? `Using ${brokerLabel()}. Change the server, or go back to the usual service` : 'See how phones connect, or use a backup server'}>
  {backup ? 'Backup server' : 'Trouble connecting?'}
</button>
{#if open}
  <Connection onclose={() => { open = false; backup = brokerSetting(); }} onchange={() => { backup = brokerSetting(); onchange?.(); }} />
{/if}

<style>
  .conn {
    align-self: center; background: none; color: var(--text-faint); font-size: 0.9rem; min-height: 44px;
    padding: 0 var(--s-3); text-decoration: underline; text-underline-offset: 3px; overflow-wrap: anywhere;
  }
  .backup { color: var(--text-dim); font-weight: 700; }
</style>
