import { describe, expect, it, vi } from 'vitest';
import { accepts, finish, makeDealer, mark, newRound, openPlay, score, toggle, type Round } from './round';
import { cleanLine } from './words';
import { makeBag } from '../../lib/bag';

describe('round results', () => {
  it('scores, toggles mis-tilts, and leaves the word on screen at the end out of the results', () => {
    let r: Round = { ...newRound(['x'], 60, true), current: 'Cat' };
    r = mark(r, true, 'Dog');
    r = mark(r, false, 'Owl');
    r = finish(r, 'time');
    expect(r.shown).toEqual([{ word: 'Cat', ok: true }, { word: 'Dog', ok: false }]);
    expect(r.current).toBeNull();
    expect(score(r.shown)).toBe(1);
    expect(score(toggle(r.shown, 1))).toBe(2);
    expect(r.phase).toBe('results');
  });
});

describe('opening play', () => {
  it('ends the round at once when the decks have no words', () => {
    const empty = makeDealer([{ id: 'e', name: 'E', emoji: '', blurb: '', words: [] }]);
    const opened = openPlay(newRound(['e'], 60, true), empty.next);
    expect(opened.out).toBe(true);
    expect(finish(opened.round, 'out')).toMatchObject({ phase: 'results', shown: [] });
  });

  it('deals the first word, and keeps a word already on screen after a reload', () => {
    expect(openPlay(newRound(['x'], 60, true), () => 'Cat').round.current).toBe('Cat');
    const r = { ...newRound(['x'], 60, true), current: 'Dog' };
    expect(openPlay(r, () => 'Cat')).toEqual({ round: r, out: false });
  });
});

describe('dealer', () => {
  it('never repeats a word within a round and runs dry when every word was shown', () => {
    const decks = [
      { id: 'a', name: 'A', emoji: '', blurb: '', words: ['One', 'Two', 'Shared'] },
      { id: 'b', name: 'B', emoji: '', blurb: '', words: ['shared', 'Three'] },
    ];
    const d = makeDealer(decks, ['Two']);
    const got: string[] = [];
    for (let w = d.next(); w; w = d.next()) got.push(w.toLowerCase());
    expect(got.sort()).toEqual(['one', 'shared', 'three']);
  });

  it('puts the word left on screen back in its deck, unseen, even after a reload', () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v) });
    try {
      const deck = { id: 'back', name: 'B', emoji: '', blurb: '', words: ['One', 'Two', 'Three'] };
      const unseen = () => makeBag('forehead:back', deck.words, (w) => w.trim().toLowerCase()).remaining;
      const dealer = makeDealer([deck]);
      const w = dealer.next()!;
      expect(unseen()).toBe(2);
      dealer.putBack(w);
      expect(unseen()).toBe(3);
      const before = makeDealer([deck]).next()!;
      makeDealer([deck], [before]).putBack(before); // dealt before a reload: the new dealer has no record of it
      expect(unseen()).toBe(3);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('cleanLine', () => {
  it('strips list markers and quotes and rejects chatter', () => {
    expect(cleanLine('1. "Moon Landing"')).toBe('Moon Landing');
    expect(cleanLine('- **Taylor Swift**')).toBe('Taylor Swift');
    expect(cleanLine('pumpkin spice latte')).toBe('Pumpkin Spice Latte');
    expect(cleanLine('Here are some great party words for you:')).toBeNull();
    expect(cleanLine('Movies: Titanic')).toBeNull();
    expect(cleanLine('A Very Long Item With Too Many Words')).toBeNull();
  });
});

describe('accepts', () => {
  it('takes only the input the players chose', () => {
    expect(accepts(newRound(['x'], 60, true, false), true)).toEqual({ tilt: true, tap: false });
    expect(accepts(newRound(['x'], 60, false, true), true)).toEqual({ tilt: false, tap: true });
    expect(accepts(newRound(['x'], 60, true, true), true)).toEqual({ tilt: true, tap: true });
  });

  it('takes taps in a tilt-only round when the phone cannot feel tilts', () => {
    expect(accepts(newRound(['x'], 60, true, false), false)).toEqual({ tilt: false, tap: true });
  });

  it('keeps taps for a round saved before the choice existed', () => {
    const { tap: _, ...old } = newRound(['x'], 60, true);
    expect(accepts(old, true)).toEqual({ tilt: true, tap: true });
  });
});
