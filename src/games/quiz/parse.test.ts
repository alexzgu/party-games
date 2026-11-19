import { describe, expect, it } from 'vitest';
import { parsePastedBoard, parseStreamLine } from './parse';

describe('pasted boards', () => {
  it('reads "# Category" then "clue | answer" lines', () => {
    const { board, skipped } = parsePastedBoard('# Space\nRed planet | Mars\nFirst on the Moon | Neil Armstrong\n# Food\nPizza country | Italy\nSushi country | Japan', 'My quiz');
    expect(skipped).toEqual([]);
    expect(board!.name).toBe('My quiz');
    expect(board!.categories).toEqual([
      { name: 'Space', clues: [{ clue: 'Red planet', answer: 'Mars' }, { clue: 'First on the Moon', answer: 'Neil Armstrong' }] },
      { name: 'Food', clues: [{ clue: 'Pizza country', answer: 'Italy' }, { clue: 'Sushi country', answer: 'Japan' }] },
    ]);
  });
  it('is tolerant: other heading styles, list markers, labels, value columns, tables', () => {
    const text = [
      '**Space**', '1. Q: Red planet | A: Mars', '- 200 | First on the Moon | Neil Armstrong',
      'Category 2: Food', '| # | Clue | Answer |', '|---|---|---|', '| 1 | Pizza country | Italy |',
      '## Numbers ##', 'Legs on a spider | 8', 'just a remark',
    ].join('\n');
    const { board, skipped } = parsePastedBoard(text);
    expect(board!.categories.map((c) => c.name)).toEqual(['Space', 'Food', 'Numbers']);
    expect(board!.categories[0].clues).toEqual([{ clue: 'Red planet', answer: 'Mars' }, { clue: 'First on the Moon', answer: 'Neil Armstrong' }]);
    expect(board!.categories[1].clues[0]).toEqual({ clue: 'Pizza country', answer: 'Italy' });
    expect(board!.categories[2].clues[0]).toEqual({ clue: 'Legs on a spider', answer: '8' });
    expect(skipped).toEqual(["not in 'clue | answer' form"]);
  });
  it('pads short categories with empty tiles and puts clues before any heading in "Category 1"', () => {
    const { board } = parsePastedBoard('A | a\nB | b\n# Two\nC | c');
    expect(board!.categories).toEqual([
      { name: 'Category 1', clues: [{ clue: 'A', answer: 'a' }, { clue: 'B', answer: 'b' }] },
      { name: 'Two', clues: [{ clue: 'C', answer: 'c' }, { clue: '', answer: '' }] },
    ]);
  });
  it('reads streamed lines too, in level order, and skips repeats and overflow', () => {
    const lines = ['Space | 2 | Hard one | Pluto', 'Space | 1 | Easy one | Mars', 'Space | 1 | Easy one | Mars'];
    for (let i = 0; i < 9; i++) lines.push(`Cat${i} | 1 | clue ${i} | ans ${i}`);
    const { board, skipped } = parsePastedBoard(lines.join('\n'));
    expect(board!.categories[0].clues.map((k) => k.answer)).toEqual(['Mars', 'Pluto']);
    expect(board!.categories).toHaveLength(8);
    expect(skipped).toEqual(['repeated clue', 'past 8 categories', 'past 8 categories']); // Cat7, Cat8
  });
  it('finds nothing in text without clues', () => {
    expect(parsePastedBoard('hello\n# Only a heading').board).toBeNull();
  });
});

describe('streamed lines', () => {
  it('reads "Category | level | clue | answer"', () => {
    expect(parseStreamLine('Space | 1 | The Red Planet. | Mars')).toEqual({ category: 'Space', level: 1, clue: 'The Red Planet.', answer: 'Mars' });
  });
  it('takes levels written as values or words, and drops list markers and labels', () => {
    expect(parseStreamLine('- Space | 300 | Clue: Ringed giant | Answer: Saturn')).toEqual({ category: 'Space', level: 3, clue: 'Ringed giant', answer: 'Saturn' });
    expect(parseStreamLine('Space | Level 2 | X | Y')!.level).toBe(2);
  });
  it('ignores headers, remarks and incomplete lines', () => {
    expect(parseStreamLine('Category | Level | Clue | Answer')).toBeNull();
    expect(parseStreamLine('Here is your board:')).toBeNull();
    expect(parseStreamLine('Space | 1 | Clue only |')).toBeNull();
  });
});
