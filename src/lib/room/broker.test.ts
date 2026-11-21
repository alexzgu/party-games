// The backup broker's address: an https page must use wss://, an http page (local dev) may use ws://.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseBroker } from './broker';

afterEach(() => vi.unstubAllGlobals());

describe('backup broker address', () => {
  it('on an https page is always secure, scheme or not', () => {
    expect(parseBroker('quick-name.trycloudflare.com:443', true)).toEqual({ host: 'quick-name.trycloudflare.com', port: 443, path: '/', secure: true });
    expect(parseBroker('192.168.1.20:9000', true)!.secure).toBe(true);
    expect(parseBroker('ws://192.168.1.20:9000/myapp', true)).toEqual({ host: '192.168.1.20', port: 9000, path: '/myapp', secure: true });
    expect(parseBroker('wss://peer.example.com:9000', true)!.secure).toBe(true);
  });
  it('on an http page keeps ws:// and is secure only for wss:// or port 443', () => {
    expect(parseBroker('localhost:9000', false)).toEqual({ host: 'localhost', port: 9000, path: '/', secure: false });
    expect(parseBroker('ws://localhost:9000', false)!.secure).toBe(false);
    expect(parseBroker('wss://localhost:9000', false)!.secure).toBe(true);
    expect(parseBroker('peer.example.com:443', false)!.secure).toBe(true);
  });
  it("reads the page's own scheme by default", () => {
    vi.stubGlobal('location', { protocol: 'https:' });
    expect(parseBroker('192.168.1.20:9000')!.secure).toBe(true);
    vi.stubGlobal('location', { protocol: 'http:' });
    expect(parseBroker('192.168.1.20:9000')!.secure).toBe(false);
  });
  it('still refuses what is not an address', () => {
    expect(parseBroker('nonsense', true)).toBeNull();
    expect(parseBroker('host:70000', true)).toBeNull();
  });
});
