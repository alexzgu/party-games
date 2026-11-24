import { afterEach, describe, expect, it, vi } from 'vitest';

const sw = vi.hoisted(() => ({ needReload: () => {} }));
vi.mock('virtual:pwa-register', () => ({ registerSW: (o: { onNeedReload: () => void }) => { sw.needReload = o.onNeedReload; } }));
const route = vi.hoisted(() => ({ path: '/games' }));
vi.mock('./router.svelte', () => ({ route }));

describe('updates', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('switch in on the main menu and the Games page only', async () => {
    const { onMenu } = await import('./update');
    expect(onMenu('/')).toBe(true);
    expect(onMenu('/games')).toBe(true);
    expect(onMenu('/forehead')).toBe(false);
  });
  it('wait while something holds them and switch in once it lets go', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { reload });
    vi.stubGlobal('addEventListener', () => {});
    const { holdUpdates, startUpdates } = await import('./update');
    startUpdates();
    const release = holdUpdates();
    sw.needReload();
    expect(reload).not.toHaveBeenCalled();
    release();
    release(); // a second release changes nothing
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
