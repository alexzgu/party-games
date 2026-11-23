<script lang="ts">
  import type { Snippet } from 'svelte';
  import Button from '../Button.svelte';
  import Popup from '../Popup.svelte';

  // Host lobby: Start, which asks first while any player's phone is disconnected (they are dealt
  // in like the others, so the game would wait for them). Once too few are left to start
  // (`disabled`), the question closes.
  let { players, online, disabled, size, onstart, children }: {
    /** Everyone who would be in the game. */
    players: readonly { pid: string; name: string }[];
    /** Who is connected; none given (demo screens): everyone. */
    online?: ReadonlySet<string>;
    disabled: boolean;
    size?: 'lg';
    onstart: () => void;
    children: Snippet;
  } = $props();

  const away = $derived(online ? players.filter((p) => !online.has(p.pid)) : []);
  let asking = $state(false);
  const ask = $derived(away.length > 0 && !disabled);
  $effect(() => { if (!ask) asking = false; }); // asked anew next time

  function start() {
    asking = false;
    if (!disabled) onstart();
  }
</script>

<Button {size} {disabled} onclick={() => { if (away.length) asking = true; else start(); }}>{@render children()}</Button>

{#if asking && ask}
  <Popup title="{away.length} {away.length === 1 ? 'phone is' : 'phones are'} disconnected. Start anyway?" onclose={() => (asking = false)}>
    <div class="ask">
      <p>Not connected: <b>{away.map((p) => p.name).join(', ')}</b>. They can rejoin with the same code.</p>
      <Button onclick={start}>Start anyway</Button>
      <Button variant="secondary" onclick={() => (asking = false)}>Wait for them</Button>
    </div>
  </Popup>
{/if}

<style>
  .ask { display: flex; flex-direction: column; gap: var(--s-2); text-align: left; }
  p { margin-bottom: var(--s-2); overflow-wrap: anywhere; }
</style>
