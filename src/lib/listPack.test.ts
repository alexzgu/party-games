import { describe, expect, it } from 'vitest';
import { addItems, editProblem, listEntry, parseLists, removeItem, setItem } from './listPack';
import { cardList, HAND_LISTS } from '../games/hand/rules';
import { SKETCH_LISTS } from '../games/sketch/rules';
import { BRAWL_LISTS } from '../games/brawl/rules';

const hand = { id: 'dorms', name: 'Dorms', blurb: '', prompts: ['My RA wrote me up for ___'], answers: ['Spite'] };

describe('list packs', () => {
  it('sorts pasted Bad Hand cards into prompts and answers, tidied, and says why lines were skipped', () => {
    const r = parseLists('1. what got me through finals?\n- my RA wrote me up for _____\n"a rice cooker."\nA rice cooker\nThis has no blank and no question\n___ ___ ___ everywhere', HAND_LISTS, cardList);
    expect(r.items).toEqual([
      { field: 'prompts', text: 'What got me through finals?' },
      { field: 'prompts', text: 'My RA wrote me up for ___' },
      { field: 'answers', text: 'A rice cooker' },
      { field: 'answers', text: 'This has no blank and no question' },
    ]);
    expect(r.skipped).toEqual(['repeated', 'prompt more than two blanks']);
  });

  it('pastes into the list the player picked (Sketchy) and checks each line by its rules', () => {
    const r = parseLists('Tent\nCamp fire!\nA bear\nR2-D2', SKETCH_LISTS, () => 'words');
    expect(r.items.map((i) => i.text)).toEqual(['Tent', 'Camp fire', 'A bear']);
    expect(r.skipped).toEqual(['word letters, spaces, hyphens and apostrophes only']);
    expect(parseLists('Solo\nBest at naps.', BRAWL_LISTS, () => 'titles')).toEqual({ items: [{ field: 'titles', text: 'Best at naps' }], skipped: ['too short'] });
  });

  it('puts new items on top of each list, leaving out ones the pack has', () => {
    const next = addItems(hand, HAND_LISTS, [{ field: 'answers', text: 'Glitter' }, { field: 'answers', text: 'spite' }, { field: 'prompts', text: 'Why is ___ my problem?' }]);
    expect([next.prompts, next.answers]).toEqual([['Why is ___ my problem?', 'My RA wrote me up for ___'], ['Glitter', 'Spite']]);
  });

  it('edits, adds and removes one item, refusing a broken or repeated one', () => {
    expect(setItem(hand, 'answers', 'new', 'Glitter').answers).toEqual(['Glitter', 'Spite']);
    expect(setItem(hand, 'answers', 0, 'Glitter').answers).toEqual(['Glitter']);
    expect(removeItem(hand, 'prompts', 0).prompts).toEqual([]);
    const [prompts, answers] = HAND_LISTS;
    expect(editProblem(hand, answers, 'new', 'Glitter!')).toBe('');
    expect(editProblem(hand, answers, 'new', 'Spite')).toBe('That answer is already in this pack.');
    expect(editProblem(hand, answers, 0, 'Spite')).toBe('');
    expect(editProblem(hand, prompts, 'new', 'No blank here')).toBe('That prompt cannot be used: no blank (___) and not a question.');
    expect(editProblem(hand, prompts, 'new', '')).toBe('Type a prompt first.');
    // A blank counts as one word, as in the content gate.
    expect(['Why ___?', '___, ___', 'Why is ___?'].map(prompts.problem)).toEqual(['too short', 'too short', '']);
  });

  it('shows a pack in the pack list with every list, or one list when the game counts one', () => {
    expect(listEntry(HAND_LISTS, hand, false)).toMatchObject({ size: 2, sizeLabel: '1 prompt · 1 answer' });
    const camp = { id: 'camp', name: 'Camp', blurb: '', words: ['Tent', 'Canoe'], ideas: ['A bear on a canoe'], custom: true };
    expect(listEntry(SKETCH_LISTS, camp, false, 'ideas')).toMatchObject({ size: 1, sizeLabel: '1 idea', tag: 'Mine' });
  });
});
