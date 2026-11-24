import { describe, expect, it } from 'vitest';
import { ask, onScreen, stillAsked } from './lend';

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
