// Settings > Display: text size and spacing for the whole app, kept on this phone and put on <html>;
// screens the room reads from across it keep Normal text.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { FAR_READ, farRead } from './farRead';

/** A phone whose storage starts as `stored` (`raw`: exactly this text); returns a fresh copy of the settings module. */
async function phone(stored?: unknown, raw?: string) {
  const mem = new Map<string, string>();
  if (raw !== undefined) mem.set('hr:settings', raw);
  else if (stored !== undefined) mem.set('hr:settings', JSON.stringify(stored));
  vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) });
  vi.resetModules();
  return { mem, mod: await import('./settings.svelte') };
}

/** Stands in for <html>: only its data attributes matter. */
const fakeRoot = () => ({ dataset: {} as DOMStringMap });

const INDEX = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const EARLY = INDEX.match(/<script>([\s\S]*?)<\/script>/)![1];

/** What index.html's first-paint script puts on <html> for this stored text and address. */
function firstPaint(raw: string | null, hash: string) {
  const root = fakeRoot();
  runInNewContext(EARLY, {
    localStorage: { getItem: () => raw },
    location: { hash },
    document: { documentElement: root, querySelector: () => ({ setAttribute() {} }) },
    matchMedia: () => ({ matches: true }),
  });
  return { text: root.dataset.text, density: root.dataset.density };
}

/** Every own-phones game's host screen, from the games themselves: a game whose router has a 'host' screen. */
const GAMES_DIR = new URL('../games/', import.meta.url);
const HOST_ROUTES = readdirSync(GAMES_DIR)
  .filter((id) => existsSync(new URL(`${id}/Game.svelte`, GAMES_DIR)))
  .filter((id) => /sub === 'host'/.test(readFileSync(new URL(`${id}/Game.svelte`, GAMES_DIR), 'utf8')))
  .map((id) => `/${id}/host`);
const FAR_ROUTES = [...HOST_ROUTES, '/quiz/play', '/forehead/play'];
const NEAR_ROUTES = ['/', '/games', '/settings', '/history', '/snark', '/snark/join', '/snark/settings', '/quiz', '/quiz/make', '/forehead', '/forehead/make', '/rather', '/community/forehead'];

/** Custom properties declared in the first rule of tokens.css that matches `selector`. */
function tokens(selector: string): Record<string, string> {
  const css = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');
  const at = css.indexOf(`${selector} {`);
  const body = css.slice(at, css.indexOf('\n}', at));
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

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
    mod.applyDisplay('/settings', root);
    expect(root.dataset).toEqual({ text: 'large', density: 'normal' });
    mod.settings.textSize = 'small';
    mod.settings.spacing = 'compact';
    mod.applyDisplay('/settings', root);
    expect(root.dataset).toEqual({ text: 'small', density: 'compact' });
    mod.settings.textSize = 'normal';
    mod.settings.spacing = 'normal';
    mod.applyDisplay('/settings', root);
    expect(root.dataset).toEqual({ text: 'normal', density: 'normal' });
  });

  it('keep Normal text on every screen read from across the room, and give the setting back on leaving', async () => {
    expect(HOST_ROUTES.length).toBeGreaterThanOrEqual(8);
    for (const size of ['small', 'large'] as const) {
      const { mod } = await phone({ textSize: size, spacing: 'compact' });
      const root = fakeRoot();
      for (const path of FAR_ROUTES) {
        mod.applyDisplay(path, root);
        expect(root.dataset, path).toEqual({ text: 'normal', density: 'compact' });
        mod.applyDisplay(path.replace(/\/(host|play)$/, ''), root);
        expect(root.dataset, `leaving ${path}`).toEqual({ text: size, density: 'compact' });
      }
      for (const path of NEAR_ROUTES) {
        mod.applyDisplay(path, root);
        expect(root.dataset.text, path).toBe(size);
      }
    }
  });

  it('cover the host screen of every game that has one', () => {
    for (const path of HOST_ROUTES) {
      expect(farRead(path), path).toBe(true);
      expect(farRead(`${path}/anything`), path).toBe(true);
    }
    for (const path of NEAR_ROUTES) expect(farRead(path), path).toBe(false);
  });

  it('are on the page before the first paint, the same as once the app has loaded', async () => {
    expect(EARLY).toContain(`/${FAR_READ.source}/`);
    const stored = [undefined, {}, { textSize: 'small', spacing: 'compact' }, { textSize: 'large' }, { textSize: 'huge', spacing: 'tight' }];
    const raws = ['{not json', '"small"', '42', 'null', '[1,2]', 'true', '{"textSize":"small","spacing":"compact"}'];
    const cases = [...stored.map((s) => ({ stored: s, raw: s === undefined ? null : JSON.stringify(s) })), ...raws.map((raw) => ({ stored: undefined, raw }))];
    for (const { stored: s, raw } of cases) {
      const { mod } = await phone(s, raw ?? undefined);
      for (const path of [...FAR_ROUTES, ...NEAR_ROUTES]) {
        const loaded = fakeRoot();
        mod.applyDisplay(path, loaded);
        expect(firstPaint(raw, `#${path}?demo=x`), `${raw} ${path}`).toEqual(loaded.dataset);
      }
    }
  });
});

describe('display tokens', () => {
  it('are, at Normal, the very values they replaced', () => {
    const t = tokens(':root');
    expect(t['--text-scale']).toBe('1');
    expect(t['--text-root']).toBe('calc(17px * var(--text-scale))');
    expect(t['--leading']).toBe('1.45');
    expect([t['--tap-sm'], t['--tap-md'], t['--tap'], t['--tap-lg'], t['--tap-xl'], t['--tap-xxl']]).toEqual(['48px', '52px', '56px', '64px', '68px', '72px']);
    expect([1, 2, 3, 4, 5, 6, 7].map((i) => t[`--s-${i}`])).toEqual(['4px', '8px', '12px', '16px', '24px', '32px', '48px']);
    expect(t['--tap-min']).toBe('44px');
    expect(t['--chrome-scale']).toBe('max(1, var(--text-scale))');
  });

  it('never put a row or control under the smallest tap size in Compact', () => {
    const min = parseFloat(tokens(':root')['--tap-min']);
    const compact = tokens(":root[data-density='compact']");
    const taps = Object.entries(compact).filter(([k]) => k.startsWith('--tap'));
    expect(taps.map(([k]) => k).sort()).toEqual(['--tap', '--tap-lg', '--tap-md', '--tap-sm', '--tap-xl', '--tap-xxl']);
    for (const [k, v] of taps) expect(parseFloat(v), k).toBeGreaterThanOrEqual(min);
  });
});
