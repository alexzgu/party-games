import { describe, expect, it } from 'vitest';
import { deriveKeys, sameBytes } from './crypto';
import { LIMITS } from './limits';
import { currentPhraseIds, guessesFrom, matchGuesses, normalisePhrase, parsePhrases, phraseId } from './phrase';
import { FAKE_KEY, FAKE_PHRASES } from './testing';

describe('party phrases', () => {
  it('normalises case, punctuation and spaces', () => {
    expect(normalisePhrase('  Test,  PHRASE   one!! ')).toBe('test phrase one');
    expect(normalisePhrase('test-phrase\tone')).toBe('test phrase one'); // punctuation splits words
    expect(normalisePhrase('?!.')).toBe('');
  });
  it('reads one phrase per line, skipping blanks and repeats', () => {
    expect(parsePhrases('Test phrase one\r\n\n  test phrase ONE \ntest phrase two\n')).toEqual(['test phrase one', 'test phrase two']);
    expect(parsePhrases(undefined)).toEqual([]);
    expect(parsePhrases('test phrase one, Test phrase two;test phrase three,')).toEqual(['test phrase one', 'test phrase two', 'test phrase three']);
  });
  it('matches any accepted phrase however it is typed, and nothing else', async () => {
    const keys = await deriveKeys(FAKE_KEY);
    const pid = await matchGuesses(keys, guessesFrom('TEST phrase, two.'), FAKE_PHRASES);
    expect(pid).toBe(await phraseId(keys, 'test phrase two'));
    expect(await matchGuesses(keys, guessesFrom('test phrase three'), FAKE_PHRASES)).toBeNull();
    expect(await matchGuesses(keys, guessesFrom('!!!'), FAKE_PHRASES)).toBeNull();
    expect(await matchGuesses(keys, guessesFrom('test phrase one'), '')).toBeNull();
  });
  it("splits what was typed into guesses: the whole phrase, then each distinct word, case and punctuation ignored", () => {
    // The owner's example: its four words are each a guess, and so is the whole phrase.
    expect(guessesFrom('I aM noT!!!?? drunk.')).toEqual(['i am not drunk', 'i', 'am', 'not', 'drunk']);
    expect(guessesFrom('red,blue')).toEqual(['red blue', 'red', 'blue']);
    expect(guessesFrom("Don\u2019t STOP")).toEqual(['dont stop', 'dont', 'stop']);
    expect(guessesFrom('  DRUNK?! ')).toEqual(['drunk']);
    expect(guessesFrom('drunk Drunk, DRUNK.')).toEqual(['drunk drunk drunk', 'drunk']);
    expect(guessesFrom('?!. ...')).toEqual([]);
  });
  it('checks at most 12 guesses from one submission, ignoring the rest', () => {
    const words = Array.from({ length: 20 }, (_, i) => `word${i}`);
    const g = guessesFrom(words.join(' '));
    expect(LIMITS.guessesPerSubmission).toBe(12);
    expect(g).toHaveLength(12);
    expect(g).toEqual([words.join(' '), ...words.slice(0, 11)]);
  });
  it('lets the right words in when any one guess is an accepted phrase', async () => {
    const keys = await deriveKeys(FAKE_KEY);
    const secret = 'drunk\ntest phrase two';
    expect(await matchGuesses(keys, guessesFrom('I aM noT!!!?? drunk.'), secret)).toBe(await phraseId(keys, 'drunk'));
    expect(await matchGuesses(keys, guessesFrom('i am not sober'), secret)).toBeNull();
    // A phrase of several words matches only whole, never by one of its words.
    expect(await matchGuesses(keys, guessesFrom('two'), secret)).toBeNull();
    expect(await matchGuesses(keys, guessesFrom('Test phrase two!'), secret)).toBe(await phraseId(keys, 'test phrase two'));
    // Stored phrases are normalised the same way.
    expect(await matchGuesses(keys, guessesFrom('drunk'), 'DRUNK!!')).toBe(await phraseId(keys, 'drunk'));
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
