// The magic-words route end to end without the network: the real SDK in claude.ts talks to the
// real worker (worker/src/index.ts) through a stubbed fetch, and the worker's own call to the
// API gets a fake streamed answer. Fake key and phrases only.
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import worker from '../../worker/src/index';
import { fakeCtx, fakeEnv, fakeStream, FAKE_KEY } from '../../worker/src/testing';
import { LIMITS } from '../../worker/src/limits';
import type { Env } from '../../worker/src/env';
import { settings } from './settings.svelte';
import { hasKey, statusMessage, streamLines } from './claude';
import { redeemMessage, redeemPhrase, waitWords } from './wizardServer';

const SERVER = 'https://wizard.test';
vi.mock('./wizardServer', async (actual) => ({ ...(await actual<typeof import('./wizardServer')>()), WIZARD_SERVER: 'https://wizard.test' }));

/**
 * Sends phone requests for SERVER to the worker (or to `reply` when given), and API calls (the
 * worker's, or the phone's own with a key) to a fake answer. `beforeReply` runs while a phone
 * request is out.
 */
function wire(env: Env, opts: { reply?: () => Response; beforeReply?: () => void } = {}) {
  const upstream: { headers: Headers; body: Record<string, unknown> }[] = [];
  const phone: { headers: Headers; body: string }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (u.startsWith('https://api.anthropic.com/')) {
      upstream.push({ headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
      return fakeStream('Test item one\nTest item two\n');
    }
    if (!u.startsWith(SERVER)) throw new Error('unexpected fetch ' + u);
    phone.push({ headers: new Headers(init?.headers), body: String(init?.body) });
    opts.beforeReply?.();
    return opts.reply ? opts.reply() : worker.fetch(new Request(u, init), env, fakeCtx());
  }));
  return { upstream, phone };
}

async function passFor(phrase = 'test phrase one') {
  const r = await redeemPhrase(phrase, SERVER);
  settings.wizardPass = r.ok ? r.token : '';
  return settings.wizardPass;
}

const lines = async () => {
  const out: string[] = [];
  await streamLines({ system: 'sys', prompt: 'test prompt', maxTokens: 9000, onLine: (l) => out.push(l) });
  return out;
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  settings.apiKey = '';
  settings.wizardPass = '';
});

describe('the magic words, phone to server to API', () => {
  it('redeems the words, then makes items through the server with the server key', async () => {
    const env = fakeEnv();
    const { upstream, phone } = wire(env);
    expect(hasKey()).toBe(false);
    const r = await redeemPhrase('Test Phrase One', SERVER);
    expect(r.ok).toBe(true);
    settings.wizardPass = r.ok ? r.token : '';
    expect(hasKey()).toBe(true);
    expect(await lines()).toEqual(['Test item one', 'Test item two']);
    expect(phone.at(-1)!.headers.get('authorization')).toBe(`Bearer ${settings.wizardPass}`);
    expect(upstream[0].headers.get('x-api-key')).toBe(FAKE_KEY);
  });

  it('sends no fallback and no beta through the server, so one request is one model run', async () => {
    const { phone, upstream } = wire(fakeEnv());
    await passFor();
    await lines();
    const sent = JSON.parse(phone.at(-1)!.body);
    expect(sent.fallbacks).toBeUndefined();
    expect(sent.max_tokens).toBe(8000);
    expect(phone.at(-1)!.headers.get('anthropic-beta')).toBeNull();
    expect(upstream[0].body.fallbacks).toBeUndefined();
  });

  it('says so when the words are wrong or guessed too often', async () => {
    wire(fakeEnv());
    const wrong = await redeemPhrase('not the words', SERVER);
    expect(wrong).toEqual({ ok: false, reason: 'wrong' });
    for (let i = 1; i < LIMITS.guessesPerAddress; i++) await redeemPhrase('not the words', SERVER);
    const limited = await redeemPhrase('not the words', SERVER);
    expect(limited.ok === false && limited.reason).toBe('limited');
    expect(redeemMessage(limited)).toMatch(/^Too many guesses\. Fizzwick will listen again in about 1[45] minutes\.$/);
  });

  it('says when the words were said too often from one address today', async () => {
    // The wait runs to the next UTC midnight: pin the clock so the wording is known.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-20T12:00:00Z'));
    onTestFinished(() => { vi.useRealTimers(); });
    wire(fakeEnv());
    for (let i = 0; i < LIMITS.redeemsPerAddressPerDay; i++) await redeemPhrase('test phrase one', SERVER);
    const r = await redeemPhrase('test phrase one', SERVER);
    expect(r.ok === false && r.reason).toBe('too-often');
    expect(redeemMessage(r)).toMatch(/^Fizzwick has heard the magic words from here too often today\. Try again in about 12 hours\.$/);
  });

  it('forgets the pass and asks for the new words once the phrase is removed', async () => {
    const env = fakeEnv();
    wire(env);
    await passFor();
    env.PARTY_PHRASES = 'test phrase two';
    await expect(lines()).rejects.toThrow('The magic words have changed. Ask the host for the new ones.');
    expect(settings.wizardPass).toBe('');
    expect(hasKey()).toBe(false);
  });

  it('forgets the pass but keeps the words when the server key was replaced', async () => {
    const env = fakeEnv();
    wire(env);
    await passFor();
    env.ANTHROPIC_API_KEY = 'sk-ant-test-a-new-fake-key-22222';
    await expect(lines()).rejects.toThrow('Fizzwick forgot this phone. Say the magic words again.');
    expect(settings.wizardPass).toBe('');
    expect(await passFor()).not.toBe('');
    expect(await lines()).toEqual(['Test item one', 'Test item two']);
  });

  it("says the server is in trouble, not the internet, when it fails, and keeps the pass", async () => {
    const env = fakeEnv();
    wire(env);
    const pass = await passFor();
    const broken = { ...env, LIMITS: { idFromName: (n: string) => n, get: () => ({ fetch: async (): Promise<Response> => { throw new Error('storage detail'); } }) } };
    wire(broken);
    const r = await redeemPhrase('test phrase one', SERVER);
    expect(r).toEqual({ ok: false, reason: 'server' });
    expect(redeemMessage(r)).toBe("Fizzwick's tower is having trouble. Try again in a little while.");
    await expect(lines()).rejects.toThrow("Fizzwick's tower is having trouble. Try again in a little while.");
    expect(settings.wizardPass).toBe(pass);
  });

  it('says when the pass expired, and forgets it', async () => {
    wire(fakeEnv());
    await passFor();
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 31 * 86_400_000);
    await expect(lines()).rejects.toThrow("Fizzwick's pass expired. Say the magic words again.");
    expect(settings.wizardPass).toBe('');
  });

  it('keeps a newer pass when an older request comes back refused', async () => {
    const env = fakeEnv();
    wire(env);
    await passFor();
    env.PARTY_PHRASES = 'test phrase two';
    wire(env, { beforeReply: () => void (settings.wizardPass = 'newer.pass') });
    await expect(lines()).rejects.toThrow('The magic words have changed.');
    expect(settings.wizardPass).toBe('newer.pass');
  });

  it("tells this phone's daily share apart from the party's", async () => {
    const limited = (reason: string) => () => Response.json({ type: 'error', error: { type: 'rate_limit_error', message: 'x' } }, { status: 429, headers: { 'x-wizard-reason': reason, 'x-should-retry': 'false' } });
    settings.wizardPass = 'some.pass';
    wire(fakeEnv(), { reply: limited('phone') });
    await expect(lines()).rejects.toThrow('Fizzwick needs a nap: this phone has had its share of magic today. Try again tomorrow.');
    wire(fakeEnv(), { reply: limited('party') });
    await expect(lines()).rejects.toThrow("Fizzwick needs a nap: the party's wizard allowance is used up for now. Try again later.");
  });

  it('keeps the invite route first: a phone with its own key calls the API directly', async () => {
    const env = fakeEnv();
    const { upstream, phone } = wire(env);
    settings.apiKey = 'sk-ant-test-invite-fake-key-3333333';
    settings.wizardPass = 'some.pass';
    expect(await lines()).toEqual(['Test item one', 'Test item two']);
    expect(phone).toHaveLength(0);
    expect(upstream[0].headers.get('authorization')).toBe('Bearer sk-ant-test-invite-fake-key-3333333');
    expect(upstream[0].headers.get('anthropic-beta')).toBe('server-side-fallback-2026-07-01');
    expect(upstream[0].body.fallbacks).toBe('default');
    expect(upstream[0].body.max_tokens).toBe(9000);
  });
});

describe('wizard messages', () => {
  it("speak in the wizard's voice per route", () => {
    expect(statusMessage(401, true)).toBe('Fizzwick forgot this phone. Say the magic words again.');
    expect(statusMessage(401, true, 'invalid')).toBe('Fizzwick forgot this phone. Say the magic words again.');
    expect(statusMessage(500, true, 'server')).toBe("Fizzwick's tower is having trouble. Try again in a little while.");
    expect(statusMessage(500, false, 'server')).toMatch(/overloaded/);
    expect(statusMessage(401, true, 'revoked')).toBe('The magic words have changed. Ask the host for the new ones.');
    expect(statusMessage(401, true, 'expired')).toBe("Fizzwick's pass expired. Say the magic words again.");
    expect(statusMessage(429, true, 'phone')).toMatch(/this phone has had its share/);
    expect(statusMessage(429, false, 'phone')).toMatch(/swamped/);
    expect(statusMessage(429, true, 'party')).toBe("Fizzwick needs a nap: the party's wizard allowance is used up for now. Try again later.");
    // A 429 without the server's reason is Anthropic busy, passed on: not the party's allowance.
    expect(statusMessage(429, true)).toBe('Fizzwick is swamped. Give him a moment, then try again.');
    expect(statusMessage(401, false)).toMatch(/say the magic words again/);
    expect(statusMessage(429, false)).toMatch(/swamped/);
    expect(statusMessage(502, true)).toMatch(/overloaded/);
    expect(statusMessage(400, true)).toBeNull();
  });
  it('put waits in plain words', () => {
    expect(waitWords(undefined)).toBe('a minute');
    expect(waitWords(30)).toBe('a minute');
    expect(waitWords(841)).toBe('about 15 minutes');
    expect(waitWords(3600)).toBe('about an hour');
    expect(waitWords(4 * 3600)).toBe('about 4 hours');
    expect(redeemMessage({ ok: true, token: 't' })).toBe("Fizzwick heard you. He's yours on this phone.");
    expect(redeemMessage({ ok: false, reason: 'wrong' })).toBe("Fizzwick doesn't know those words.");
    expect(redeemMessage({ ok: false, reason: 'server' })).toBe("Fizzwick's tower is having trouble. Try again in a little while.");
  });
});
