import { describe, expect, it } from 'vitest';
import { cardList as cards } from '../../lib/cards/notation';
import { classify } from './combos';
import { said, selectionLine } from './labels';

const on = (list: string | null, first: string | null = null) => ({ table: list ? classify(cards(list)) : null, first: first ? cards(first)[0] : null });

describe('Big 2 words', () => {
  it("say what the phone's selection is, or why it cannot be played", () => {
    expect([selectionLine(cards('Ks Kd'), on(null)), selectionLine(cards('Ks 4d'), on(null)), selectionLine(cards('5s 5d'), on('9s 9d'))])
      .toEqual(['Pair of kings', 'Not a hand', "Pair of fives: doesn't beat it"]);
    expect([selectionLine(cards('As'), on('9s 9d')), selectionLine(cards('4c'), on(null, '3d')), selectionLine(cards('3d 4c 5h 6s 7d'), on(null))])
      .toEqual(['Needs a pair', 'Must include the 3 of diamonds', 'Straight to the seven']);
  });

  it('tell the table each play as it happens', () => {
    const name = (pid: string) => ({ m: 'Maya', s: 'Sam' })[pid]!;
    expect([said({ n: 1, k: 'play', by: 'm', cards: cards('Ks Kh') }, name), said({ n: 2, k: 'pass', by: 's' }, name), said({ n: 3, k: 'lead', by: 'm' }, name)])
      .toEqual(['Maya played a pair of kings.', 'Sam passed.', 'Maya leads.']);
    expect([said({ n: 4, k: 'play', by: 'm', cards: cards('8s 8h 8d Kc Kd') }, name), said({ n: 5, k: 'play', by: 's', cards: cards('Ah') }, name)])
      .toEqual(['Maya played a full house of eights.', 'Sam played the ace of hearts.']);
  });
});
