import { describe, expect, it } from 'vitest';
import * as L from './logic';
import { view } from './view';
import { fill } from './cards';

const answers = Array.from({ length: 40 }, (_, i) => `Card ${i}`);
function judging() {
  let g = L.newGame('g', 'BCDF', L.DEFAULT_SETTINGS);
  for (const pid of ['a', 'b', 'c']) g = (L.join(g, pid, pid.toUpperCase(), new Set()) as { game: L.Game }).game;
  g = L.start(g, { prompts: ['Never trust ___.'], answers }, 0, () => 0.3);
  for (const pid of g.round!.players) g = L.play(g, pid, g.at, [g.hands[pid][0]], ['']);
  return L.tick(g, 1, new Set(['a', 'b', 'c']));
}

describe('Bad Hand views', () => {
  it('give each phone only its own hand and no answer its author before the reveal', () => {
    const g = judging();
    const [a, b] = g.round!.players;
    const mine = view(g, 1, a);
    expect(mine.hand?.map((c) => c.id)).toEqual(g.hands[a]);
    const text = JSON.stringify([mine, view(g, 1)]);
    for (const id of g.hands[b]) expect(text).not.toContain(`"${g.cards[id]}"`);
    expect(view(g, 1).hand).toBeUndefined();
    expect(mine.answers?.every((x) => x.by === undefined)).toBe(true);
    expect(mine.mine).toBe(g.round!.order.indexOf(a));
    const shown = L.pick(g, g.round!.judge, g.at, 0, 2);
    expect(view(shown, 2).answers?.map((x) => x.by)).toEqual(g.round!.order);
  });

  it('fill a prompt with the played answers and put a question\'s answer after it', () => {
    expect(fill('Wow, ___. Then ___', ['Bees!', 'Rain'])).toEqual([
      { text: 'Wow, ', filled: false }, { text: 'Bees!', filled: true }, { text: ' Then ', filled: false }, { text: 'Rain', filled: true },
    ]);
    expect(fill('I said ___.', ['Hi!']).map((p) => p.text).join('')).toBe('I said Hi!');
    expect(fill('Why?', ['Bees']).at(-1)).toEqual({ text: 'Bees', filled: true });
    expect(fill('A ___ b ___', ['x']).at(-1)).toEqual({ text: '___', filled: false });
  });
});

describe('answers read inside a prompt', () => {
  it('lose a common opening capital mid-sentence, keep names and sentence starts', async () => {
    const { filled } = await import('./cards');
    expect(filled('My therapist says ___ is not a personality', ['A haunted air fryer'])).toBe('My therapist says a haunted air fryer is not a personality');
    expect(filled('First ___, then ___', ['Crying at a car commercial', 'Being 27 and needing a nap'])).toBe('First crying at a car commercial, then being 27 and needing a nap');
    expect(filled('I paid for ___', ['Dolly Parton'])).toBe('I paid for Dolly Parton');
    expect(filled('___ is my love language', ['A haunted air fryer'])).toBe('A haunted air fryer is my love language');
    expect(filled('Drink one: ___', ['The spins'])).toBe('Drink one: The spins');
  });
});
