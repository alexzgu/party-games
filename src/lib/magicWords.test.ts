// The magic-words box's choices without a browser: a fake fetch, fake keys and words only.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { settings } from './settings.svelte';
import { BROKEN_KEY, readTyped, sayWords } from './magicWords';

const SERVER = 'https://wizard.test';
const KEY = 'sk-ant-test-not-a-real-key-000000';

/** A fake server whose one answer is held until `answer()` is called. */
function heldServer() {
  let release: (r: Response) => void = () => {};
  const fetch = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((resolve, reject) => {
    release = resolve;
    init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
  }));
  vi.stubGlobal('fetch', fetch);
  return { fetch, answer: () => release(Response.json({ token: 'fake.pass' })) };
}

afterEach(() => {
  vi.unstubAllGlobals();
  settings.apiKey = '';
  settings.wizardPass = '';
});

describe('the magic words box', () => {
  it('tells keys, broken keys and words apart', () => {
    expect(readTyped(`  ${KEY} `)).toEqual({ kind: 'key', key: KEY });
    expect(readTyped(`https://example.test/#/join/${KEY}`)).toEqual({ kind: 'key', key: KEY });
    for (const broken of [`${KEY}!`, 'sk-ant-short', 'SK-ANT-oops', `see sk-ant-${'a'.repeat(30)}.`, 'https://example.test/#/join/nope']) {
      expect(readTyped(broken)).toEqual({ kind: 'broken' });
    }
    expect(readTyped('otter velvet lantern')).toEqual({ kind: 'words' });
  });

  it('never sends something that looks like a key to the server', async () => {
    const { fetch } = heldServer();
    expect(await sayWords(`https://example.test/#/join/${KEY}.`, undefined, SERVER)).toEqual({ ok: false, message: BROKEN_KEY });
    expect(await sayWords(`${KEY} thanks`, undefined, SERVER)).toEqual({ ok: false, message: BROKEN_KEY });
    expect(fetch).not.toHaveBeenCalled();
    expect(settings.apiKey).toBe('');
    expect((await sayWords(KEY, undefined, SERVER))?.ok).toBe(true);
    expect(settings.apiKey).toBe(KEY);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('saves the pass from a timely answer', async () => {
    const server = heldServer();
    const said = sayWords('test phrase one', undefined, SERVER);
    server.answer();
    expect((await said)?.ok).toBe(true);
    expect(settings.wizardPass).toBe('fake.pass');
  });

  it('drops a late answer once the box has gone', async () => {
    const server = heldServer();
    const gone = new AbortController();
    const said = sayWords('test phrase one', gone.signal, SERVER);
    gone.abort();
    server.answer();
    expect(await said).toBeNull();
    expect(settings.wizardPass).toBe('');
  });

  it('drops a late answer after Fizzwick was sent away meanwhile', async () => {
    settings.wizardPass = 'old.pass';
    const server = heldServer();
    const said = sayWords('test phrase one', undefined, SERVER);
    settings.wizardPass = '';
    settings.apiKey = '';
    server.answer();
    expect(await said).toBeNull();
    expect(settings.wizardPass).toBe('');
  });

  it('takes no words without a wizard server, only a key', async () => {
    const { fetch } = heldServer();
    expect((await sayWords('otter velvet lantern', undefined, ''))?.ok).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
});
