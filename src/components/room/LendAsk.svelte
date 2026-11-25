<script lang="ts">
  import Button from '../Button.svelte';
  import Popup from '../Popup.svelte';
  import { nameList, question, type Ask } from '../../lib/lend';

  // After Start (a host lobby, or a one-phone setup): the picked packs are too small for this game,
  // so it asks before other packs lend to it (src/lib/lend.ts). Yes starts the game with them;
  // Change packs goes to where the packs are picked (`packsTip` says where); closing does neither.
  let { ask, onyes, onpacks, onclose, packsTip = "Opens the room's settings: pick more packs or add to your own" }:
    { ask: Ask; onyes: () => void; onpacks: () => void; onclose: () => void; packsTip?: string } = $props();
</script>

<Popup title="Not enough {ask.noun}" {onclose}>
  <div class="ask">
    <p>{ask.short} {question(ask)}</p>
    <Button onclick={onyes} tip="Starts now with {ask.noun} from {nameList(ask.lenders)} added to this game">Add & start</Button>
    <Button variant="secondary" onclick={onpacks} tip={packsTip}>Change packs</Button>
  </div>
</Popup>

<style>
  .ask { display: flex; flex-direction: column; gap: var(--s-2); text-align: left; }
  p { margin-bottom: var(--s-2); overflow-wrap: anywhere; }
</style>
