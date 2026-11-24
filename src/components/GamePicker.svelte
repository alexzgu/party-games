<script lang="ts">
  import Dropdown from './Dropdown.svelte';
  import type { PickOption } from '../lib/gamePicker';

  // The drop-down's pick-one face for a game (the Community page, History): the chosen game in its
  // colour; choosing another closes it.
  let { options, value, label, onpick }: {
    options: PickOption[];
    value: string;
    /** What it chooses, spoken before the choice ("Game"). */
    label: string;
    onpick: (id: string) => void;
  } = $props();

  const chosen = $derived(options.find((o) => o.id === value) ?? options[0]);
</script>

<Dropdown {options} {label} spoken={chosen?.name ?? ''} searchLabel="Search games" none="No games match." tint={chosen?.accent}
  isOn={(id) => id === value} onchoose={(id) => { if (id !== value) onpick(id); }}>
  {#snippet face()}
    <span class="emoji" aria-hidden="true">{chosen?.emoji}</span>
    <span class="name">{chosen?.name}</span>
  {/snippet}
</Dropdown>
