import { describe, expect, it } from 'vitest';
import { nextKept, nextPlayerName, reseating, unchanged } from './players';

describe('nextPlayerName', () => {
  it('numbers the new player after the ones already listed', () => {
    expect(nextPlayerName([])).toBe('Player 1');
    expect(nextPlayerName(['Ana', 'Ben', 'Cy'])).toBe('Player 4');
  });

  it('skips a number already taken, whatever its case', () => {
    expect(nextPlayerName(['Ana', 'player 3'])).toBe('Player 4');
    expect(nextPlayerName(['Player 2', 'Player 3', 'Player 4'])).toBe('Player 5');
  });
});

describe('reseating', () => {
  it('tells kept, renamed, added and removed players apart by place', () => {
    // Ana renamed to Anna, Ben removed, Dee added.
    const r = reseating(['Anna', 'Cy', 'Dee'], [0, 2, -1], 3);
    expect(r.places).toEqual([0, -1, 1]);
    expect(unchanged(r, ['Ana', 'Ben', 'Cy'])).toBe(false);
    expect(nextKept(r, 1)).toBe(1); // Ben's turn passes to Cy
  });

  it('sees an untouched list as unchanged', () => {
    expect(unchanged(reseating(['Ana', 'Ben'], [0, 1], 2), ['Ana', 'Ben'])).toBe(true);
  });
});
