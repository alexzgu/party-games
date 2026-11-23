import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { customHand, type HandPack } from './content';
import { exportFile, importPacks, NO_ROOM, putSplit, tooLong } from './packfile';
import { shareProblem } from './library';

beforeEach(() => {
  const mem = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v), removeItem: (k: string) => mem.delete(k) });
});
afterEach(() => vi.unstubAllGlobals());

const nums = (n: number, what: string) => Array.from({ length: n }, (_, i) => `${what} ${i}`);
const pack = (answers: number, prompts = 60, id = 'mine', name = 'Mine'): HandPack =>
  ({ id, name, blurb: '', prompts: nums(prompts, 'Why is ___ number').map((p) => `${p}?`), answers: nums(answers, 'Answer') });

describe('a pack too long for one', () => {
  it('is saved as packs that can each be shared, nothing lost or repeated', () => {
    const saved = putSplit('hand', { ...pack(501), shared: true });
    expect(customHand.all().map((p) => [p.name, p.prompts.length, p.answers.length, p.shared])).toEqual([['Mine', 30, 251, true], ['Mine (2)', 30, 250, true]]);
    // The first keeps its id; the other gets one nothing ever had, so sharing it replaces nothing.
    expect(saved[0].id).toBe('mine');
    expect(saved[1].id).toMatch(/^mine-[a-z0-9]{12,}$/);
    expect(customHand.all().flatMap((p) => p.answers)).toEqual(pack(501).answers);
    expect(saved.map((p) => [shareProblem('hand', p), tooLong('hand', p)])).toEqual([[null, false], [null, false]]);
  });

  it('keeps 400 in one pack, and an odd prompt in the first', () => {
    expect(putSplit('hand', pack(400)).length).toBe(1);
    expect(putSplit('hand', pack(401, 1, 'one', 'One')).map((p) => p.prompts.length)).toEqual([1, 0]);
  });

  it('is left as saved until its Split button is tapped', () => {
    customHand.put(pack(401, 60, 'old', 'Old'));
    expect(customHand.all().map((p) => p.answers.length)).toEqual([401]);
    expect(putSplit('hand', customHand.all()[0]).map((p) => p.name)).toEqual(['Old', 'Old (2)']);
  });

  it('is saved whole or not at all when the device has no room', () => {
    customHand.put(pack(500));
    vi.stubGlobal('localStorage', { getItem: localStorage.getItem, setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: () => {} });
    expect(putSplit('hand', customHand.all()[0])).toEqual([]);
    expect(importPacks('hand', exportFile('hand', [pack(5, 5, 'x', 'X')]))).toEqual({ error: NO_ROOM });
    expect(customHand.all().map((p) => [p.id, p.answers.length])).toEqual([['mine', 500]]);
  });

  it('is split by an import without touching the other packs in the file', () => {
    const r = importPacks('hand', exportFile('hand', [pack(10, 5, 'mine-2', 'Mine (2)'), pack(900)]));
    expect('saved' in r && r.saved.map((p) => p.name)).toEqual(['Mine (2)', 'Mine', 'Mine (3)', 'Mine (4)']);
    expect(customHand.all().map((p) => [p.name, p.answers.length])).toEqual([['Mine (2)', 10], ['Mine', 300], ['Mine (3)', 300], ['Mine (4)', 300]]);
  });
});
