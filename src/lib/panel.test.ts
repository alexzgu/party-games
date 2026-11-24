import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { edges, openAtStart, panelOpen, savePanelOpen, SHORT_SCREEN_PX } from './panel';

describe('openAtStart', () => {
  it('keeps the phone’s own choice on any screen', () => {
    expect(openAtStart(false, 900)).toBe(false);
    expect(openAtStart(true, 390)).toBe(true);
  });
  it('without one, shows the panel on a tall screen and hides it on a short one', () => {
    expect(openAtStart(null, SHORT_SCREEN_PX)).toBe(true);
    expect(openAtStart(null, SHORT_SCREEN_PX - 1)).toBe(false);
    expect(openAtStart('yes', 390)).toBe(false); // a stale shape counts as no choice
  });
  it('shows it whatever was chosen while the game needs changes there to start', () => {
    expect(openAtStart(false, 900, true)).toBe(true);
    expect(openAtStart(null, 390, true)).toBe(true);
  });
});

describe('edges', () => {
  it('says which way there is more to scroll', () => {
    expect(edges(0, 300, 100)).toEqual({ above: false, below: true });
    expect(edges(100, 300, 100)).toEqual({ above: true, below: true });
    expect(edges(200, 300, 100)).toEqual({ above: true, below: false });
  });
  it('ignores a pixel of rounding and content that fits', () => {
    expect(edges(0.5, 100, 100)).toEqual({ above: false, below: false });
    expect(edges(199.5, 300, 100)).toEqual({ above: true, below: false });
    expect(edges(0, 80, 100)).toEqual({ above: false, below: false });
  });
});

describe('panelOpen', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) });
    vi.stubGlobal('innerHeight', 844);
  });
  afterEach(() => vi.unstubAllGlobals());
  it('keeps the setups’ choice apart from the pack editors’ and Community’s', () => {
    savePanelOpen(false, 'editor');
    expect(panelOpen(false, 'editor')).toBe(false);
    expect(panelOpen(false)).toBe(true);
    savePanelOpen(false);
    savePanelOpen(true, 'editor');
    expect(panelOpen(false, 'setup')).toBe(false);
    expect(panelOpen(false, 'editor')).toBe(true);
    expect(panelOpen(false, 'community')).toBe(true);
    savePanelOpen(false, 'community');
    expect(panelOpen(false, 'community')).toBe(false);
    expect(panelOpen(false, 'editor')).toBe(true);
  });
});
