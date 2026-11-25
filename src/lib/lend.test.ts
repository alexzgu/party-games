import { describe, expect, it } from 'vitest';
import { ask, consent, keptPicks, onScreen, stillAsked } from './lend';

const mine = { id: 'mine', name: 'Mine' }, classic = { id: 'classic', name: 'Classic' }, dark = { id: 'dark', name: 'After Dark' };

describe('the question put to the host after Start', () => {
  const five = ask([mine], [classic], 'Your packs have 10 titles. 5 players need 19.', 'titles');
  const six = ask([mine], [classic], 'Your packs have 10 titles. 6 players need 22.', 'titles');
  const eight = ask([mine], [classic, dark], 'Your packs have 10 titles. 8 players need 24.', 'titles');

  it('stays on screen while the room asks the same, following its numbers', () => {
    const asked = five!.key;
    expect(onScreen(asked, five)).toBe(five);
    expect(stillAsked(asked, six)).toBe(asked);
    expect(onScreen(asked, six)).toBe(six);
  });

  it('is forgotten once the question goes away or changes, so it never comes back by itself', () => {
    for (const now of [null, eight]) {
      const after = stillAsked(five!.key, now);
      expect([after, onScreen(after, now)]).toEqual(['', null]);
      expect(onScreen(after, five)).toBeNull();
    }
    expect(onScreen('', five)).toBeNull();
  });
});

describe("a setup screen's ticks as it opens", () => {
  it('keeps the picks that exist, and turns to the default only once every pick was deleted', () => {
    const all = [mine, classic, dark];
    expect(keptPicks(all, ['gone', 'mine'], ['classic'])).toEqual(['mine']);
    expect(keptPicks(all, ['gone'], ['classic'])).toEqual(['classic']);
    expect(keptPicks(all, [], ['classic'])).toEqual([]);
  });
});

describe('the key of the question', () => {
  it('differs when the same packs would lend another kind, so a yes never carries over to it', () => {
    const words = ask([mine], [classic], 'Your packs have 12 words. 4 players need 30.', 'words')!;
    const ideas = ask([mine], [classic], 'Your packs have 2 ideas. 3 players need 3.', 'ideas')!;
    const answers = ask([mine], [classic], '', 'cards', ['answers'])!, prompts = ask([mine], [classic], '', 'cards', ['prompts'])!;
    expect(consent(ideas, words.key, '')).toBeNull();
    expect(consent(prompts, answers.key, '')).toBeNull();
    expect(ask([mine], [classic], '', 'cards', ['prompts', 'answers'])!.key).toBe(ask([mine], [classic], '', 'cards', ['answers', 'prompts'])!.key);
  });
});
