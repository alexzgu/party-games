<script lang="ts">
  import type { PackName } from '../lib/packName.svelte';
  import { NAME_MAX } from '../lib/wizardAsk';

  // The pack's name on the review screen of a pack Fizzwick is making, in every game: his
  // suggestion fills it until the player types in it.
  let { name, placeholder = 'My pack' }: { name: PackName; placeholder?: string } = $props();
</script>

<label class="name">
  <span>Pack name</span>
  <input type="text" value={name.value} oninput={(e) => name.type(e.currentTarget.value)} {placeholder} maxlength={NAME_MAX} autocomplete="off" enterkeyhint="done" />
</label>

<style>
  .name { display: flex; flex-direction: column; gap: var(--s-1); font-weight: 600; color: var(--text-dim); }
  .name input { color: var(--text); }
</style>
