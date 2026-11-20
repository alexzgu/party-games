export const SIZE = 640;
export const MAX_POINTS = 6000;
export const PALETTE = ['black', 'red', 'orange', 'green', 'blue', 'purple', 'pink', 'brown'] as const;
export const WIDTHS = [5, 15] as const;
export type Stroke = { c: number; w: number; p: number[] };
export type Drawing = Stroke[];
export type Point = [number, number];

export function point(x: number, y: number): Point {
  const clamp = (n: number) => Math.round(Math.max(0, Math.min(SIZE, n)));
  return [clamp(x), clamp(y)];
}

export function append(p: number[], last: Point, next: Point): boolean {
  const dx = next[0] - last[0];
  const dy = next[1] - last[1];
  if (dx * dx + dy * dy < 9) return false;
  p.push(dx, dy);
  return true;
}

export const pointCount = (d: Drawing) => d.reduce((n, s) => n + s.p.length / 2, 0);

export function readDrawing(raw: unknown): Drawing | null {
  if (!Array.isArray(raw) || raw.length > MAX_POINTS) return null;
  const result: Drawing = [];
  let count = 0;
  for (const s of raw) {
    if (!s || !Number.isInteger(s.c) || s.c < 0 || s.c >= PALETTE.length ||
      !WIDTHS.some((w) => w === s.w) || !Array.isArray(s.p) || s.p.length < 2 || s.p.length % 2) return null;
    count += s.p.length / 2;
    if (count > MAX_POINTS) return null;
    let x = 0;
    let y = 0;
    for (let i = 0; i < s.p.length; i += 2) {
      const dx = s.p[i], dy = s.p[i + 1];
      if (!Number.isInteger(dx) || !Number.isInteger(dy) || (i > 0 && dx * dx + dy * dy < 9)) return null;
      x += dx;
      y += dy;
      if (x < 0 || x > SIZE || y < 0 || y > SIZE) return null;
    }
    result.push({ c: s.c, w: s.w, p: s.p });
  }
  return result;
}

export function paint(canvas: HTMLCanvasElement, drawing: Drawing, pixels: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx || !pixels) return;
  if (canvas.width !== pixels || canvas.height !== pixels) canvas.width = canvas.height = pixels;
  ctx.setTransform(pixels / SIZE, 0, 0, pixels / SIZE, 0, 0);
  const tokens = getComputedStyle(canvas);
  ctx.fillStyle = tokens.getPropertyValue('--ink-paper').trim() || 'white';
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.lineCap = ctx.lineJoin = 'round';
  for (const { c, w, p } of drawing) {
    let [x, y] = p;
    ctx.strokeStyle = ctx.fillStyle = tokens.getPropertyValue(`--ink-${PALETTE[c]}`).trim() || 'black';
    ctx.lineWidth = w;
    ctx.beginPath();
    if (p.length === 2) {
      ctx.arc(x, y, w / 2, 0, 2 * Math.PI);
      ctx.fill();
      continue;
    }
    ctx.moveTo(x, y);
    for (let i = 2; i < p.length; i += 2) {
      x += p[i];
      y += p[i + 1];
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}
