import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadGame, loadSettings } from './store';
import { newGame } from './logic';

function stored(values: Record<string, unknown>) {
  const map = new Map(Object.entries(values).map(([k, v]) => [`hr:${k}`, JSON.stringify(v)]));
  vi.stubGlobal('localStorage', { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => map.set(k, v) });
}

describe('Word Salad saves', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('gives settings and rooms saved before the presenter wait was a choice one minute', () => {
    stored({ 'salad:settings': ['classic', 'films'] });
    expect(loadSettings()).toEqual({ packIds: ['classic', 'films'], awayMs: 60_000 });
    const { awayMs: _, ...room } = newGame('BCDF');
    stored({ 'salad:host': room, 'salad:settings': { packIds: ['films'], awayMs: 120_000 } });
    expect(loadGame()?.awayMs).toBe(60_000);
    expect(loadSettings()).toEqual({ packIds: ['films'], awayMs: 120_000 });
  });
});
