import { describe, expect, it } from 'vitest';
import { checked } from '../../lib/listSpec';
import { parseLists } from '../../lib/listPack';
import { cleanPublish } from '../../lib/libraryShape';
import { ANSWER_MAX, CATEGORY_MAX, LINE_MAX, QUESTION_MAX, TRIVIA_LISTS, parts, triviaKey, triviaProblem } from './rules';

const [spec] = TRIVIA_LISTS;
const good = 'Science | What gas do plants take in from the air? | Carbon dioxide | Oxygen | Nitrogen | Helium';
/** `good` with part `i` replaced. */
const swap = (i: number, text: string) => good.split(' | ').map((p, j) => (j === i ? text : p)).join(' | ');

describe('Smarty Pants questions', () => {
  it('splits a line into its category, question, right answer and three wrong ones', () => {
    expect(parts(good)).toEqual({ category: 'Science', question: 'What gas do plants take in from the air?', right: 'Carbon dioxide', wrong: ['Oxygen', 'Nitrogen', 'Helium'] });
  });

  it('tidies each part without reordering anything', () => {
    expect(checked(spec, '  Science|What gas do  plants take in from the air?|Carbon dioxide.| Oxygen |Nitrogen|Helium. ')).toBe(good);
  });

  it('says why a line cannot be used', () => {
    expect(triviaProblem(good)).toBe('');
    expect(triviaProblem(good.split(' | ').slice(0, 5).join(' | '))).toBe('needs six parts');
    expect(triviaProblem(`${good} | Argon`)).toBe('needs six parts');
    expect(triviaProblem(swap(3, '?'))).toBe('has an empty part');
    expect(triviaProblem(swap(0, 'Very Hard Science Stuff'))).toBe('category too long');
    expect(triviaProblem(swap(0, 'S'.repeat(CATEGORY_MAX + 1)))).toBe('category too long');
    expect(triviaProblem(swap(1, 'Plants breathe what?'))).toBe('');
    expect(triviaProblem(swap(1, 'Plants breathe?'))).toBe('question too short');
    expect(triviaProblem(swap(1, `What ${'very '.repeat(29)}gas?`))).toBe('question too long');
    expect(triviaProblem(swap(1, `What is ${'x'.repeat(QUESTION_MAX)}?`))).toBe('question too long');
    expect(triviaProblem(swap(2, 'one two three four five six seven'))).toBe('answer too long');
    expect(triviaProblem(swap(4, 'x'.repeat(ANSWER_MAX + 1)))).toBe('answer too long');
    expect(triviaProblem(swap(5, 'CARBON  dioxide!'))).toBe('answers repeat');
    expect(triviaProblem(swap(0, 'science'))).toBe('starts oddly');
    expect(triviaProblem(swap(1, 'what gas do plants take in?'))).toBe('starts oddly');
    expect(triviaProblem(swap(0, '80s Music'))).toBe('');
  });

  it('counts the same question with other answers or category as one', () => {
    expect(triviaKey(swap(0, 'Nature'))).toBe(triviaKey(swap(1, 'what GAS do plants take in from the air')));
    expect(triviaKey(good)).not.toBe(triviaKey(swap(1, 'What gas do plants give off?')));
  });

  it('keeps only usable questions from a pasted list', () => {
    const pasted = `1. ${good}\n- Science | Name a gas | Oxygen | Helium\n${swap(0, 'Nature')}\nscience | Which planet is red? | Mars | Venus | Earth | Pluto`;
    expect(parseLists(pasted, TRIVIA_LISTS, () => 'questions')).toEqual({
      items: [{ field: 'questions', text: good }],
      skipped: ['needs six parts', 'repeated', 'starts oddly'],
    });
  });

  it('lets the Community library hold the longest line the rules allow', () => {
    const longest = ['C'.repeat(CATEGORY_MAX), `Q q ${'q'.repeat(QUESTION_MAX - 4)}`, ...['a', 'b', 'c', 'd'].map((x) => `${x.toUpperCase()} ${x.repeat(ANSWER_MAX - 2)}`)].join(' | ');
    expect([longest.length, triviaProblem(longest)]).toEqual([LINE_MAX, '']);
    expect(cleanPublish('trivia', [longest], {})).toMatchObject({ items: [longest] });
  });
});
