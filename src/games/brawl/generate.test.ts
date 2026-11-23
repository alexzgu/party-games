import { describe, expect, it } from 'vitest';
import { readLine } from '../../lib/listWizard';
import { WIZARD } from './generate';
import { dealTitles } from './pack';

describe('Doodle Brawl wizard lines and title pool', () => {
  it('reads a title with or without its label, and drops lines that break the rules', () => {
    expect(readLine(WIZARD, 'Title: best-dressed at a funeral.')).toEqual({ field: 'titles', text: 'Best-dressed at a funeral' });
    expect(readLine(WIZARD, "- World's okayest intern")).toEqual({ field: 'titles', text: "World's okayest intern" });
    expect(readLine(WIZARD, 'Title: Champion')).toBeNull(); // one word
    expect(readLine(WIZARD, `Title: ${'very '.repeat(8)}tired`)).toBeNull(); // over 8 words
  });

  it("deals the picked packs' titles first, then the others', never one twice", () => {
    const keep = <T,>(xs: T[]) => xs;
    const packs = [
      { id: 'mine', name: 'Mine', blurb: '', titles: ['Best at naps', 'Worst at naps'] },
      { id: 'classic', name: 'Classic', blurb: '', titles: ['Best at naps!', 'King of snacks'] },
    ];
    expect(dealTitles(packs, ['mine'], keep)).toEqual(['Best at naps', 'Worst at naps', 'King of snacks']);
  });
});
