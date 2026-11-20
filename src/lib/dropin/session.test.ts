import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DropInPack, RoomCard, WarmCard } from '../content';
import { advance, begin, draw, readRound, saveRound, type Options } from './session';

const warm: WarmCard = { answer: 'Stapler', clues: ['I sit quietly', 'I have a hinge', 'I bite paper', 'My teeth stay behind'] };
const side: RoomCard = { type: 'side', a: 'Early', b: 'Late' };
const foley: RoomCard = { type: 'foley', lines: ['Door shuts [BANG]', 'Goose yells [HONK]'] };
const proof: RoomCard = { type: 'proof', text: 'Something green' };
const options: Options = { packs: ['first', 'second'], types: ['side', 'foley', 'proof'], drip: 8 };
const room: DropInPack<RoomCard>[] = [
  { id: 'first', name: 'First', blurb: '', cards: [side, foley] },
  { id: 'second', name: 'Second', blurb: '', cards: [proof] },
];

beforeEach(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('persistent dealing', () => {
  it('deals every eligible card before repeating across fresh calls and across cycles', () => {
    for (let cycle = 0; cycle < 2; cycle++) {
      const dealt = Array.from({ length: 3 }, () => draw('room', room, options));
      expect(new Set(dealt)).toEqual(new Set([side, foley, proof]));
    }
    expect(draw('room', room, { ...options, types: [] })).toBeUndefined();
  });

  it('keeps the seen cards when card types are changed', () => {
    expect(draw('room', room, { ...options, types: ['side'] })).toEqual(side);
    expect(draw('room', room, { ...options, types: ['foley'] })).toEqual(foley);
    expect(draw('room', room, options)).toEqual(proof);
  });

  it('deals warm cards without repeats across starts', () => {
    const others = ['Kettle', 'Notebook'].map((answer) => ({ ...warm, answer }));
    const packs = [{ id: 'first', name: 'First', blurb: '', cards: [warm, ...others] }];
    expect(new Set(Array.from({ length: 3 }, () => draw('warm', packs, options)))).toEqual(new Set(packs[0].cards));
  });
});

describe('resume', () => {
  it('stores the warm clue, original card and time left, and stops at the final clue', () => {
    const next = advance(begin(warm, options))!;
    saveRound('warm', { ...next, left: 2300 });
    const resumed = readRound('warm')!;
    expect(resumed).toEqual({ ...next, left: 2300 });
    const last = advance(advance(resumed)!)!;
    expect(last.step).toBe(3);
    expect(last.left).toBe(0);
    expect(advance(last)).toBeUndefined();
  });

  it('restores a foley line, an active proof timer and a finished countdown', () => {
    const lastLine = advance(begin(foley, options))!;
    const proofTimer = { ...begin(proof, options), left: 12_430 };
    const point = advance(begin(side, options))!;
    for (const round of [lastLine, proofTimer, point]) {
      saveRound('room', round);
      expect(readRound('room')).toEqual(round);
    }
    expect(lastLine.step).toBe(1);
    expect(point.revealed).toBe(true);
    expect(readRound('warm')).toBeNull();
  });
});
