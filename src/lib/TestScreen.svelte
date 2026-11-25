<script lang="ts">
  // For tests only: a screen that runs `start` while it is made, so what `start` makes belongs to
  // it. Rendering it on the server makes it and then lets it go, as leaving a screen does.
  let { start }: { start: () => void } = $props();
  // svelte-ignore state_referenced_locally
  start();
</script>
