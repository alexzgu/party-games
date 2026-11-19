import { describe, expect, it } from 'vitest';
import { finish, makeDealer, mark, newRound, openPlay, score, toggle, type Round } from './round';
import { cleanLine } from './words';

describe('round results', () => {
  it('scores, toggles mis-tilts, and counts the word left on screen as a pass', () => {
    let r: Round = { ...newRound(['x'], 60, true), current: 'Cat' };
    r = mark(r, true, 'Dog');
    r = mark(r, false, 'Owl');
    r = finish(r, 'time');
    expect(r.shown).toEqual([{ word: 'Cat', ok: true }, { word: 'Dog', ok: false }, { word: 'Owl', ok: false }]);
    expect(score(r.shown)).toBe(1);
    expect(score(toggle(r.shown, 2))).toBe(2);
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
