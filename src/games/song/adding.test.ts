import { describe, expect, it, vi } from 'vitest';
import { Adder, rematchWanted, toSong, type AdderDeps } from './adding';
import { parsePaste, tidy, wantedKey, type Track } from './match';
import { spotifyTitle } from './spotify';
import { PlaylistError } from './youtube';

const T = (id: number, title: string, artist: string, preview = `https://p/${id}.m4a`): Track =>
  ({ id, title, artist, album: title, artwork: '', preview, link: '', released: '' });

const library = [T(1, 'Toxic', 'Britney Spears'), T(2, 'Hey Ya!', 'Outkast'), T(3, 'Timber (feat. Ke$ha)', 'Pitbull'), T(4, 'Hey Ya!', 'Outkast Tribute Band')];

function fakeDeps(over: Partial<AdderDeps> = {}): AdderDeps & { searches: string[] } {
  const searches: string[] = [];
  return {
    searches,
    search: async (term) => { searches.push(term); return library.filter((t) => term.toLowerCase().includes(t.title.toLowerCase().split(' ')[0])); },
    lookup: async (id) => library.find((t) => t.id === id) ?? null,
    oembed: async (id) => ({ title: id === 'vvvvvvvvvv1' ? 'Pitbull - Timber ft. Ke$ha (Official Video)' : 'Outkast - Hey Ya! (Official HD Video)', author: 'VEVO' }),
    readPlaylist: async () => ['vvvvvvvvvv1', 'vvvvvvvvvv2'],
    ...over,
  };
}

const settle = () => new Promise((r) => setTimeout(r, 0));
async function until(a: Adder) { for (let i = 0; i < 50 && (a.busy || a.waiting); i++) await settle(); }

describe('Add songs review list', () => {
  it('matches pasted lines one by one, skips repeats, and marks songs already in the pack', async () => {
    const deps = fakeDeps();
    const a = new Adder(deps, [{ apple: 1, title: 'Toxic', artist: 'Britney Spears' }], () => {});
    a.add(parsePaste('Toxic - Britney Spears\nHey Ya! - Outkast\nHey Ya! - Outkast\nNothing At All - Nobody'));
    await until(a);
    expect(a.items.map((i) => [i.match?.track?.id ?? null, i.keep, i.dup])).toEqual([[1, false, true], [2, true, false], [null, false, false]]);
    expect(a.done).toBe(3);
    expect(a.kept().map((i) => toSong(i, tidy))).toEqual([{ title: 'Hey Ya!', artist: 'Outkast', apple: 2 }]);
    // Adding the same lines again does nothing.
    expect(a.add(parsePaste('Hey Ya! - Outkast'))).toBe(0);
  });

  it('turns a playlist into its videos, keeping each YouTube id for the reveal', async () => {
    const a = new Adder(fakeDeps(), [], () => {});
    a.add(parsePaste('https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG'));
    await until(a);
    expect(a.total).toBe(2);
    expect(a.kept().map((i) => toSong(i, tidy))).toEqual([
      { title: 'Timber', artist: 'Pitbull ft. Ke$ha', apple: 3, youtube: 'vvvvvvvvvv1' },
      { title: 'Hey Ya!', artist: 'Outkast', apple: 2, youtube: 'vvvvvvvvvv2' },
    ]);
  });

  it('creates one row per unique playlist video in first-seen order', async () => {
    const deps = fakeDeps({ readPlaylist: async () => ['vvvvvvvvvv1', 'vvvvvvvvvv1', 'vvvvvvvvvv2'] });
    const a = new Adder(deps, [], () => {});
    a.add(parsePaste('https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG'));
    await until(a);
    expect(a.items.slice(1).map((item) => item.key)).toEqual(['yt:vvvvvvvvvv1', 'yt:vvvvvvvvvv2']);
  });

  it('offers retry while only a playlist is waiting', async () => {
    const readPlaylist = vi.fn<AdderDeps['readPlaylist']>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(['vvvvvvvvvv1']);
    const a = new Adder(fakeDeps({ readPlaylist }), [], () => {});
    a.add(parsePaste('https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG'));
    await settle();
    expect(a.busy).toBe(false);
    expect(a.error).toContain('Try again');
    expect(a.waiting).toBe(1);
    expect(a.total).toBe(0);
    a.resume();
    await until(a);
    expect(a.waiting).toBe(0);
    expect(a.kept()).toHaveLength(1);
  });

  it('skips a playlist YouTube will not list, marked for retry, and goes on with the rest', async () => {
    const readPlaylist = vi.fn<AdderDeps['readPlaylist']>()
      .mockRejectedValueOnce(new PlaylistError('playlist'))
      .mockResolvedValueOnce(['vvvvvvvvvv1']);
    const a = new Adder(fakeDeps({ readPlaylist }), [], () => {});
    a.add(parsePaste('https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG\nHey Ya! - Outkast'));
    await until(a);
    expect(a.error).toBe('');
    expect(a.items[0]).toMatchObject({ state: 'done', match: { track: null, retry: true, why: 'That YouTube playlist can’t be read: it may be private or empty' } });
    expect(a.kept().map((i) => i.match?.track?.id)).toEqual([2]);
    // Pasting it again tries it again.
    expect(a.add(parsePaste('https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG'))).toBe(1);
    await until(a);
    expect(a.kept().map((i) => i.match?.track?.id)).toEqual([3, 2]);
  });

  it.each(['saving', 'leaving'])('detaches the draft writer when %s during a lookup', async (action) => {
    let finish!: (track: Track) => void;
    const pending = new Promise<Track>((resolve) => { finish = resolve; });
    const persist = vi.fn();
    const a = new Adder(fakeDeps({ lookup: (id) => id === 1 ? Promise.resolve(library[0]) : pending }), [], persist);
    a.add(parsePaste('https://music.apple.com/us/album/toxic/78?i=1\nhttps://music.apple.com/us/album/hey-ya/79?i=2'));
    await settle();
    expect(a.kept()).toHaveLength(1);
    expect(a.busy).toBe(true);
    a.close();
    if (action === 'saving') persist(null);
    const writes = persist.mock.calls.length;
    finish(library[1]);
    await settle();
    expect(a.busy).toBe(false);
    expect(persist).toHaveBeenCalledTimes(writes);
  });

  it('lets the host drop a match or pick another result', async () => {
    const a = new Adder(fakeDeps(), [], () => {});
    a.add(parsePaste('Hey Ya! - Outkast'));
    await until(a);
    const it = a.items[0];
    expect(it.match?.others.map((t) => t.id)).toContain(4);
    a.choose(it.key, library[3]);
    expect(a.items[0].match?.track?.id).toBe(4);
    expect(a.items[0].match?.others.map((t) => t.id)).toContain(2);
    a.toggle(it.key);
    expect(a.kept()).toEqual([]);
  });

  it('recomputes the "already in the list" mark when another row changes', async () => {
    const a = new Adder(fakeDeps(), [], () => {});
    a.add(parsePaste('Hey Ya! - Outkast\nhttps://music.apple.com/us/album/hey-ya/79?i=2'));
    await until(a);
    const [first, second] = a.items;
    expect([first.keep, first.dup, second.keep, second.dup]).toEqual([true, false, false, true]);
    // Unticking the first lets the host keep the second instead.
    a.toggle(first.key);
    expect(a.items[1].dup).toBe(false);
    a.toggle(second.key);
    expect(a.kept().map((i) => i.key)).toEqual([second.key]);
    expect(a.items[0].dup).toBe(true);
    // Picking another song for a kept row hands its old song to the row that was its repeat.
    a.toggle(second.key);
    a.toggle(first.key);
    a.choose(first.key, library[3]);
    expect(a.kept().map((i) => i.match?.track?.id)).toEqual([4, 2]);
    expect(a.items.map((i) => i.dup)).toEqual([false, false]);
  });

  it('settles a saved song whose rematch is already in the pack, so it stops asking for one', async () => {
    const a = new Adder(fakeDeps(), [{ apple: 2, title: 'Hey Ya!', artist: 'Outkast' }], () => {});
    a.add([rematchWanted({ title: 'Hey Ya!', artist: 'Outkast' }), rematchWanted({ title: 'Toxic', artist: 'Britney Spears' }), rematchWanted({ title: 'Nothing At All', artist: 'Nobody' })]);
    await until(a);
    expect(a.kept().map((i) => i.match?.track?.id)).toEqual([1]);
    expect([...a.settled()]).toEqual([wantedKey(rematchWanted({ title: 'Hey Ya!', artist: 'Outkast' })), wantedKey(rematchWanted({ title: 'Toxic', artist: 'Britney Spears' }))]);
  });

  it('pauses on a network failure without losing the line, and carries on when asked', async () => {
    let down = true;
    const deps = fakeDeps({ search: async (term) => { if (down) throw new Error('offline'); return library.filter((t) => term.includes('Toxic') && t.id === 1); } });
    const a = new Adder(deps, [], () => {});
    a.add(parsePaste('Toxic - Britney Spears'));
    await until(a);
    expect(a.error).not.toBe('');
    expect(a.items[0].state).toBe('waiting');
    down = false;
    a.resume();
    await until(a);
    expect(a.error).toBe('');
    expect(a.items[0].match?.track?.id).toBe(1);
  });

  it('turns a Spotify link into its title with artist N/A, to check, and keeps the picked track’s artist', async () => {
    const titles: Record<string, string> = { '4cOdK2wGLETKBW3PvgPWqT': 'Hey Ya!', '3n3Ppam7vgaVa1iaRUc9Lp': 'Nothing Like It' };
    const fetch = vi.fn(async (url: string) => {
      const id = /track%2F([A-Za-z0-9]{22})$/.exec(url)?.[1] ?? '';
      if (id === '0000000000000000000000') return new Response('busy', { status: 503 });
      return titles[id] ? new Response(JSON.stringify({ title: titles[id] })) : new Response('{}', { status: 404 });
    });
    vi.stubGlobal('fetch', fetch);
    try {
      const a = new Adder({ ...fakeDeps(), spotifyTitle }, [], () => {});
      a.add(parsePaste([
        'https://open.spotify.com/track/0000000000000000000000?si=x',
        'https://open.spotify.com/intl-de/track/4cOdK2wGLETKBW3PvgPWqT?si=y',
        'spotify:track:3n3Ppam7vgaVa1iaRUc9Lp',
        'Toxic - Britney Spears',
        'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
      ].join('\n')));
      await until(a);
      expect(a.error).toBe('');
      const [failed, heyYa, unknown, toxic, playlist] = a.items;
      // Spotify failing for one line leaves the rest going.
      expect(failed.match).toMatchObject({ track: null, retry: true });
      expect(heyYa.match).toMatchObject({ track: { id: 2 }, sure: false, linked: { title: 'Hey Ya!', artist: 'N/A' } });
      expect(heyYa.keep).toBe(true);
      expect(heyYa.match?.others.map((t) => t.id)).toContain(4);
      expect(unknown.match).toMatchObject({ track: null, linked: { title: 'Nothing Like It', artist: 'N/A' } });
      expect(toxic.match).toMatchObject({ track: { id: 1 }, sure: true });
      expect(playlist.match).toMatchObject({ track: null, why: 'Spotify playlists can’t be read here: paste the songs’ links instead' });
      a.choose(heyYa.key, library[3]);
      expect(toSong(a.items[1], tidy)).toEqual({ title: 'Hey Ya!', artist: 'Outkast Tribute Band', apple: 4 });
      // Pasting the failed link again tries it again; the others stay as they are.
      expect(a.add(parsePaste('https://open.spotify.com/track/0000000000000000000000\nspotify:track:4cOdK2wGLETKBW3PvgPWqT'))).toBe(1);
      expect(a.items[0].state).not.toBe('done');
      await until(a);
      expect(fetch.mock.calls.filter(([u]) => u.includes('0000000000000000000000'))).toHaveLength(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('restores a saved list and finishes it', async () => {
    const first = new Adder(fakeDeps(), [], () => {});
    first.add(parsePaste('Toxic - Britney Spears'));
    first.stop();
    const saved = JSON.parse(JSON.stringify(first.items.map((i) => ({ ...i, state: 'matching' }))));
    const again = new Adder(fakeDeps(), [], () => {}, saved);
    expect(again.waiting).toBe(1);
    again.resume();
    await until(again);
    expect(again.kept()).toHaveLength(1);
  });
});
