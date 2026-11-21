import { describe, expect, it } from 'vitest';
import { NEW_PACK_ID, newPackName, untouched } from './newpack';

const pack = (name: string, songs = 0, id = NEW_PACK_ID + 'x') =>
  ({ id, name, blurb: '', custom: true, songs: Array.from({ length: songs }, (_, i) => ({ title: `S${i}`, artist: 'A', apple: i + 1 })) });

describe('new Earworm packs', () => {
  it('names each new pack apart from the ones on the phone', () => {
    expect(newPackName([])).toBe('My songs');
    expect(newPackName([{ name: 'My songs' }, { name: 'my songs 2' }])).toBe('My songs 3');
  });

  it('treats only an empty, unrenamed, unreviewed new pack as untouched', () => {
    expect(untouched(pack('My songs 2'), false)).toBe(true);
    expect(untouched(pack('My songs 2'), true)).toBe(false);
    expect(untouched(pack('My songs', 1), false)).toBe(false);
    expect(untouched(pack('Road trip'), false)).toBe(false);
    expect(untouched(pack('My songs', 0, 'imported'), false)).toBe(false);
    expect(untouched({ ...pack('My songs'), custom: false }, false)).toBe(false);
  });
});
