import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { history } from '../../lib/history';
import { logRound, relogRound } from './log';
import { newRound, toggle, type Round } from './round';

describe('round history', () => {
  beforeEach(() => {
    const mem = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v), removeItem: (k: string) => mem.delete(k) });
  });
  afterEach(() => vi.unstubAllGlobals());

  const played: Round = { ...newRound(['movies'], 60, true), phase: 'results', shown: [{ word: 'Titanic', ok: true }, { word: 'Jaws', ok: false }] };

  it('logs one entry per round and rewrites it when a mark is fixed', () => {
    const id = logRound(played)!;
    expect(history()).toMatchObject([{ id, game: 'forehead', title: '1 got · 1 passed', scores: [{ name: 'Got it', score: 1 }], packs: ['Movies'], details: ['✓ Titanic', '✗ Jaws'] }]);
    relogRound(id, { ...played, shown: toggle(played.shown, 1) });
    expect(history()).toMatchObject([{ id, title: '2 got · 0 passed', scores: [{ score: 2 }], details: ['✓ Titanic', '✓ Jaws'] }]);
  });

  it('skips a round with no words', () => {
    expect(logRound({ ...played, shown: [] })).toBeUndefined();
    expect(history()).toEqual([]);
  });
});
