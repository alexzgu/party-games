// "Ask for changes" on a new Big Board, with fake replies: storage keeps the whole board from
// before until a change has finished, a failure or Stop leaves it untouched, and Undo waits for
// no hand edit.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { settings } from '../../lib/settings.svelte';
import { PackName } from '../../lib/packName.svelte';
import { fakeReplies, unfinishedStream } from '../../lib/testing';
import type { QuizBoard } from '../../lib/content';
import { boardChanges } from './changes';

const BEFORE: QuizBoard = {
  id: '', name: 'Space Snacks', blurb: 'Conjured by Fizzwick: space and snacks',
  categories: [
    { name: 'Space', clues: [{ clue: 'This planet is nicknamed the Red Planet.', answer: 'Mars' }, { clue: 'The first person on the Moon.', answer: 'Neil Armstrong' }] },
    { name: 'Snacks', clues: [{ clue: 'Sold by the bucket at the movies.', answer: 'Popcorn' }, { clue: 'Chips piled with melted cheese.', answer: 'Nachos' }] },
  ],
};
const REPLY = [
  'Name: French Food',
  'Space | 1 | This planet is nicknamed the Red Planet. | Mars',
  'French Food | 1 | A crescent-shaped buttery pastry. | Croissant',
  'Space | 2 | The first person on the Moon. | Neil Armstrong',
  'French Food | 2 | Snails cooked in garlic butter. | Escargot',
].join('\n');

function editor() {
  settings.apiKey = 'sk-test';
  const e = { board: BEFORE, stored: [] as QuizBoard[], tab: 1, name: new PackName() };
  e.name.begin('wizard', 'space and snacks', 'My pack');
  e.name.value = BEFORE.name;
  const changes = boardChanges({
    request: 'space and snacks', board: () => e.board, show: (b) => (e.board = b), store: (b) => e.stored.push(b),
    tab: () => e.tab, setTab: (i) => (e.tab = i), name: e.name,
  });
  return { e, changes };
}

describe('asking for changes on a new board', () => {
  afterEach(() => { vi.unstubAllGlobals(); settings.apiKey = ''; });

  it('stores nothing while Fizzwick writes, and the board from before when he is stopped', async () => {
    const { e, changes } = editor();
    fakeReplies(vi.stubGlobal, (init) => unfinishedStream(REPLY, 'hang', init.signal));
    const going = changes.ask('swap snacks for French food');
    await vi.waitFor(() => expect(e.board.categories[1].name).toBe('French Food'));
    expect(e.stored).toEqual([]);
    changes.stop();
    await going;
    expect(e.board).toEqual(BEFORE);
    expect(e.stored.every((b) => JSON.stringify(b) === JSON.stringify(BEFORE))).toBe(true);
    expect(e.tab).toBe(1);
  });

  it('leaves the board and storage as they were when the change fails', async () => {
    const { e, changes } = editor();
    fakeReplies(vi.stubGlobal, 400);
    await changes.ask('swap snacks for French food');
    expect(e.board).toEqual(BEFORE);
    expect(e.stored.every((b) => JSON.stringify(b) === JSON.stringify(BEFORE))).toBe(true);
  });

  it('stores the new board once written; a hand edit then ends Undo, a typed name does not and stays', async () => {
    const { e, changes } = editor();
    fakeReplies(vi.stubGlobal, REPLY, REPLY);
    await changes.ask('swap snacks for French food');
    expect(e.stored.at(-1)).toEqual(e.board);
    expect(e.board.name).toBe('French Food');
    expect(changes.thread[0].result).toBe('Kept 2 · replaced 2');
    e.name.type('Our Board');
    e.board = { ...e.board, name: 'Our Board' };
    expect(changes.canUndo).toBe(true);
    changes.undo();
    expect(e.board.categories).toEqual(BEFORE.categories);
    expect(e.board.name).toBe('Our Board');
    expect(e.stored.at(-1)).toEqual(e.board);

    await changes.ask('swap snacks for French food');
    e.board = { ...e.board, blurb: 'Mine now' };
    expect(changes.canUndo).toBe(false);
    changes.undo();
    expect(e.board.blurb).toBe('Mine now');
    expect(e.board.categories[1].name).toBe('French Food');
  });
});
