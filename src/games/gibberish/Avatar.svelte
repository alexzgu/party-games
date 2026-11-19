<script lang="ts">
  import { initial, playerColor } from './ui';
  let { name, index, size = 40 }: { name: string; index: number; size?: number } = $props();
</script>

<span class="avatar" aria-hidden="true" style:--c={playerColor(index)} style:--size="{size}px">{initial(name)}</span>

<style>
  .avatar {
    flex: none; width: var(--size); height: var(--size); border-radius: 50%;
    display: grid; place-items: center;
    background: color-mix(in srgb, var(--c) 22%, var(--bg-raised));
    border: 2px solid var(--c); color: var(--c);
    font-family: var(--font-display); font-weight: 800; font-size: calc(var(--size) * 0.46); line-height: 1;
  }
</style>
