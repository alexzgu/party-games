// A simple random doodle for bots (Doodle Brawl, Sketchy): a few loops, zigzags, lines and dots
// in the palette's colours, always a valid drawing under the ink limits (lib/ink).
import { PALETTE, SIZE, WIDTHS, append, point, type Drawing, type Point, type Stroke } from './ink';

const MARGIN = 40;

type Shape = (rand: () => number) => Point[];

const at = (rand: () => number, room = SIZE - 2 * MARGIN): Point => [MARGIN + rand() * room, MARGIN + rand() * room];

/** An oval (a head, a sun, a wheel). */
const loop: Shape = (rand) => {
  const [cx, cy] = at(rand, SIZE - 4 * MARGIN).map((n) => n + MARGIN);
  const rx = 30 + rand() * 120, ry = 30 + rand() * 120;
  return Array.from({ length: 25 }, (_, i) => [cx + rx * Math.cos((i / 24) * 2 * Math.PI), cy + ry * Math.sin((i / 24) * 2 * Math.PI)]);
};

/** A zigzag (hair, grass, lightning). */
const zigzag: Shape = (rand) => {
  let [x, y] = at(rand);
  const step = 20 + rand() * 40, rise = 20 + rand() * 60;
  return Array.from({ length: 4 + Math.floor(rand() * 6) }, (_, i) => [x += step, y + (i % 2 ? rise : -rise)]);
};

/** A straight line (a limb, a stick). */
const line: Shape = (rand) => [at(rand), at(rand)];

/** A wobbly scribble. */
const scribble: Shape = (rand) => {
  let [x, y] = at(rand);
  return Array.from({ length: 8 + Math.floor(rand() * 12) }, () => [x += (rand() - 0.5) * 90, y += (rand() - 0.5) * 90]);
};

/** A dot (an eye, a button). */
const dot: Shape = (rand) => [at(rand)];

const SHAPES = [loop, loop, zigzag, line, line, scribble, dot];

/** Points to a stroke: whole units inside the canvas, neighbours at least 3 units apart. */
function stroke(points: Point[], c: number, w: number): Stroke {
  let last = point(...points[0]);
  const p = [...last];
  for (const raw of points.slice(1)) {
    const next = point(...raw);
    if (append(p, last, next)) last = next;
  }
  return { c, w, p };
}

/** 3–8 strokes of random shapes and colours. */
export function doodle(rand: () => number): Drawing {
  const count = 3 + Math.floor(rand() * 6);
  return Array.from({ length: count }, () => {
    const shape = SHAPES[Math.floor(rand() * SHAPES.length)];
    return stroke(shape(rand), Math.floor(rand() * PALETTE.length), WIDTHS[rand() < 0.7 ? 0 : 1]);
  });
}
