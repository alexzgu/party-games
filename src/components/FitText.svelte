<script lang="ts">
  // Grows text as large as the box allows, so short words shout and long phrases still fit.
  let { text, max = 160, min = 22, weight = 800 }: { text: string; max?: number; min?: number; weight?: number } = $props();

  let box: HTMLDivElement;
  let inner: HTMLSpanElement;
  let size = $state(160);

  // Sized so whole words fit; a word is only broken when even the smallest size cannot hold it.
  function fits(px: number): boolean {
    inner.style.fontSize = px + 'px';
    return inner.scrollWidth <= box.clientWidth && inner.scrollHeight <= box.clientHeight;
  }

  function fit() {
    if (!box || !inner) return;
    let lo = min, hi = max;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (fits(mid)) lo = mid;
      else hi = mid;
    }
    const wholeWords = fits(lo);
    inner.classList.toggle('squeeze', !wholeWords);
    size = lo;
    inner.style.fontSize = lo + 'px';
  }

  $effect(() => {
    void text;
    fit();
    // Web fonts change the metrics once they arrive.
    void document.fonts?.ready.then(fit);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  });
</script>

<div class="fit" bind:this={box}>
  <span bind:this={inner} style:font-size="{size}px" style:font-weight={weight}>{text}</span>
</div>

<style>
  .fit { width: 100%; height: 100%; display: grid; place-items: center; overflow: hidden; }
  span {
    font-family: var(--font-display); line-height: 1.02; letter-spacing: -0.025em;
    text-align: center; overflow-wrap: normal; hyphens: manual; max-width: 100%; text-wrap: balance;
  }
  span:global(.squeeze) { overflow-wrap: anywhere; hyphens: auto; }
</style>
