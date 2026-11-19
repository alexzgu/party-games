import { describe, expect, it } from 'vitest';
import { award, newGame, next, noPoint, rematch, showCard, undo, validGame, validSetup, winner } from './logic';

const card = { phrase: 'Eye Scream', answer: 'Ice Cream', hint: 'Food' };
const start = () => newGame(['Ana', 'Ben', 'Cy'], { target: 2, seconds: 30, packIds: ['classic'] });

describe('say what rules', () => {
  it('needs three players', () => {
    expect(() => newGame(['Ana', 'Ben'], { target: 5, seconds: 30, packIds: [] })).toThrow();
  });

  it('gives the point to the shouter, never to the reader', () => {
    const s = showCard(start(), card);
    expect(award(s, 0)).toBe(s); // Ana reads first
    const r = award(s, 2);
    expect(r.players.map((p) => p.score)).toEqual([0, 0, 1]);
    expect(r.phase).toBe('reveal');
  });

  it('rotates the reader around the circle after each card', () => {
    let s = start();
    const readers: number[] = [];
    for (let i = 0; i < 4; i++) {
      readers.push(s.reader);
      s = next(noPoint(showCard(s, card), 'nobody'));
    }
    expect(readers).toEqual([0, 1, 2, 0]);
    expect(s.players.every((p) => p.score === 0)).toBe(true);
  });

  it('ends the game when someone reaches the target', () => {
    let s = next(award(showCard(start(), card), 1)); // Ben 1, Ben reads next
    s = next(award(showCard(s, card), 2)); // Cy 1, Cy reads next
    expect(s.phase).toBe('handoff');
    s = award(showCard(s, card), 1); // Ben 2
    expect(winner(s)).toBe(1);
    expect(next(s).phase).toBe('win');
  });

  it('undo takes the point back and returns to the same card', () => {
    const s = showCard(start(), card);
    const u = undo(award(s, 1));
    expect(u.phase).toBe('card');
    expect(u.card).toEqual(card);
    expect(u.players.map((p) => p.score)).toEqual([0, 0, 0]);
  });

  it('rematch resets scores and moves the first reader on', () => {
    const won = { ...start(), players: [{ name: 'Ana', score: 2 }, { name: 'Ben', score: 1 }, { name: 'Cy', score: 0 }], phase: 'win' as const };
    const r = rematch(won);
    expect(r.players.map((p) => p.score)).toEqual([0, 0, 0]);
    expect(r.reader).toBe(1);
    expect(r.phase).toBe('handoff');
  });

  it('rejects saved state of the wrong shape', () => {
    const reveal = award(showCard(start(), card), 1);
    expect(validGame(null)).toBeNull();
    expect(validGame('junk')).toBeNull();
    expect(validGame({ v: 1, players: [], phase: 'card' })).toBeNull();
    expect(validGame({ ...start(), phase: 'card', card: null })).toBeNull();
    expect(validGame({ ...reveal, outcome: null })).toBeNull();
    expect(validGame({ ...reveal, outcome: { kind: 'point', scorer: 7 } })).toBeNull();
    expect(validGame({ ...start(), packIds: 'classic' })).toBeNull();
    expect(validGame({ ...start(), packIds: [3] })).toBeNull();
    for (const k of ['seconds', 'target', 'timeLeft', 'cardsPlayed']) expect(validGame({ ...start(), [k]: 'x' })).toBeNull();
    expect(validGame(reveal)).toEqual(reveal);
    const { dealt: _, ...older } = start();
    expect(validGame(older)?.dealt).toEqual([]); // saves from before answers were tracked still load
  });

  it('never deals an answer twice in one game, rematches included', () => {
    let s = showCard(start(), card);
    s = showCard(s, { ...card, phrase: 'I Scream' });
    expect(s.dealt).toEqual(['icecream']);
    expect(rematch(next(noPoint(s, 'nobody'))).dealt).toEqual(['icecream']);
  });

  it('checks each saved setup field on its own', () => {
    expect(validSetup(null)).toEqual({ packIds: null, seconds: 30, target: 5 });
    expect(validSetup({ packIds: ['pop'], seconds: 45, target: 7 })).toEqual({ packIds: ['pop'], seconds: 45, target: 7 });
    expect(validSetup({ packIds: 'pop', seconds: 31, target: 99 })).toEqual({ packIds: null, seconds: 30, target: 5 });
  });
});
