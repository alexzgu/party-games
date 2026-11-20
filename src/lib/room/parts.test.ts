import { describe, expect, it } from 'vitest';
import { Assembler, PART_AT, toWire } from './parts';

const ids = () => { let n = 0; return () => `m${n++}`; };
const bytes = (x: unknown) => new TextEncoder().encode(JSON.stringify(x)).byteLength;

describe('parts', () => {
  it('sends a small message as itself', () => {
    const msg = { t: 'view', v: { a: 1 } };
    expect(toWire(msg, ids())).toEqual([msg]);
  });

  it('splits a big message into parts each under the PeerJS limit, and puts it back', () => {
    const msg = { t: 'art', id: 'x', d: 'é"\\語'.repeat(20000) + 'z'.repeat(30000) };
    const wire = toWire(msg, ids());
    expect(wire.length).toBeGreaterThan(1);
    for (const p of wire) expect(bytes(p)).toBeLessThan(16300);
    const a = new Assembler();
    const out = [...wire].reverse().map((p) => a.take(p)); // order does not matter
    expect(out.slice(0, -1).every((x) => x === null)).toBe(true);
    expect(out.at(-1)).toEqual(msg);
  });

  it('splits at the threshold', () => {
    expect(toWire({ s: 'a'.repeat(PART_AT) }, ids()).length).toBeGreaterThan(1);
  });

  it('refuses malformed and duplicate parts, and forgets stale ones', () => {
    const wire = toWire({ s: 'q'.repeat(40000) }, ids()) as { i: number }[];
    const a = new Assembler();
    expect(a.take({ t: 'part', id: 'z', i: 5, n: 2, s: '' })).toBeNull();
    expect(a.take({ t: 'part', id: 'z', i: 0, n: 999, s: '' })).toBeNull();
    a.take(wire[0], 0);
    expect(a.take(wire[0], 0)).toBeNull();
    // 31 s later the first part is gone: the rest alone never completes.
    expect(wire.slice(1).map((p) => a.take(p, 31000)).every((x) => x === null)).toBe(true);
  });
});
