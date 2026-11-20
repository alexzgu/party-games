import { describe, expect, it } from 'vitest';
import { corsHeaders, originAllowed, parseOrigins, preflight } from './http';

const ALLOWED = parseOrigins('https://alexzgu.github.io, http://localhost:5173/');

const ask = (origin: string, headers = 'authorization,content-type,x-stainless-os') =>
  preflight(new Request('https://w.test/v1/messages', { method: 'OPTIONS', headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': headers } }), ALLOWED);

describe('CORS', () => {
  it('allows only the listed origins', () => {
    expect(ALLOWED).toEqual(['https://alexzgu.github.io', 'http://localhost:5173']);
    expect(originAllowed('https://alexzgu.github.io', ALLOWED)).toBe(true);
    expect(originAllowed('https://alexzgu.github.io.evil.test', ALLOWED)).toBe(false);
    expect(originAllowed(null, ALLOWED)).toBe(false);
    expect(corsHeaders('https://evil.test', ALLOWED)['Access-Control-Allow-Origin']).toBeUndefined();
    expect(corsHeaders('http://localhost:5173', ALLOWED)['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
  });
  it("answers an allowed preflight with the SDK's headers, and refuses others", () => {
    const ok = ask('https://alexzgu.github.io');
    expect(ok.status).toBe(204);
    expect(ok.headers.get('access-control-allow-headers')).toBe('authorization,content-type,x-stainless-os');
    expect(ok.headers.get('access-control-allow-methods')).toBe('POST, OPTIONS');
    const bad = ask('https://evil.test');
    expect(bad.status).toBe(403);
    expect(bad.headers.get('access-control-allow-origin')).toBeNull();
    expect(ask('https://alexzgu.github.io', 'x;y').headers.get('access-control-allow-headers')).toBe('content-type');
  });
});
