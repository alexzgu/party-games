<script lang="ts" module>
  let uid = 0;
</script>

<script lang="ts">
  // The tuner: a semicircle 0 (left) to 100 (right). Scoring wedges sit under a grille cover
  // that sweeps open at the reveal. The needle follows a finger dragged anywhere on the dial.
  import { bandSegments } from './scoring';
  import { haptic } from '../../lib/haptics';

  let {
    value = $bindable(50),
    target = null,
    open = false,
    interactive = false,
    showNeedle = true,
    markHit = false,
    instant = false,
    label = 'Dial',
    valuetext = '',
    onrelease,
  }: {
    value?: number;
    /** Target centre; leave null whenever the team must not see it. */
    target?: number | null;
    /** Cover swept away (bands visible). Flipping false → true animates the sweep. */
    open?: boolean;
    interactive?: boolean;
    showNeedle?: boolean;
    /** Makes the wedge under the needle glow, for the reveal. */
    markHit?: boolean;
    /** Skips the sweep and the glow: everything shows in its final state at once. */
    instant?: boolean;
    label?: string;
    valuetext?: string;
    onrelease?: (v: number) => void;
  } = $props();

  const CX = 200, CY = 200, R = 172, R0 = 34;
  const TICK_STEP = 5; // dial units between haptic ticks
  const id = `dial${uid++}`;

  const pt = (v: number, r: number): [number, number] => {
    const th = Math.PI * (1 - v / 100);
    return [CX + r * Math.cos(th), CY - r * Math.sin(th)];
  };
  const f = (n: number) => n.toFixed(2);

  function sector(a: number, b: number, r0: number, r1: number): string {
    const [x0, y0] = pt(a, r1), [x1, y1] = pt(b, r1), [x2, y2] = pt(b, r0), [x3, y3] = pt(a, r0);
    return `M${f(x0)} ${f(y0)}A${r1} ${r1} 0 0 1 ${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}A${r0} ${r0} 0 0 0 ${f(x3)} ${f(y3)}Z`;
  }

  const ticks = Array.from({ length: 41 }, (_, i) => {
    const v = i * 2.5;
    const major = v % 10 === 0;
    const [x1, y1] = pt(v, R + 6);
    const [x2, y2] = pt(v, R + (major ? 18 : 11));
    return { x1, y1, x2, y2, major };
  });

  const bands = $derived(target == null ? [] : bandSegments(target));
  const halfDisc = `M${CX - R - 2} ${CY}A${R + 2} ${R + 2} 0 0 1 ${CX + R + 2} ${CY}Z`;
  const needleDeg = $derived((value - 50) * 1.8);

  let svg: SVGSVGElement;
  let dragging = $state(false);
  let dragId: number | null = null; // the finger that owns the drag
  let jumping = $state(false);
  let lastStep = Math.round(value / TICK_STEP);

  function valueAt(e: PointerEvent): number | null {
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const dx = p.x - CX, dy = CY - p.y;
    // Near the hub the angle swings wildly with tiny moves: hold still there.
    if (Math.hypot(dx, dy) < 26) return null;
    if (dy < 0) return Math.abs(dx) < 26 ? null : dx < 0 ? 0 : 100;
    return Math.min(100, Math.max(0, 100 * (1 - Math.atan2(dy, dx) / Math.PI)));
  }

  function set(v: number) {
    value = Math.round(v * 10) / 10;
    const step = Math.round(value / TICK_STEP);
    if (step !== lastStep) { lastStep = step; haptic.light(); }
  }

  function down(e: PointerEvent) {
    if (!interactive || !e.isPrimary || dragId !== null) return;
    e.preventDefault();
    dragId = e.pointerId;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    dragging = true;
    jumping = true;
    const v = valueAt(e);
    if (v != null) set(v);
  }

  function move(e: PointerEvent) {
    if (!dragging || e.pointerId !== dragId) return;
    jumping = false;
    const v = valueAt(e);
    if (v != null) set(v);
  }

  function up(e: PointerEvent) {
    if (!dragging || e.pointerId !== dragId) return;
    dragging = false;
    dragId = null;
    jumping = false;
    onrelease?.(value);
  }

  function key(e: KeyboardEvent) {
    if (!interactive) return;
    const by: Record<string, number> = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -10, PageUp: 10 };
    let v: number | null = null;
    if (e.key in by) v = value + by[e.key];
    else if (e.key === 'Home') v = 0;
    else if (e.key === 'End') v = 100;
    if (v == null) return;
    e.preventDefault();
    jumping = true;
    set(Math.min(100, Math.max(0, v)));
    onrelease?.(value);
  }
</script>

<div
  class="dial"
  class:interactive
  class:dragging
  class:instant
  role="slider"
  tabindex={interactive ? 0 : -1}
  aria-label={label}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-valuenow={Math.round(value)}
  aria-valuetext={valuetext || undefined}
  aria-readonly={!interactive}
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={up}
  onlostpointercapture={up}
  onkeydown={key}
>
  <svg bind:this={svg} viewBox="0 0 400 222" aria-hidden="true">
    <defs>
      <radialGradient id="{id}-face" cx="50%" cy="100%" r="100%">
        <stop offset="0" stop-color="var(--surface-hi)" />
        <stop offset="1" stop-color="var(--bg-raised)" />
      </radialGradient>
      <pattern id="{id}-grille" width="11" height="11" patternUnits="userSpaceOnUse">
        <rect width="11" height="11" fill="var(--bg-sunk)" />
        <circle cx="5.5" cy="5.5" r="2.6" fill="var(--surface)" />
      </pattern>
      <clipPath id="{id}-top"><rect x="0" y="0" width="400" height={CY} /></clipPath>
    </defs>

    {#each ticks as t, i (i)}
      <line class="tick" class:major={t.major} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} />
    {/each}

    <path d={halfDisc} fill="url(#{id}-face)" />

    {#each bands as b (b.from)}
      <path class="band b{b.points}" class:hit={markHit && value >= b.from && value <= b.to} d={sector(b.from, b.to, R0, R)} />
    {/each}
    {#each bands as b (b.from)}
      {@const [x, y] = pt((b.from + b.to) / 2, R - 20)}
      {#if b.to - b.from > 2.6}
        <text class="num n{b.points}" {x} y={y + 6}>{b.points}</text>
      {/if}
    {/each}

    <g clip-path="url(#{id}-top)">
      <g class="cover" class:open>
        <path d={halfDisc} fill="url(#{id}-grille)" />
        <path d={halfDisc} class="cover-rim" />
      </g>
    </g>

    {#if showNeedle}
      <g class="needle" class:ease={jumping} style:transform="rotate({needleDeg}deg)">
        <line class="needle-shadow" x1={CX} y1={CY} x2={CX} y2={CY - R + 6} />
        <line class="needle-line" x1={CX} y1={CY} x2={CX} y2={CY - R + 6} />
        <circle class="needle-tip" cx={CX} cy={CY - R + 6} r="7" />
      </g>
    {/if}
    <circle class="hub" cx={CX} cy={CY} r="17" />
    <circle class="hub-dot" cx={CX} cy={CY} r="6" />
  </svg>
</div>

<style>
  .dial {
    --band-2: color-mix(in srgb, var(--c-dial) 42%, var(--bg-raised));
    --band-3: var(--c-dial);
    --band-4: var(--c-gold);
    --sweep: 1200ms;
    position: relative;
    /* Full width and the drawing's shape, but a short screen may take height away (down to a
       floor): the drawing then scales down inside the box, so the page never has to scroll. */
    width: 100%;
    aspect-ratio: 400 / 222;
    flex: 0 1 auto; min-height: 120px;
    container-type: size;
    display: grid; place-items: center;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    border-radius: var(--r-lg);
  }
  .interactive { cursor: grab; }
  .dragging { cursor: grabbing; }
  .dial:focus-visible { outline: 3px solid var(--accent); outline-offset: 4px; }
  svg { display: block; width: min(100cqw, 100cqh * 400 / 222); height: auto; overflow: visible; }

  .tick { stroke: var(--text-faint); stroke-width: 2; stroke-linecap: round; }
  .tick.major { stroke: var(--text-dim); stroke-width: 3; }

  .band { stroke: var(--bg-sunk); stroke-width: 1.5; }
  .b2 { fill: var(--band-2); }
  .b3 { fill: var(--band-3); }
  .b4 { fill: var(--band-4); }
  .band.hit { animation: glow 900ms ease-in-out 3; }
  @keyframes glow { 50% { filter: brightness(1.45) drop-shadow(0 0 10px var(--band-4)); } }
  .num { font-family: var(--font-display); font-weight: 800; font-size: 17px; text-anchor: middle; fill: var(--on-accent); }
  .num.n2 { fill: var(--text); }

  .cover {
    transform-box: view-box;
    transform-origin: 200px 200px;
    transition: transform var(--sweep) cubic-bezier(0.6, 0, 0.3, 1);
  }
  .cover.open { transform: rotate(180deg); }
  .cover-rim { fill: none; stroke: var(--line-strong); stroke-width: 2; }

  .needle { transform-box: view-box; transform-origin: 200px 200px; }
  .needle.ease { transition: transform var(--dur) var(--ease-out); }
  .needle-shadow { stroke: var(--bg-sunk); stroke-width: 11; stroke-linecap: round; }
  .needle-line { stroke: var(--text); stroke-width: 5; stroke-linecap: round; }
  .needle-tip { fill: var(--text); stroke: var(--bg-sunk); stroke-width: 3; }
  .hub { fill: var(--surface-hi); stroke: var(--text); stroke-width: 3; }
  .hub-dot { fill: var(--accent); }

  /* transition: none cancels a sweep already under way (a shorter duration would not). */
  .instant .cover { transition: none; }
  .instant .band.hit { animation: none; }

  @media (prefers-reduced-motion: reduce) {
    .dial { --sweep: 0ms; }
    .band.hit { animation: none; }
  }
</style>
