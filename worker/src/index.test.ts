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
    for (let i = 0; i <= LIMITS.guessesPerAddress; i++) statuses.push((await redeem(env, `wrong guess ${i}`)).status);
    expect(statuses).toEqual([...Array(LIMITS.guessesPerAddress).fill(401), 429]);
    const limited = await redeem(env, 'test phrase one');
    expect(limited.status).toBe(429);
    expect(limited.headers.get('x-wizard-reason')).toBe('guesses');
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(800);
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

  it("turns the server's own key being refused into a 502, so phones keep their pass", async () => {
    const env = fakeEnv();
    const token = await tokenFor(env);
    stubAnthropic(() => Response.json({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, { status: 401 }));
    expect((await ask(env, token).res).status).toBe(502);
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
