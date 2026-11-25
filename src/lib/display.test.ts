// Settings > Display: text size and spacing for the whole app, kept on this phone and put on <html>.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

/** A phone whose storage starts as `stored`; returns a fresh copy of the settings module. */
async function phone(stored?: unknown) {
  const mem = new Map<string, string>();
  if (stored !== undefined) mem.set('hr:settings', JSON.stringify(stored));
  vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) });
  vi.resetModules();
  return { mem, mod: await import('./settings.svelte') };
}

/** Stands in for <html>: only its data attributes matter. */
const fakeRoot = () => ({ dataset: {} as DOMStringMap });

afterEach(() => vi.unstubAllGlobals());

describe('display settings', () => {
  it('start at Normal text and Normal spacing', async () => {
    const { mod } = await phone();
    expect(mod.settings.textSize).toBe('normal');
    expect(mod.settings.spacing).toBe('normal');
  });

  it('read settings saved before they existed as Normal/Normal, keeping the rest', async () => {
    const { mod } = await phone({ sound: false, theme: 'light', packView: 'rows' });
    expect(mod.settings.textSize).toBe('normal');
    expect(mod.settings.spacing).toBe('normal');
    expect(mod.settings.sound).toBe(false);
    expect(mod.settings.theme).toBe('light');
  });

  it('survive a reload', async () => {
    const first = await phone();
    first.mod.settings.textSize = 'small';
    first.mod.settings.spacing = 'compact';
    first.mod.saveSettings();
    const again = await phone(JSON.parse(first.mem.get('hr:settings')!));
    expect(again.mod.settings.textSize).toBe('small');
    expect(again.mod.settings.spacing).toBe('compact');
  });

  it('fall back to Normal for a stored value this version does not know', async () => {
    const { mod } = await phone({ textSize: 'huge', spacing: 42 });
    expect(mod.settings.textSize).toBe('normal');
    expect(mod.settings.spacing).toBe('normal');
  });

  it('put the choices on the root element, following every change', async () => {
    const { mod } = await phone({ textSize: 'large' });
    const root = fakeRoot();
    mod.applyDisplay(root);
    expect(root.dataset).toEqual({ text: 'large', density: 'normal' });
    mod.settings.textSize = 'small';
    mod.settings.spacing = 'compact';
    mod.applyDisplay(root);
    expect(root.dataset).toEqual({ text: 'small', density: 'compact' });
    mod.settings.textSize = 'normal';
    mod.settings.spacing = 'normal';
    mod.applyDisplay(root);
    expect(root.dataset).toEqual({ text: 'normal', density: 'normal' });
  });

  it('are on the page before the first paint, the same as once the app has loaded', async () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    const early = html.match(/<script>([\s\S]*?)<\/script>/)![1];
    for (const stored of [undefined, {}, { textSize: 'small', spacing: 'compact' }, { textSize: 'large' }, { textSize: 'huge', spacing: 'tight' }]) {
      const root = { dataset: {} as DOMStringMap };
      const mem = new Map(stored === undefined ? [] : [['hr:settings', JSON.stringify(stored)]]);
      runInNewContext(early, {
        localStorage: { getItem: (k: string) => mem.get(k) ?? null },
        document: { documentElement: root, querySelector: () => ({ setAttribute() {} }) },
        matchMedia: () => ({ matches: true }),
      });
      const { mod } = await phone(stored);
      const loaded = fakeRoot();
      mod.applyDisplay(loaded);
      expect({ text: root.dataset.text, density: root.dataset.density }).toEqual(loaded.dataset);
    }
  });
});
