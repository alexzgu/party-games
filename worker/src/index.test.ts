// The whole worker through its exported fetch handler: fake env, in-memory Limits, and a stubbed
// global fetch standing in for api.anthropic.com. No network, no real key or phrase.
import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from './index';
import { LIMITS } from './limits';
import { FAKE_KEY, SITE, fakeCtx, fakeEnv, fakeStream } from './testing';
import type { Env } from './env';

const W = 'https://jerkbox-wizard.test';
/** What the app sends on the magic-words route: no fallbacks, no betas. */
const APP_BODY = { model: 'claude-haiku-5-5', max_tokens: 4000, output_config: { effort: 'low' }, system: 'sys', messages: [{ role: 'user', content: 'test prompt' }], stream: true };

function call(env: Env, path: string, init: RequestInit & { ip?: string } = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has('origin')) headers.set('origin', SITE);
  headers.set('cf-connecting-ip', init.ip ?? '203.0.113.7');
  const ctx = fakeCtx();
  return { res: worker.fetch(new Request(W + path, { ...init, headers }), env, ctx), ctx };
}
const redeem = (env: Env, phrase: string, ip?: string) => call(env, '/redeem', { method: 'POST', body: JSON.stringify({ phrase }), ip }).res;
const ask = (env: Env, token: string, body: object = APP_BODY, extra: Record<string, string> = {}) =>
  call(env, '/v1/messages?beta=true', { method: 'POST', body: JSON.stringify(body), headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'anthropic-version': '2026-10-21', ...extra } });

function stubAnthropic(reply: () => Response = () => fakeStream('one\ntwo\n')) {
  const calls: { url: string; headers: Headers; body: string; redirect?: RequestRedirect }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), headers: new Headers(init.headers), body: String(init.body), redirect: init.redirect });
    return reply();
  }));
  return calls;
}
async function tokenFor(env: Env, phrase = 'Test phrase one') {
  const res = await redeem(env, phrase);
  expect(res.status).toBe(200);
  return ((await res.json()) as { token: string }).token;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('wizard server', () => {
  it('trades the words for a token, then forwards with its own key and streams the answer back', async () => {
    const env = fakeEnv();
    const token = await tokenFor(env, '  TEST phrase one! ');
    expect(token).toMatch(/^[\w-]+\.[\w-]+$/);
    const calls = stubAnthropic();
    const { res } = ask(env, token);
    const reply = await res;
    expect(reply.status).toBe(200);
    expect(reply.headers.get('access-control-allow-origin')).toBe(SITE);
    expect(reply.headers.get('content-type')).toBe('text/event-stream');
    expect(await reply.text()).toBe(await fakeStream('one\ntwo\n').text());
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.anthropic.com/v1/messages');
    expect(calls[0].headers.get('x-api-key')).toBe(FAKE_KEY);
    expect(calls[0].headers.get('authorization')).toBeNull();
    expect(calls[0].headers.get('anthropic-beta')).toBeNull();
    expect(calls[0].redirect).toBe('manual');
    expect(calls[0].headers.get('anthropic-version')).toBe('2026-10-21');
    expect(JSON.parse(calls[0].body)).toEqual(APP_BODY);
    expect(calls[0].body).not.toContain(token);
  });

  it('limits wrong guesses: one past the limit from one address gets 429 with Retry-After', async () => {
    const env = fakeEnv();
    const statuses = [];
    // One word per try, so one guess each (several words count one guess per word; see below).
    for (let i = 0; i <= LIMITS.guessesPerAddress; i++) statuses.push((await redeem(env, `wrong${i}`)).status);
    expect(statuses).toEqual([...Array(LIMITS.guessesPerAddress).fill(401), 429]);
    const limited = await redeem(env, 'test phrase one');
    expect(limited.status).toBe(429);
    expect(limited.headers.get('x-wizard-reason')).toBe('guesses');
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(LIMITS.guessAddressWindowMs / 1000 * 0.88);
    expect(limited.headers.get('access-control-expose-headers')).toContain('retry-after');
    expect((await redeem(env, 'test phrase one', '198.51.100.9')).status).toBe(200);
  });

  it("doesn't count right guesses", async () => {
    const env = fakeEnv();
    for (let i = 0; i < LIMITS.guessesPerAddress - 1; i++) await redeem(env, 'nope');
    for (let i = 0; i < 3; i++) expect((await redeem(env, 'test phrase two')).status).toBe(200);
    expect((await redeem(env, 'nope')).status).toBe(401);
    expect((await redeem(env, 'nope')).status).toBe(429);
  });

  it("treats each word as a guess: the owner's example gets in when any one word is a magic word", async () => {
    const env = fakeEnv({ PARTY_PHRASES: 'drunk' });
    expect((await redeem(env, 'I aM noT!!!?? drunk.')).status).toBe(200);
    // Right, so all five guesses (four words and the whole phrase) were given back.
    for (let i = 0; i < LIMITS.guessesPerAddress; i++) expect((await redeem(env, `nope${i}`)).status).toBe(401);
    expect((await redeem(env, 'nope')).status).toBe(429);
    // Wrong, it counts five: 55 more single words reach the limit.
    const other = fakeEnv({ PARTY_PHRASES: 'drunk' });
    expect((await redeem(other, 'I aM noT!!!?? sober.')).status).toBe(401);
    for (let i = 0; i < LIMITS.guessesPerAddress - 5; i++) expect((await redeem(other, `nope${i}`)).status).toBe(401);
    expect((await redeem(other, 'drunk')).status).toBe(429);
  });

  it('counts at most 12 guesses from one submission, and checks only as many as the address has left', async () => {
    const env = fakeEnv({ PARTY_PHRASES: 'drunk' });
    expect((await redeem(env, Array.from({ length: 20 }, (_, i) => `w${i}`).join(' '))).status).toBe(401);
    for (let i = 0; i < LIMITS.guessesPerAddress - LIMITS.guessesPerSubmission; i++) expect((await redeem(env, `nope${i}`)).status).toBe(401);
    expect((await redeem(env, 'nope')).status).toBe(429);
    // Three left: "zzz yyy drunk", "zzz" and "yyy" are checked and counted; "drunk" is not reached.
    const short = fakeEnv({ PARTY_PHRASES: 'drunk' });
    for (let i = 0; i < LIMITS.guessesPerAddress - 3; i++) await redeem(short, `nope${i}`);
    expect((await redeem(short, 'zzz yyy drunk')).status).toBe(401);
    expect((await redeem(short, 'drunk')).status).toBe(429);
    // Four left: all four are checked, the last one is right, and all four are given back.
    const enough = fakeEnv({ PARTY_PHRASES: 'drunk' });
    for (let i = 0; i < LIMITS.guessesPerAddress - 4; i++) await redeem(enough, `nope${i}`);
    expect((await redeem(enough, 'zzz yyy drunk')).status).toBe(200);
    for (let i = 0; i < 4; i++) expect((await redeem(enough, `again${i}`)).status).toBe(401);
    expect((await redeem(enough, 'drunk')).status).toBe(429);
  });

  it('counts nothing for punctuation alone', async () => {
    const env = fakeEnv();
    for (let i = 0; i <= LIMITS.guessesPerAddress; i++) expect((await redeem(env, '?!.')).status).toBe(401);
    expect((await redeem(env, 'test phrase one')).status).toBe(200);
  });

  it('counts IPv6 guesses by /64, so new addresses in the same /64 get no more', async () => {
    const env = fakeEnv();
    for (let i = 1; i <= LIMITS.guessesPerAddress; i++) expect((await redeem(env, 'nope', `2001:db8:1:2::${i.toString(16)}`)).status).toBe(401);
    expect((await redeem(env, 'test phrase one', '2001:db8:1:2:ffff:1:2:3')).status).toBe(429);
    expect((await redeem(env, 'test phrase one', '2001:db8:1:3::1')).status).toBe(200);
  });

  it("doesn't let strangers filling everyone's guesses lock out friends who say the right words", async () => {
    const env = fakeEnv();
    const flooders = LIMITS.guessesEveryone / LIMITS.guessesPerAddress;
    for (let a = 0; a < flooders; a++) {
      for (let i = 0; i < LIMITS.guessesPerAddress; i++) await redeem(env, `wrong ${i}`, `198.51.100.${a}`);
    }
    // Everyone's guesses are used up: an address that already guessed this hour is refused...
    const late = await redeem(env, 'test phrase one', '198.51.100.0');
    expect([late.status, late.headers.get('x-wizard-reason')]).toEqual([429, 'guesses']);
    // ...but a friend's phone that has not guessed gets in, and so does the next friend on its Wi-Fi.
    expect((await redeem(env, 'test phrase one', '192.0.2.10')).status).toBe(200);
    expect((await redeem(env, 'test phrase two', '192.0.2.10')).status).toBe(200);
    // A fresh address still gets only one wrong guess while everyone's are used up.
    expect((await redeem(env, 'still wrong', '203.0.113.99')).status).toBe(401);
    expect((await redeem(env, 'test phrase one', '203.0.113.99')).status).toBe(429);
  });

  it('refuses a model the app does not offer, without calling the API', async () => {
    const env = fakeEnv();
    const token = await tokenFor(env);
    const calls = stubAnthropic();
    const res = await ask(env, token, { ...APP_BODY, model: 'claude-some-other-model' }).res;
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ type: 'error', error: { type: 'invalid_request_error', message: 'That model is not available here.' } });
    expect((await ask(env, token, { ...APP_BODY, tools: [] }).res).status).toBe(400);
    expect((await ask(env, token, APP_BODY, { 'anthropic-beta': 'some-other-beta' }).res).status).toBe(400);
    expect((await ask(env, token, APP_BODY, { 'anthropic-beta': 'server-side-fallback-2026-07-01' }).res).status).toBe(400);
    expect((await ask(env, token, { ...APP_BODY, fallbacks: 'default' }).res).status).toBe(400);
    expect((await ask(env, token, { ...APP_BODY, system: 'x'.repeat(70_000) }).res).status).toBe(413);
    expect(calls).toHaveLength(0);
  });

  it('ends sessions when their phrase is removed or the key changes', async () => {
    const env = fakeEnv();
    const token = await tokenFor(env, 'test phrase one');
    stubAnthropic();
    const removed = await ask({ ...env, PARTY_PHRASES: 'test phrase two' }, token).res;
    expect(removed.status).toBe(401);
    expect(((await removed.json()) as { error: { type: string } }).error.type).toBe('authentication_error');
    expect(removed.headers.get('x-wizard-reason')).toBe('revoked');
    expect((await ask({ ...env, ANTHROPIC_API_KEY: 'sk-ant-test-a-new-fake-key-22222' }, token).res).status).toBe(401);
    // A new key makes the pass unreadable, not its words removed: the app tells the two apart.
    expect((await ask({ ...env, ANTHROPIC_API_KEY: 'sk-ant-test-a-new-fake-key-22222' }, token).res).headers.get('x-wizard-reason')).toBe('invalid');
    const junk = await ask(env, 'junk.token').res;
    expect([junk.status, junk.headers.get('x-wizard-reason')]).toEqual([401, 'invalid']);
    expect((await ask(env, token).res).status).toBe(200);
  });

  it('says when a pass has expired', async () => {
    const env = fakeEnv();
    const token = await tokenFor(env);
    stubAnthropic();
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 31 * 86_400_000);
    const res = await ask(env, token).res;
    expect([res.status, res.headers.get('x-wizard-reason')]).toEqual([401, 'expired']);
    expect(res.headers.get('access-control-expose-headers')).toContain('x-wizard-reason');
  });

  it('caps right phrases from one address per day, so passes cannot be minted without end', async () => {
    const env = fakeEnv();
    for (let i = 0; i < LIMITS.redeemsPerAddressPerDay; i++) expect((await redeem(env, 'test phrase one')).status).toBe(200);
    const over = await redeem(env, 'test phrase one');
    expect([over.status, over.headers.get('x-wizard-reason')]).toEqual([429, 'redeems']);
    expect((await redeem(env, 'test phrase one', '198.51.100.9')).status).toBe(200);
  });

  it('never follows a redirect from upstream', async () => {
    const env = fakeEnv();
    const token = await tokenFor(env);
    const calls = stubAnthropic(() => new Response(null, { status: 307, headers: { location: 'https://elsewhere.test/' } }));
    const res = await ask(env, token).res;
    expect(res.status).toBe(502);
    expect(res.headers.get('location')).toBeNull();
    expect(calls[0].redirect).toBe('manual');
  });

  it("stops a session at its daily allowance and doesn't charge refused requests", async () => {
    const env = fakeEnv();
    const token = await tokenFor(env);
    stubAnthropic(() => Response.json({ type: 'error', error: { type: 'overloaded_error', message: 'busy' } }, { status: 529 }));
    const failed = ask(env, token);
    expect((await failed.res).status).toBe(529);
    await failed.ctx.settle();
    stubAnthropic();
    for (let i = 0; i < LIMITS.requestsPerSessionPerDay; i++) expect((await ask(env, token).res).status).toBe(200);
    const over = await ask(env, token).res;
    expect(over.status).toBe(429);
    expect(over.headers.get('x-should-retry')).toBe('false');
    expect(over.headers.get('x-wizard-reason')).toBe('phone');
    expect((await ask(env, await tokenFor(env)).res).status).toBe(200);
  });

  it('keeps the reservation when the API may have run the request (connection lost, 5xx), gives back 4xx', async () => {
    const env = fakeEnv();
    const token = await tokenFor(env);
    const replies: (() => Response)[] = [
      () => { throw new TypeError('connection reset'); },
      () => Response.json({ type: 'error', error: { type: 'api_error', message: 'x' } }, { status: 500 }),
      () => Response.json({ type: 'error', error: { type: 'invalid_request_error', message: 'x' } }, { status: 400 }),
    ];
    for (const reply of replies) {
      stubAnthropic(reply);
      const r = ask(env, token);
      expect((await r.res).status).toBeGreaterThanOrEqual(400);
      await r.ctx.settle();
    }
    // Two of the three stayed counted, so this pass has two fewer left today.
    stubAnthropic();
    for (let i = 0; i < LIMITS.requestsPerSessionPerDay - 2; i++) expect((await ask(env, token).res).status).toBe(200);
    expect((await ask(env, token).res).headers.get('x-wizard-reason')).toBe('phone');
  });

  it("turns the server's own key being refused into a 502, so phones keep their pass", async () => {
    const env = fakeEnv();
    const token = await tokenFor(env);
    stubAnthropic(() => Response.json({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, { status: 401 }));
    expect((await ask(env, token).res).status).toBe(502);
  });

  it('answers an unexpected failure with a readable 500 that says nothing more', async () => {
    const env = fakeEnv();
    const token = await tokenFor(env);
    const broken = { ...env, LIMITS: { idFromName: (n: string) => n, get: () => ({ fetch: async (): Promise<Response> => { throw new Error('storage detail 12345'); } }) } };
    for (const res of [await redeem(broken, 'test phrase one'), await ask(broken, token).res]) {
      expect(res.status).toBe(500);
      expect(res.headers.get('access-control-allow-origin')).toBe(SITE);
      expect(res.headers.get('access-control-expose-headers')).toContain('x-wizard-reason');
      expect(res.headers.get('x-wizard-reason')).toBe('server');
      expect(await res.json()).toEqual({ type: 'error', error: { type: 'api_error', message: 'The wizard server hit a problem.' } });
    }
    const other = await call(broken, '/redeem', { method: 'POST', body: '{"phrase":"test phrase one"}', headers: { origin: 'https://evil.test' } }).res;
    expect(other.status).toBe(403);
  });

  it('answers preflights, refuses other sites and paths', async () => {
    const env = fakeEnv();
    const pre = await call(env, '/v1/messages', { method: 'OPTIONS', headers: { 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization,anthropic-version,anthropic-beta,anthropic-dangerous-direct-browser-access,content-type,x-stainless-os' } }).res;
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-headers')).toContain('authorization');
    expect((await call(env, '/redeem', { method: 'POST', body: '{"phrase":"test phrase one"}', headers: { origin: 'https://evil.test' } }).res).status).toBe(403);
    expect((await call(env, '/v1/models', { method: 'GET' }).res).status).toBe(404);
    expect((await call(env, '/', { method: 'GET' }).res).status).toBe(404);
    expect((await call(env, '/redeem', { method: 'GET' }).res).status).toBe(405);
  });
});
