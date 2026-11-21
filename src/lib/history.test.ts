import { afterEach, describe, expect, it, vi } from 'vitest';
import { history, record } from './history';

describe('history', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('leaves out entries of a game no longer in the app', () => {
    const mem = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v), removeItem: (k: string) => mem.delete(k) });
    mem.set('hr:history', JSON.stringify([{ id: 'old', game: 'song', at: 1, title: 'Sam won', scores: [], packs: [] }]));
    expect(history()).toEqual([]);
    record({ game: 'quick', title: 'Maya won', scores: [], packs: [] });
    expect(history().map((e) => e.game)).toEqual(['quick']);
  });
});
