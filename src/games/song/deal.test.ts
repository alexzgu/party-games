import { describe, expect, it } from 'vitest';
import { makeDealer, packNames } from './deal';
import { songPacks } from '../../lib/content';

describe('Earworm dealer', () => {
  const pack = songPacks()[0];

  it('never deals a song already used this game, nor one YouTube refused', () => {
    const dealer = makeDealer([pack.id], [pack.songs[0].youtube]);
    const dealt: string[] = [];
    for (let i = 0; i < pack.songs.length - 1; i++) {
      const s = dealer.next(dealt)!;
      expect(dealt).not.toContain(s.youtube);
      expect(s.youtube).not.toBe(pack.songs[0].youtube);
      dealt.push(s.youtube);
    }
    const dropped = dealer.next(dealt)!.youtube;
    dealer.drop(dropped);
    for (let i = 0; i < 30; i++) expect(dealer.next([])?.youtube).not.toBe(dropped);
  });

  it('names the packs for history and deals nothing from no packs', () => {
    expect(packNames([pack.id])).toEqual([pack.name]);
    expect(makeDealer([]).next()).toBeNull();
  });
});
