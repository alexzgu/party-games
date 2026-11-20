<script lang="ts">
  import { initial, playerColor } from '../../lib/room/look';
  let { name, color, size = 40, dim = false }: { name: string; color: number; size?: number; dim?: boolean } = $props();
</script>

<span class="avatar" class:dim aria-hidden="true" style:--c={playerColor(color)} style:--size="{size}px">{initial(name)}</span>

<style>
  .avatar {
    flex: none; width: var(--size); height: var(--size); border-radius: 50%;
    display: grid; place-items: center;
    background: color-mix(in srgb, var(--c) 22%, var(--bg-raised));
    border: 2px solid var(--c); color: var(--c);
    font-family: var(--font-display); font-weight: 800; font-size: calc(var(--size) * 0.46); line-height: 1;
    transition: opacity var(--dur) ease;
  }
  .dim { opacity: 0.4; border-style: dashed; }
</style>
