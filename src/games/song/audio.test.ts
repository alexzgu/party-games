import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadPreview } from './audio';
import { NetError } from './itunes';

afterEach(() => vi.unstubAllGlobals());

describe('Earworm preview download', () => {
  it('reports no answer as a connection problem, and a refused file as the file’s', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(loadPreview('https://example.test/a.m4a')).rejects.toBeInstanceOf(NetError);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })));
    const refused = loadPreview('https://example.test/b.m4a');
    await expect(refused).rejects.toThrow('HTTP 404');
    await expect(refused).rejects.not.toBeInstanceOf(NetError);
  });
});
