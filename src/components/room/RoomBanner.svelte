<script lang="ts">
  import Button from '../Button.svelte';

  // The notice on a room game's start screen when this device already has a room: its title,
  // one line under it, and one short action (Return, Rejoin) with a fuller spoken name.
  let { title, detail, action, label, tip, onclick }: { title: string; detail: string; action: string; label: string; tip?: string; onclick: () => void } = $props();
</script>

<div class="banner pop-in" role="status">
  <span><b>{title}</b><span class="muted">{detail}</span></span>
  <Button size="sm" {onclick} {label} tip={tip}>{action}</Button>
</div>

<style>
  .banner {
    display: flex; align-items: center; justify-content: space-between; gap: var(--s-3);
    padding: var(--s-4); border-radius: var(--r-lg); border: 2px solid var(--accent);
    background: color-mix(in srgb, var(--accent) 16%, var(--bg-raised));
  }
  .banner > span { display: flex; flex-direction: column; min-width: 0; overflow-wrap: anywhere; }
  .banner b { font-family: var(--font-display); font-size: 1.15rem; }
</style>
