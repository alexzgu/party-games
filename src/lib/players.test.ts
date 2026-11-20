import { describe, expect, it } from 'vitest';
import { nextPlayerName } from './players';

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
