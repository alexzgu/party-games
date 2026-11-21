import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepare, type Prepared } from './audio';
import { NetError } from './itunes';
import type { Track } from './match';
import { pendingPreview, preparePreview, prepareSong } from './previews';

vi.mock('./audio', () => ({ prepare: vi.fn(), loadClip: vi.fn() }));

const song = { apple: 1, title: 'Song', artist: 'Artist' };
const track: Track = { id: 1, title: 'Song', artist: 'Artist', album: '', artwork: '', preview: 'preview', link: '', released: '' };
const ready = { apple: 1, track, buffer: {} as AudioBuffer, start: 0, auto: true };

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

describe('Earworm preview preparation', () => {
  it.each(['offline', 'rate limited'])('keeps the upcoming song available for retry when %s', async (failure) => {
    const pending = new Map<number, Promise<Prepared | null>>();
    vi.stubGlobal('navigator', { onLine: failure !== 'offline' });
    const lookup = vi.fn().mockResolvedValue(track);
    const refresh = vi.fn().mockRejectedValue(new NetError('HTTP 429'));
    vi.mocked(prepare).mockRejectedValueOnce(new Error('preview unavailable')).mockResolvedValueOnce(ready);
    const preload = () => pendingPreview(pending, song.apple, () => preparePreview(song, lookup, refresh));
    await expect(preload()).rejects.toBeInstanceOf(NetError);
    expect(pending.size).toBe(0);
    vi.stubGlobal('navigator', { onLine: true });
    await expect(preload()).resolves.toBe(ready);
    expect(lookup.mock.calls).toEqual([[song], [song]]);
  });

  it('reports a confirmed missing preview', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    vi.mocked(prepare).mockRejectedValue(new Error('expired link'));
    await expect(preparePreview(song, async () => track, async () => null)).resolves.toBeNull();
  });

  it('shares in-flight preparation and removes both fulfilled and rejected entries', async () => {
    const pending = new Map<number, Promise<Prepared | null>>();
    const load = vi.fn().mockResolvedValueOnce(ready).mockRejectedValueOnce(new Error('offline'));
    const first = pendingPreview(pending, 1, load);
    expect(pendingPreview(pending, 1, load)).toBe(first);
    await expect(first).resolves.toBe(ready);
    expect(pending.size).toBe(0);
    await expect(pendingPreview(pending, 1, load)).rejects.toThrow('offline');
    expect(pending.size).toBe(0);
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe('Earworm clip or preview', () => {
  const clip = { youtube: 'abcdefghijk', at: 60, seconds: 12, type: 'audio/mp4', bytes: new ArrayBuffer(8) };
  const buffer = { duration: 12 } as AudioBuffer;

  it('plays a stored clip from its start, with no Apple lookup', async () => {
    const decode = vi.fn().mockResolvedValue(buffer);
    const viaApple = vi.fn();
    await expect(prepareSong(song, clip, viaApple, decode)).resolves.toEqual({ key: '1', track: null, buffer, start: 0, fromClip: true });
    expect(decode).toHaveBeenCalledWith('1', clip.bytes);
    expect(viaApple).not.toHaveBeenCalled();
  });

  it('plays Apple’s preview when the song has no clip, or its clip will not decode', async () => {
    const viaApple = vi.fn().mockResolvedValue(ready);
    const decode = vi.fn().mockRejectedValue(new DOMException('bad', 'EncodingError'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fromPreview = { key: '1', track, buffer: ready.buffer, start: 0, fromClip: false };
    await expect(prepareSong(song, undefined, viaApple, decode)).resolves.toEqual(fromPreview);
    expect(decode).not.toHaveBeenCalled();
    await expect(prepareSong(song, clip, viaApple, decode)).resolves.toEqual(fromPreview);
    expect(viaApple).toHaveBeenCalledTimes(2);
  });

  it('cannot play a clip-only song without a working clip, and never asks Apple for it', async () => {
    const only = { title: 'Unreleased', artist: 'A Friend', youtube: 'zyxwvutsrqp', clipOnly: true as const };
    const viaApple = vi.fn();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(prepareSong(only, undefined, viaApple, vi.fn())).resolves.toBeNull();
    await expect(prepareSong(only, clip, viaApple, vi.fn().mockRejectedValue(new Error('bad')))).resolves.toBeNull();
    await expect(prepareSong(only, clip, viaApple, vi.fn().mockResolvedValue(buffer))).resolves.toMatchObject({ key: 'yt:zyxwvutsrqp', fromClip: true });
    expect(viaApple).not.toHaveBeenCalled();
  });
});
