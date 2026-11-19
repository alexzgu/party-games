<script lang="ts">
  import qrcode from 'qrcode-generator';

  // A QR code drawn as one SVG path, always dark modules on a light square (some scanners
  // cannot read an inverted code): the page's light text colour in the dark scheme, white cards in the light one.
  let { text, size = 240, label }: { text: string; size?: number; label: string } = $props();

  const qr = $derived.by(() => {
    const q = qrcode(0, 'M');
    q.addData(text);
    q.make();
    const n = q.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return { n, d };
  });
</script>

<svg class="qr" role="img" aria-label={label} width={size} height={size} viewBox="-3 -3 {qr.n + 6} {qr.n + 6}" shape-rendering="crispEdges">
  <rect x="-3" y="-3" width={qr.n + 6} height={qr.n + 6} rx="2" class="bg" />
  <path d={qr.d} class="ink" />
</svg>

<style>
  .qr { display: block; max-width: 100%; height: auto; }
  .bg { fill: var(--text); }
  .ink { fill: var(--bg-sunk); }
  :global(:root[data-theme='light']) .bg { fill: var(--bg-raised); }
  :global(:root[data-theme='light']) .ink { fill: var(--text); }
</style>
