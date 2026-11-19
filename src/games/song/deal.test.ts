import { describe, expect, it } from 'vitest';
import { makeDealer, packNames } from './deal';
import { songKey } from './logic';
import { songPacks } from '../../lib/content';

describe('Earworm dealer', () => {
  const pack = songPacks()[0];

  it('never deals a song already used this game, nor one without a preview', () => {
    const none = songKey(pack.songs[0]);
    const dealer = makeDealer([pack.id], [none]);
    const dealt: string[] = [];
    for (let i = 0; i < pack.songs.length - 1; i++) {
      const s = dealer.next(dealt)!;
      expect(dealt).not.toContain(songKey(s));
      expect(songKey(s)).not.toBe(none);
      dealt.push(songKey(s));
    }
    const dropped = songKey(dealer.next(dealt)!);
    dealer.drop(dropped);
    for (let i = 0; i < 30; i++) expect(songKey(dealer.next([])!)).not.toBe(dropped);
  });

  it('lists the Apple ids to look up, names the packs, and deals nothing from no packs', () => {
    expect(makeDealer([pack.id]).appleIds()).toEqual(pack.songs.map((s) => s.apple));
    expect(packNames([pack.id])).toEqual([pack.name]);
    expect(makeDealer([]).next()).toBeNull();
  });
});
