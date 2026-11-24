<script lang="ts">
  let { checked = $bindable(), label, hint = '', onchange }: { checked: boolean; label: string; hint?: string; onchange?: () => void } = $props();
</script>

<label class="toggle">
  <span class="text"><span class="label">{label}</span>{#if hint}<span class="hint">{hint}</span>{/if}</span>
  <input type="checkbox" role="switch" bind:checked {onchange} />
  <span class="track" aria-hidden="true"><span class="thumb"></span></span>
</label>

<style>
  /* Relative, so the hidden checkbox stays inside it: placed by a far-off ancestor, it would stretch
     a popup and scroll it out of shape when focused. */
  .toggle { position: relative; display: flex; align-items: center; gap: var(--s-3); background: var(--surface); border-radius: var(--r-md);
    padding: var(--s-3) var(--s-4); min-height: var(--tap); cursor: pointer; }
  .text { flex: 1; display: flex; flex-direction: column; }
  .label { font-weight: 600; }
  .hint { color: var(--text-faint); font-size: 0.88rem; }
  input { position: absolute; opacity: 0; pointer-events: none; }
  .track { width: 52px; height: 32px; border-radius: var(--r-pill); background: var(--bg-sunk); position: relative;
    transition: background var(--dur) ease; flex: none; border: 1.5px solid var(--line-strong); }
  .thumb { position: absolute; top: 3px; left: 3px; width: 23px; height: 23px; border-radius: 50%; background: var(--text-dim);
    transition: transform var(--dur) var(--ease-spring), background var(--dur) ease; }
  input:checked + .track { background: var(--accent); border-color: var(--accent); }
  input:checked + .track .thumb { transform: translateX(20px); background: var(--on-accent); }
  input:focus-visible + .track { outline: 3px solid var(--accent); outline-offset: 3px; }
</style>
