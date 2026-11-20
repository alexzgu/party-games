import { describe, expect, it } from 'vitest';
import { deriveKeys, sameBytes } from './crypto';
import { currentPhraseIds, matchPhrase, normalisePhrase, parsePhrases, phraseId } from './phrase';
import { FAKE_KEY, FAKE_PHRASES } from './testing';

describe('party phrases', () => {
  it('normalises case, punctuation and spaces', () => {
    expect(normalisePhrase('  Test,  PHRASE   one!! ')).toBe('test phrase one');
    expect(normalisePhrase('test-phrase\tone')).toBe('testphrase one');
    expect(normalisePhrase('?!.')).toBe('');
  });
  it('reads one phrase per line, skipping blanks and repeats', () => {
    expect(parsePhrases('Test phrase one\r\n\n  test phrase ONE \ntest phrase two\n')).toEqual(['test phrase one', 'test phrase two']);
    expect(parsePhrases(undefined)).toEqual([]);
    expect(parsePhrases('test phrase one, Test phrase two;test phrase three,')).toEqual(['test phrase one', 'test phrase two', 'test phrase three']);
  });
  it('matches any accepted phrase however it is typed, and nothing else', async () => {
    const keys = await deriveKeys(FAKE_KEY);
    const pid = await matchPhrase(keys, 'TEST phrase, two.', FAKE_PHRASES);
    expect(pid).toBe(await phraseId(keys, 'test phrase two'));
    expect(await matchPhrase(keys, 'test phrase three', FAKE_PHRASES)).toBeNull();
    expect(await matchPhrase(keys, '!!!', FAKE_PHRASES)).toBeNull();
    expect(await matchPhrase(keys, 'test phrase one', '')).toBeNull();
  });
  it('gives each phrase its own id, and new ids under a new key', async () => {
    const keys = await deriveKeys(FAKE_KEY);
    const ids = await currentPhraseIds(keys, FAKE_PHRASES);
    expect(ids.size).toBe(2);
    const other = await currentPhraseIds(await deriveKeys('sk-ant-test-another-fake-key-11111'), FAKE_PHRASES);
    expect([...other].some((id) => ids.has(id))).toBe(false);
  });
  it('compares bytes in full', () => {
    expect(sameBytes(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true);
    expect(sameBytes(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false);
    expect(sameBytes(new Uint8Array([1, 2]), new Uint8Array([1, 2, 0]))).toBe(false);
  });
});
