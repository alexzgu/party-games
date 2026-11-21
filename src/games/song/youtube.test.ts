// The YouTube player link without a browser: a fake document and window, and fake player
// messages. Only messages from the player's own frame on YouTube's embed origin count.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMBED_ORIGIN, PLAYING, PlayerLink, PlaylistError, SANDBOX, playerMessage, readPlaylist, revealPlayer } from './youtube';

const SITE = 'https://alexzgu.github.io';

class FakeEl {
  children: FakeEl[] = [];
  parent: FakeEl | null = null;
  style = { cssText: '' };
  listeners: Record<string, () => void> = {};
  attrs: Record<string, string> = {};
  setAttribute(name: string, value: string) { this.attrs[name] = value; }
  appendChild(c: FakeEl) { c.parent = this; this.children.push(c); return c; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this); this.parent = null; }
  addEventListener(type: string, fn: () => void) { this.listeners[type] = fn; }
}
class FakeFrame extends FakeEl {
  src = '';
  allow = '';
  allowFullscreen = false;
  contentWindow = { postMessage: vi.fn() };
  /** What was posted to the frame, parsed, with its target origin. */
  sent = () => this.contentWindow.postMessage.mock.calls.map(([m, to]) => ({ ...JSON.parse(m as string), to }));
}

function fakeDom() {
  const listeners = new Set<(e: unknown) => void>();
  const frames: FakeFrame[] = [];
  const created: string[] = [];
  const body = new FakeEl();
  vi.stubGlobal('location', { origin: SITE });
  vi.stubGlobal('window', { addEventListener: (_: string, fn: (e: unknown) => void) => listeners.add(fn), removeEventListener: (_: string, fn: (e: unknown) => void) => listeners.delete(fn) });
  vi.stubGlobal('document', {
    body,
    createElement: (tag: string) => {
      created.push(tag);
      if (tag !== 'iframe') return new FakeEl();
      const f = new FakeFrame();
      frames.push(f);
      return f;
    },
  });
  /** A message from YouTube's player in `frame` (or from somewhere else). */
  const emit = (frame: FakeFrame, data: object | string, origin = EMBED_ORIGIN, source: unknown = frame.contentWindow) =>
    [...listeners].forEach((fn) => fn({ data: typeof data === 'string' ? data : JSON.stringify(data), origin, source }));
  const loaded = (frame: FakeFrame) => frame.listeners.load();
  return { listeners, frames, created, body, emit, loaded };
}

beforeEach(() => void vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('player messages', () => {
  const frame = { postMessage() {} } as unknown as Window;
  const ok = { origin: EMBED_ORIGIN, source: frame, data: '{"event":"onReady","info":null}' };
  it('reads a JSON message from the frame on the embed origin', () => {
    expect(playerMessage(ok, frame)).toEqual({ event: 'onReady', info: null });
  });
  it('ignores any other origin, any other window and anything not a player message', () => {
    expect(playerMessage({ ...ok, origin: 'https://www.youtube.com' }, frame)).toBeNull();
    expect(playerMessage({ ...ok, origin: 'https://evil.test' }, frame)).toBeNull();
    expect(playerMessage({ ...ok, source: {} as Window }, frame)).toBeNull();
    expect(playerMessage({ ...ok, source: null }, frame)).toBeNull();
    expect(playerMessage(ok, null)).toBeNull();
    expect(playerMessage({ ...ok, data: { event: 'onReady' } }, frame)).toBeNull();
    expect(playerMessage({ ...ok, data: 'not json' }, frame)).toBeNull();
    expect(playerMessage({ ...ok, data: '{"info":1}' }, frame)).toBeNull();
    expect(playerMessage({ ...ok, data: 'null' }, frame)).toBeNull();
  });
});

describe('the player link', () => {
  function link() {
    const frame = { postMessage: vi.fn() };
    const on = { onConnect: vi.fn(), onState: vi.fn(), onError: vi.fn(), onPlaylist: vi.fn() };
    const l = new PlayerLink(() => frame as unknown as Window, on);
    const from = (data: object, origin = EMBED_ORIGIN) => l.receive({ origin, source: frame as unknown as Window, data: JSON.stringify(data) });
    const sent = () => frame.postMessage.mock.calls.map(([m, to]) => ({ ...JSON.parse(m as string), to }));
    return { l, on, from, sent };
  }
  it('says hello to YouTube only, until the player answers, then asks for state and errors', () => {
    const { l, on, from, sent } = link();
    expect(l.hello()).toBe(true);
    expect(sent()).toEqual([{ event: 'listening', id: 1, channel: 'widget', to: EMBED_ORIGIN }]);
    from({ event: 'onReady' }, 'https://evil.test');
    expect(on.onConnect).not.toHaveBeenCalled();
    expect(l.hello()).toBe(true);
    from({ event: 'initialDelivery', info: { playerState: -1 } });
    expect(on.onConnect).toHaveBeenCalledTimes(1);
    expect(sent().slice(2).map((m) => [m.event, m.func, m.args, m.to])).toEqual([
      ['command', 'addEventListener', ['onStateChange'], EMBED_ORIGIN],
      ['command', 'addEventListener', ['onError'], EMBED_ORIGIN],
    ]);
    expect(l.hello()).toBe(false);
    from({ event: 'onReady' });
    expect(on.onConnect).toHaveBeenCalledTimes(1);
  });
  it('counts as connected only once the player says it is ready', () => {
    const { l, on, from } = link();
    from({ event: 'onError', info: 150 });
    from({ event: 'infoDelivery', info: { currentTime: 1 } });
    expect(on.onConnect).not.toHaveBeenCalled();
    expect(on.onError.mock.calls).toEqual([[150]]);
    expect(l.hello()).toBe(true);
    from({ event: 'onReady' });
    expect(on.onConnect).toHaveBeenCalledTimes(1);
    expect(l.hello()).toBe(false);
  });
  it('passes on each state change once, however it is reported', () => {
    const { on, from } = link();
    from({ event: 'infoDelivery', info: { playerState: PLAYING } });
    from({ event: 'onStateChange', info: PLAYING });
    from({ event: 'infoDelivery', info: { currentTime: 3 } });
    from({ event: 'onStateChange', info: 2 });
    from({ event: 'infoDelivery', info: { playerState: PLAYING } });
    expect(on.onState.mock.calls).toEqual([[PLAYING], [2], [PLAYING]]);
  });
  it('passes on errors and playlists, keeping only video ids', () => {
    const { on, from } = link();
    from({ event: 'onError', info: 150 });
    from({ event: 'initialDelivery', info: { playlist: ['vvvvvvvvvv1', 'bad id', 7, 'vvvvvvvvvv2'] } });
    from({ event: 'infoDelivery', info: { playlist: null } });
    expect(on.onError.mock.calls).toEqual([[150]]);
    expect(on.onPlaylist.mock.calls).toEqual([[['vvvvvvvvvv1', 'vvvvvvvvvv2']]]);
  });
});

describe('reading a playlist', () => {
  it('loads the playlist in a hidden embed, takes the ids, then removes the frame', async () => {
    const dom = fakeDom();
    const got = readPlaylist('PLtest-list_1');
    const [frame] = dom.frames;
    const url = new URL(frame.src);
    expect(url.origin + url.pathname).toBe(`${EMBED_ORIGIN}/embed`);
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ listType: 'playlist', list: 'PLtest-list_1', enablejsapi: '1', origin: SITE, autoplay: '0' });
    dom.loaded(frame);
    vi.advanceTimersByTime(600);
    expect(frame.sent().map((m) => m.event)).toEqual(['listening', 'listening', 'listening']);
    dom.emit(frame, { event: 'initialDelivery', info: { playlist: ['wwwwwwwwww1'] } }, 'https://evil.test');
    dom.emit(frame, { event: 'initialDelivery', info: { playlist: ['wwwwwwwwww1'] } }, EMBED_ORIGIN, {});
    dom.emit(frame, { event: 'initialDelivery', info: { playlist: ['vvvvvvvvvv1', 'vvvvvvvvvv2'], playerState: 5 } });
    expect(await got).toEqual(['vvvvvvvvvv1', 'vvvvvvvvvv2']);
    expect(dom.body.children).toEqual([]);
    expect(dom.listeners.size).toBe(0);
    expect(dom.created).not.toContain('script');
    // Sandboxed, never allowed to move this page, and with no media permissions: it is never played.
    expect(frame.attrs.sandbox).toBe(SANDBOX);
    expect(frame.attrs.sandbox).not.toMatch(/top-navigation/);
    expect([frame.allow, frame.allowFullscreen]).toEqual(['', false]);
  });
  it('keeps at most 200 ids', async () => {
    const dom = fakeDom();
    const got = readPlaylist('PLtest');
    const ids = Array.from({ length: 250 }, (_, i) => `v${String(i).padStart(10, '0')}`);
    dom.emit(dom.frames[0], { event: 'initialDelivery', info: { playlist: ids } });
    expect(await got).toEqual(ids.slice(0, 200));
  });
  it('is a PlaylistError when the player answers with an error, or with no videos in time', async () => {
    const dom = fakeDom();
    const refused = readPlaylist('PLgone');
    dom.emit(dom.frames[0], { event: 'onReady' });
    dom.emit(dom.frames[0], { event: 'onError', info: 150 });
    await expect(refused).rejects.toBeInstanceOf(PlaylistError);
    expect(dom.body.children).toEqual([]);

    const empty = readPlaylist('PLempty');
    dom.emit(dom.frames[1], { event: 'initialDelivery', info: { playlist: null } });
    vi.advanceTimersByTime(15000);
    await expect(empty).rejects.toBeInstanceOf(PlaylistError);
    expect(dom.listeners.size).toBe(0);
  });
  it('is a plain Error (the connection) when the player never answers, even if someone else does', async () => {
    const dom = fakeDom();
    const got = readPlaylist('PLtest');
    dom.loaded(dom.frames[0]);
    dom.emit(dom.frames[0], { event: 'onReady' }, 'https://evil.test');
    vi.advanceTimersByTime(15000);
    const err = await got.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(PlaylistError);
    expect(dom.body.children).toEqual([]);
    expect(dom.listeners.size).toBe(0);
  });
});

describe('the reveal video', () => {
  it('embeds the video with its controls and reports each start', async () => {
    const dom = fakeDom();
    const host = new FakeEl();
    const onplay = vi.fn();
    const ready = revealPlayer(host as unknown as HTMLElement, 'dQw4w9WgXcQ', onplay);
    const [frame] = dom.frames;
    expect(host.children).toEqual([frame]);
    const url = new URL(frame.src);
    expect(url.origin + url.pathname).toBe(`${EMBED_ORIGIN}/embed/dQw4w9WgXcQ`);
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ enablejsapi: '1', origin: SITE, controls: '1', playsinline: '1' });
    dom.emit(frame, { event: 'onStateChange', info: PLAYING }, 'https://evil.test');
    dom.emit(frame, { event: 'initialDelivery', info: { playerState: -1 } });
    const player = await ready;
    dom.emit(frame, { event: 'onStateChange', info: PLAYING });
    dom.emit(frame, { event: 'infoDelivery', info: { playerState: PLAYING } });
    expect(onplay).toHaveBeenCalledTimes(1);
    player.destroy();
    expect(host.children).toEqual([]);
    expect(dom.listeners.size).toBe(0);
    expect(dom.created).toEqual(['iframe']);
  });
  it('is sandboxed without top navigation, with only the media permissions a video needs', () => {
    const dom = fakeDom();
    void revealPlayer(new FakeEl() as unknown as HTMLElement, 'dQw4w9WgXcQ', () => {});
    const [frame] = dom.frames;
    expect(frame.attrs.sandbox.split(' ').sort()).toEqual(['allow-popups', 'allow-popups-to-escape-sandbox', 'allow-presentation', 'allow-same-origin', 'allow-scripts']);
    expect(frame.allow).toBe('encrypted-media; picture-in-picture; fullscreen');
  });
  it('gives up on an error before ready, and calls onfail on one after, removing the frame each time', async () => {
    const dom = fakeDom();
    const host = new FakeEl();
    const early = revealPlayer(host as unknown as HTMLElement, 'dQw4w9WgXcQ', () => {});
    dom.emit(dom.frames[0], { event: 'onError', info: 150 });
    await expect(early).rejects.toThrow();
    expect(host.children).toEqual([]);

    const onfail = vi.fn();
    const later = revealPlayer(host as unknown as HTMLElement, 'dQw4w9WgXcQ', () => {}, onfail);
    dom.emit(dom.frames[1], { event: 'onReady' });
    await later;
    dom.emit(dom.frames[1], { event: 'onError', info: 101 });
    expect(onfail).toHaveBeenCalledTimes(1);
    expect(host.children).toEqual([]);
    expect(dom.listeners.size).toBe(0);
  });
  it('gives up, and removes the frame, when the player never answers', async () => {
    const dom = fakeDom();
    const host = new FakeEl();
    const ready = revealPlayer(host as unknown as HTMLElement, 'dQw4w9WgXcQ', () => {});
    vi.advanceTimersByTime(15000);
    await expect(ready).rejects.toThrow();
    expect(host.children).toEqual([]);
    expect(dom.listeners.size).toBe(0);
  });
});
