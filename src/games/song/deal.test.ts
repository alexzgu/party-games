import { describe, expect, it, vi } from 'vitest';
import { makeDealer, packNames } from './deal';
import { save } from '../../lib/storage';
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

  it('keeps YouTube-era songs available to rematch and out of the playable count', () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    try {
      const old = { title: 'Old Song', artist: 'An Artist', youtube: 'abcdefghijk', start: 60 };
      save('custom:songs', [
        { id: 'old', name: 'Old', songs: [old], custom: true },
        { id: 'mixed', name: 'Mixed', songs: [old, pack.songs[0]], custom: true },
        { id: pack.id, name: 'Edited name', songs: [old] },
      ]);
      expect(songPacks().find((p) => p.id === 'old')).toMatchObject({
        songs: [], legacySongs: [{ title: old.title, artist: old.artist }],
      });
      expect(makeDealer(['old']).total).toBe(0);
      expect(makeDealer(['mixed']).appleIds()).toEqual([pack.songs[0].apple]);
      expect(makeDealer([pack.id]).appleIds()).toEqual(pack.songs.map((song) => song.apple));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('deals a song with no Apple track only on a phone with its clip, and only clip songs when offline', () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    try {
      const only = { title: 'Unreleased', artist: 'A Friend', youtube: 'zyxwvutsrqp', clipOnly: true as const };
      const [a, b] = pack.songs;
      save('custom:songs', [{ id: 'clipped', name: 'Clipped', songs: [only, a, b], custom: true }]);
      const without = makeDealer(['clipped']);
      expect(without.total).toBe(2);
      for (let i = 0; i < 30; i++) expect(songKey(without.next([])!)).not.toBe('yt:zyxwvutsrqp');
      expect(without.clipsOnly()).toBe(false);

      const clipped = makeDealer(['clipped'], [], new Set(['yt:zyxwvutsrqp', String(a.apple)]));
      expect(clipped.total).toBe(3);
      expect(clipped.hasClip(only)).toBe(true);
      expect(clipped.hasClip(b)).toBe(false);
      expect(clipped.appleIds()).toEqual([b.apple]);
      expect(clipped.clipsOnly()).toBe(true);
      const keys = new Set(Array.from({ length: 30 }, () => songKey(clipped.next([])!)));
      expect(keys).toEqual(new Set(['yt:zyxwvutsrqp', String(a.apple)]));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('lists the Apple ids to look up, names the packs, and deals nothing from no packs', () => {
    expect(makeDealer([pack.id]).appleIds()).toEqual(pack.songs.map((s) => s.apple));
    expect(packNames([pack.id])).toEqual([pack.name]);
    expect(makeDealer([]).next()).toBeNull();
  });
});
