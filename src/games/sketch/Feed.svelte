<script lang="ts">
  import type { Feed } from './core';
  import { afterChange, atEnd } from './follow';
  // The turn's guesses, newest at the bottom: "Jo: lamp", or "Jo got it!" for a right one. It
  // keeps the newest in sight as guesses come in or its box changes size, unless scrolled up.
  let { feed, me }: { feed: Feed[]; me?: string } = $props();
  let list = $state<HTMLOListElement>();
  let following = true;
  /** Where this list last scrolled itself: the scroll event that follows is not the player's. */
  let moved = -1;

  function follow() {
    const top = list ? afterChange(following, list.scrollHeight) : null;
    if (!list || top === null) return;
    list.scrollTop = top;
    moved = list.scrollTop;
  }
  function scrolled() {
    if (!list || list.scrollTop === moved) return;
    moved = -1;
    following = atEnd(list.scrollTop, list.scrollHeight, list.clientHeight);
  }
  $effect(() => {
    void feed.length;
    follow();
  });
  $effect(() => {
    if (!list) return;
    const seen = new ResizeObserver(follow);
    seen.observe(list);
    return () => seen.disconnect();
  });
</script>

<ol bind:this={list} aria-label="Guesses" aria-live="polite" onscroll={scrolled}>
  {#each feed as f, i (i)}
    <li class:got={f.got} class:mine={f.pid === me}>{#if f.got}<b>{f.name}</b> got it! ✓{:else}<b>{f.name}:</b> {f.text}{/if}</li>
  {:else}
    <li class="none">No guesses yet</li>
  {/each}
</ol>

<style>
  ol { list-style: none; padding: var(--s-2); margin: 0; display: flex; flex-direction: column; gap: 2px; overflow-y: auto; min-height: 0; background: var(--surface); border-radius: var(--r-md); overflow-wrap: anywhere; }
  li { padding: 2px var(--s-1); text-align: left; }
  .got { color: var(--c-good); font-weight: 700; }
  .mine b { color: var(--accent); }
  .none { color: var(--text-faint); }
</style>
