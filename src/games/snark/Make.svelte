<script lang="ts">
  import Screen from '../../components/Screen.svelte';
  import PasteList from '../../components/PasteList.svelte';
  import { customSnark, slugify, snarkPacks } from '../../lib/content';
  import { parsePrompts as parse } from './prompts';

  // A new pack from a pasted list, one prompt per line (numbers, bullets and quotes dropped).
  let { onsaved, onback }: { onsaved: (id: string) => void; onback: () => void } = $props();
  let name = $state('');

  function add(prompts: string[]) {
    const n = name.trim() || 'My prompts';
    const taken = new Set(snarkPacks().map((p) => p.id));
    let id = slugify(n);
    for (let k = 2; taken.has(id); k++) id = `${slugify(n)}-${k}`;
    customSnark.put({ id, name: n, blurb: `${prompts.length} prompts`, prompts });
    onsaved(id);
  }
</script>

<Screen title="Make a pack" {onback}>
  <label class="field">
    <span>Pack name</span>
    <input type="text" bind:value={name} maxlength="40" placeholder="Our friend group" autocomplete="off" />
  </label>
  <PasteList label="One prompt per line" placeholder={'The worst thing to say at brunch\nA terrible name for a group chat\nWhat Dave is really doing on his phone'} {parse} onadd={(items) => add(items)} />
</Screen>

<style>
  .field { display: flex; flex-direction: column; gap: var(--s-1); font-weight: 600; color: var(--text-dim); }
</style>
