import { describe, expect, it } from 'vitest';
import { Assembler, toWire } from '../../lib/room/parts';
import { append, point, readDrawing, type Drawing } from './ink';
import { readToHost } from './protocol';

describe('Doodle Brawl ink and wire format', () => {
  it('rounds and clips coordinates, then encodes only points far enough apart', () => {
    const start = point(-8.4, 638.6);
    const p = [...start];
    expect(start).toEqual([0, 639]);
    expect(append(p, start, [2, 640])).toBe(false);
    expect(append(p, start, [3, 637])).toBe(true);
    expect(p).toEqual([0, 639, 3, -2]);
    expect(readDrawing([{ c: 0, w: 5, p }])).toEqual([{ c: 0, w: 5, p }]);
  });

  it('rejects invalid ink, oversized JSON and excessive points', () => {
    const dot = { c: 0, w: 5, p: [640, 0] };
    expect(readDrawing([{ ...dot, p: [...dot.p, 3, 0] }])).toBeNull();
    expect(readDrawing([{ ...dot, p: [0.5, 0] }])).toBeNull();
    expect(readDrawing([{ ...dot, c: 8 }])).toBeNull();
    expect(readDrawing(Array.from({ length: 6001 }, () => dot))).toBeNull();
    expect(readToHost({ t: 'draw', at: 1, name: '', d: [{ ...dot, extra: 'é'.repeat(100000) }] })).toBeNull();
  });

  it('reassembles a dense 3,000-point submission and art reply through the shared link', () => {
    const p = [0, 0];
    for (let i = 1; i < 3000; i++) p.push(i % 2 ? 319 : -319, i % 2 ? 300 : -300);
    const d: Drawing = [{ c: 4, w: 15, p }];
    const draw = { t: 'draw', at: 4, name: 'Scribble', d };
    for (const message of [draw, { t: 'art', id: 'room/4/0', d }]) {
      const parts = toWire(message, () => 'dense');
      expect(parts.length).toBeGreaterThan(1);
      const receiver = new Assembler();
      for (const part of parts.slice(0, -1)) {
        expect(new TextEncoder().encode(JSON.stringify(part)).length).toBeLessThan(16300);
        expect(receiver.take(part)).toBeNull();
      }
      expect(receiver.take(parts.at(-1))).toEqual(message);
    }
    expect(readToHost(draw)).toEqual(draw);
  });
});
