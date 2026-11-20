import { describe, expect, it } from 'vitest';
import { deriveKeys, toBase64url, utf8 } from './crypto';
import { newSession, SESSION_DAYS, signToken, tokenFrom, verifyToken } from './token';
import { FAKE_KEY } from './testing';

const NOW = Date.UTC(2026, 10, 20, 12);

describe('session tokens', async () => {
  const keys = await deriveKeys(FAKE_KEY);
  const session = newSession('pid-a', NOW);
  const token = await signToken(keys.session, session);
  const pids = new Set(['pid-a']);

  it('verifies a fresh token and lasts the set number of days', async () => {
    expect(await verifyToken(keys.session, token, NOW, pids)).toEqual({ ok: true, session });
    expect(session.exp - session.iat).toBe(SESSION_DAYS * 86400);
    expect(newSession('pid-a', NOW).sid).not.toBe(session.sid);
  });
  it('refuses an expired token', async () => {
    expect(await verifyToken(keys.session, token, NOW + (SESSION_DAYS * 86400 + 1) * 1000, pids)).toEqual({ ok: false, reason: 'expired' });
  });
  it('refuses a token whose phrase was removed', async () => {
    expect(await verifyToken(keys.session, token, NOW, new Set(['pid-b']))).toEqual({ ok: false, reason: 'revoked' });
  });
  it('refuses a tampered token or one signed under another key', async () => {
    const [, sig] = token.split('.');
    const forged = toBase64url(utf8(JSON.stringify({ ...session, exp: session.exp + 1e6 }))) + '.' + sig;
    expect(await verifyToken(keys.session, forged, NOW, pids)).toEqual({ ok: false, reason: 'signature' });
    const otherKeys = await deriveKeys('sk-ant-test-another-fake-key-11111');
    expect(await verifyToken(otherKeys.session, token, NOW, pids)).toEqual({ ok: false, reason: 'signature' });
  });
  it('refuses junk', async () => {
    for (const junk of ['', 'abc', 'a.b.c', 'a.b', '.' , 'x'.repeat(600) + '.y', 'sk-ant-test-not-a-token']) {
      expect((await verifyToken(keys.session, junk, NOW, pids)).ok).toBe(false);
    }
  });
  it('reads the token from Authorization: Bearer (the SDK) or x-api-key', () => {
    expect(tokenFrom(new Headers({ authorization: 'Bearer tok.en' }))).toBe('tok.en');
    expect(tokenFrom(new Headers({ 'x-api-key': 'tok.en' }))).toBe('tok.en');
    expect(tokenFrom(new Headers())).toBe('');
  });
});
