import { describe, expect, it } from 'vitest';
import { ERASER, type Drawing } from '../../lib/ink';
import { apply, diff } from './live';
import { readToHost } from './protocol';

const a: Drawing = [{ c: 0, w: 5, p: [10, 10, 5, 0] }];

describe('Draw & guess live ink', () => {
  it('sends only what a stroke or new strokes add, and rebuilds the drawing from it', () => {
    const grown: Drawing = [{ c: 0, w: 5, p: [10, 10, 5, 0, 0, 5] }, { c: ERASER, w: 15, p: [50, 50] }];
    const delta = diff(a, grown)!;
    expect(delta).toEqual({ i: 0, o: 4, d: [{ c: 0, w: 5, p: [0, 5] }, { c: ERASER, w: 15, p: [50, 50] }] });
    expect(apply(a, delta)).toEqual(grown);
    expect(diff([], a)).toEqual({ i: 0, o: 0, d: a });
    expect(apply([], { i: 0, o: 0, d: a })).toEqual(a);
  });

  it('asks for the whole drawing after undo or clear, and refuses a delta made from another drawing', () => {
    expect(diff(a, [])).toBeNull();
    expect(diff(a, [{ c: 1, w: 5, p: [10, 10, 5, 0] }])).toBeNull();
    expect(apply([], { i: 0, o: 4, d: [{ c: 0, w: 5, p: [0, 5] }] })).toBeNull();
    expect(apply(a, { i: 0, o: 2, d: [{ c: 0, w: 5, p: [0, 5] }] })).toBeNull();
  });

  it('reads live ink, whole drawings with the eraser, and empty Telephone drawings', () => {
    expect(readToHost({ t: 'ink', at: 3, n: 2, i: 0, o: 4, d: [{ c: 0, w: 5, p: [0, 5] }] })).toMatchObject({ n: 2, o: 4 });
    expect(readToHost({ t: 'ink', at: 3, n: 1, all: [{ c: ERASER, w: 15, p: [1, 1] }] })).toMatchObject({ n: 1 });
    expect(readToHost({ t: 'ink', at: 3, n: 1, all: [{ c: ERASER + 1, w: 15, p: [1, 1] }] })).toBeNull();
    expect(readToHost({ t: 'ink', at: 3, n: 1, all: [{ c: ERASER, w: 5, p: [1, 1] }] })).toBeNull();
    expect(readToHost({ t: 'ink', at: 3, n: 0, i: 0, o: 0, d: [] })).toBeNull();
    expect(readToHost({ t: 'draw', at: 3, d: [] })).toEqual({ t: 'draw', at: 3, d: [] });
    expect(readToHost({ t: 'line', at: 3, text: 'x'.repeat(81) })).toBeNull();
    expect(readToHost({ t: 'pick', at: 3, i: 3 })).toBeNull();
  });
});
