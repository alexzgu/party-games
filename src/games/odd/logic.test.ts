import { describe, expect, it } from 'vitest';
import { seeded } from '../../lib/room/bots';
import type { WordDeck } from '../../lib/content';
import { makeDealer, nextWord } from './deal';
import {
  caught, clueOrder, dealRound, endedRecord, gameRecord, hide, newGame, nextRound, passBack, rematch, roundPoints, secretFor, settle, showWord, startOver, toVote, vote,
  type GameOptions, type GameState,
} from './logic';
import { validGame } from './valid';

const OPTS: GameOptions = { rounds: 3, hint: true, oddNeverStarts: true, packIds: ['movies'] };
const NAMES = ['Maya', 'Ben', 'Cy', 'Dee'];
const start = (opts: Partial<GameOptions> = {}, seed = 1) => newGame(NAMES, { ...OPTS, ...opts }, { word: 'Shrek', pack: 'Movies' }, seeded(seed));
/** The game with the odd one out set to `odd`, at the vote. */
const atVote = (odd: number) => { const g = start(); return toVote({ ...g, phase: 'clues', round: { ...g.round, odd } }); };
const reload = (s: GameState) => validGame(JSON.parse(JSON.stringify(s)));
const deck = (id: string, words: string[], name = `${id} pack`): WordDeck => ({ id, name, emoji: '', blurb: '', words });

describe('deal', () => {
  it('never lets the odd one start when the option is on', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const r = dealRound(3, { word: 'x', pack: 'p' }, true, seeded(seed));
      expect(r.starter).not.toBe(r.odd);
    }
  });
  it('lets anyone start, the odd one too, when it is off', () => {
    const odd = Array.from({ length: 300 }, (_, i) => dealRound(3, { word: 'x', pack: 'p' }, false, seeded(i + 1))).filter((r) => r.starter === r.odd);
    expect(odd.length).toBeGreaterThan(0);
  });
  it('is the same for the same seed', () => {
    expect(start({}, 7).round).toEqual(start({}, 7).round);
  });
  it('deals no word twice until the packs run out, then deals again', () => {
    const next = makeDealer([deck('a', ['One', 'Two', 'Three']), deck('b', ['Four', 'five'])], seeded(5));
    const used: string[] = [];
    for (let i = 0; i < 5; i++) used.push(next(used)!.word.toLowerCase());
    expect(new Set(used).size).toBe(5);
    expect(next(used)?.word).toBeTruthy();
  });
  it('names the pack a word came from', () => {
    const s = makeDealer([deck('films', ['Jaws'], 'Big Films')], seeded(2))();
    expect(s).toEqual({ word: 'Jaws', pack: 'Big Films' });
  });
  it('carries on from the setup’s picks once the game’s packs are gone, and says so only when those are empty too', () => {
    const all = [deck('mine', ['Jaws']), deck('other', ['Up'])];
    expect(nextWord({ packIds: ['gone'], used: [] }, ['other'], all, seeded(3))).toEqual({ secret: { word: 'Up', pack: 'other pack' }, packIds: ['other'] });
    expect(nextWord({ packIds: ['mine'], used: [] }, ['other'], all, seeded(3))?.packIds).toEqual(['mine']);
    expect(nextWord({ packIds: ['gone'], used: [] }, ['gone too'], all, seeded(3))).toBeNull();
    expect(nextWord({ packIds: ['empty'], used: [] }, ['other'], [...all, deck('empty', [])], seeded(3))?.packIds).toEqual(['other']);
  });
});

describe('the pass', () => {
  it('goes through every player in list order, then to the clues', () => {
    let g = start();
    const seats = [];
    while (g.phase === 'pass') { seats.push(g.seat); g = hide(g); }
    expect(seats).toEqual([0, 1, 2, 3]);
    expect(g.phase).toBe('clues');
  });
  it('shows the word to everyone but the odd one, who gets the pack only with the hint on', () => {
    const g = start();
    const other = (g.round.odd + 1) % 4;
    expect(secretFor(g, other)).toEqual({ odd: false, word: 'Shrek', pack: 'Movies' });
    expect(secretFor(g, g.round.odd)).toEqual({ odd: true, word: '', pack: 'Movies' });
    expect(secretFor({ ...g, hint: false }, g.round.odd)).toEqual({ odd: true, word: '', pack: '' });
  });
  it('resumes on the current player’s hand-off after a reload, never on a secret', () => {
    const g = hide(hide(start()));
    const back = reload(g)!;
    expect(back.phase).toBe('pass');
    expect(back.seat).toBe(2);
    expect(back).not.toHaveProperty('showing');
  });
  it('steps back to the previous hand-off, and not past the first', () => {
    const g = hide(hide(start()));
    expect(passBack(g)?.seat).toBe(1);
    expect(passBack(start())).toBeNull();
  });
});

describe('clues', () => {
  it('go round in list order from the starter', () => {
    const g = start();
    expect(clueOrder({ ...g, round: { ...g.round, starter: 2 } })).toEqual([2, 3, 0, 1]);
  });
});

describe('vote and scores', () => {
  it('not caught: the word shows at once and the odd one scores 2', () => {
    const r = vote(atVote(1), 2);
    expect(caught(r.round)).toBe(false);
    expect(r.round.shown).toBe(true);
    expect(settle(r, null).players.map((p) => p.score)).toEqual([0, 2, 0, 0]);
  });
  it('caught and named the word: the odd one scores 1', () => {
    const r = vote(atVote(1), 1);
    expect(r.round.shown).toBe(false);
    expect(settle(r, true)).toBe(r); // not before the word is shown
    expect(settle(showWord(r), true).players.map((p) => p.score)).toEqual([0, 1, 0, 0]);
  });
  it('caught and missed: everyone else scores 1', () => {
    const s = settle(showWord(vote(atVote(1), 1)), false);
    expect(s.players.map((p) => p.score)).toEqual([1, 0, 1, 1]);
    expect(roundPoints(s.round, 4)).toEqual([1, 0, 1, 1]);
  });
  it('goes to the scores between rounds and to the win after the last', () => {
    let g = settle(vote(atVote(0), 1), null);
    expect(g.phase).toBe('scores');
    for (let i = 0; i < 2; i++) {
      const n = toVote({ ...nextRound(g, { word: `w${i}`, pack: 'p' }), phase: 'clues' });
      g = settle(vote(n, (n.round.odd + 1) % 4), null);
    }
    expect(g.phase).toBe('win');
    expect(g.log).toHaveLength(3);
  });
  it('keeps the words of the game so none comes back in it', () => {
    const g = nextRound(settle(vote(atVote(0), 1), null), { word: 'Up', pack: 'p' });
    expect(g.used).toEqual(['shrek', 'up']);
    expect(g.phase).toBe('pass');
    expect(g.seat).toBe(0);
  });
  it('a rematch keeps players and options, scores back to zero', () => {
    const won = settle(vote(atVote(0), 1), null);
    const r = rematch({ ...won, phase: 'win' }, { word: 'Up', pack: 'p' });
    expect(r.players.map((p) => p.score)).toEqual([0, 0, 0, 0]);
    expect(r.log).toEqual([]);
    expect([r.rounds, r.hint, r.phase]).toEqual([3, true, 'pass']);
  });
});

describe('History', () => {
  it('one line per round, the packs and the scores', () => {
    const s = settle(showWord(vote(atVote(1), 1)), false);
    const e = gameRecord({ ...s, phase: 'win' }, ['Movies']);
    expect(e.title).toBe('3-way tie 1–1–1–0');
    expect(e.packs).toEqual(['Movies']);
    expect(e.details).toEqual(['Round 1 · Shrek: Ben was the odd one out, caught, missed the word']);
    expect(e.finished).toBe(true);
  });
  it('a game ended early is recorded unfinished, a game with no round done is not', () => {
    const s = settle(vote(atVote(1), 2), null);
    expect(endedRecord(s, [])).toMatchObject({ title: 'Ben led 2–0–0–0', finished: false });
    expect(endedRecord(start(), [])).toBeNull();
  });
  it('a new game over an unfinished one records it only when the new game starts', () => {
    const old = settle(vote(atVote(1), 2), null);
    expect(startOver(old, NAMES, OPTS, undefined, ['Movies'])).toBeNull();
    const next = startOver(old, NAMES, OPTS, { word: 'Up', pack: 'Movies' }, ['Movies'])!;
    expect(next.ended).toMatchObject({ finished: false, packs: ['Movies'] });
    expect(next.game.round.word).toBe('Up');
    expect(startOver(null, NAMES, OPTS, { word: 'Up', pack: 'Movies' }, [])!.ended).toBeNull();
  });
});

describe('a saved game', () => {
  it('reloads as it was at every step', () => {
    const steps = [start(), toVote({ ...start(), phase: 'clues' }), vote(atVote(1), 1), settle(vote(atVote(1), 2), null)];
    for (const g of steps) expect(reload(g)).toEqual(g);
  });
  it('a damaged one is dropped', () => {
    expect(validGame({ ...start(), seat: 9 })).toBeNull();
    expect(validGame({ ...start(), players: [] })).toBeNull();
    expect(validGame(null)).toBeNull();
  });
  it('a pick, a seat or a finished round that does not fit the phase is dropped', () => {
    const g = start();
    const revealed = vote(atVote(1), 2);
    const scored = settle(revealed, null);
    expect(validGame({ ...revealed, round: { ...revealed.round, picked: -1 } })).toBeNull();
    expect(validGame({ ...revealed, round: { ...revealed.round, picked: 4 } })).toBeNull();
    expect(validGame({ ...g, round: { ...g.round, picked: 1 } })).toBeNull();
    expect(validGame({ ...scored, log: [] })).toBeNull();
    expect(validGame({ ...scored, phase: 'win', rounds: 3, log: [] })).toBeNull();
    expect(validGame({ ...g, seat: -1 })).toBeNull();
    expect(validGame({ ...g, round: { ...g.round, odd: 4 } })).toBeNull();
    expect(validGame({ ...g, round: { ...g.round, starter: -1 } })).toBeNull();
    expect(validGame(scored)).toEqual(scored);
  });
});
