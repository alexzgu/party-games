import { describe, expect, it } from 'vitest';
import {
  appleFrom, art, channelArtist, cleanVideoTitle, matchWanted, normalize, parseLine, parsePaste, rank, similarity, tidy, toTrack, youtubeFrom,
  type MatchDeps, type Track,
} from './match';

const T = (id: number, title: string, artist: string, album = title, preview = `https://p/${id}.m4a`, released = '2004-01-01'): Track =>
  ({ id, title, artist, album, artwork: `https://a/${id}/100x100bb.jpg`, preview, link: `https://music.apple.com/us/song/${id}`, released });

describe('reading links', () => {
  it('finds the video in every YouTube link form', () => {
    const id = 'dQw4w9WgXcQ';
    for (const link of [
      `https://www.youtube.com/watch?v=${id}`,
      `https://youtube.com/watch?v=${id}&list=PL1234567890abc&index=3`,
      `youtube.com/watch?feature=share&v=${id}`,
      `https://m.youtube.com/watch?v=${id}&t=43s`,
      `https://music.youtube.com/watch?v=${id}&si=abc`,
      `https://youtu.be/${id}?si=xyz`,
      `youtu.be/${id}`,
      `https://www.youtube.com/shorts/${id}`,
      `https://www.youtube.com/embed/${id}?start=4`,
      `https://www.youtube-nocookie.com/embed/${id}`,
      `https://www.youtube.com/live/${id}`,
    ]) expect(youtubeFrom(link), link).toEqual({ video: id });
  });

  it('finds playlists, and refuses radio mixes and other sites', () => {
    expect(youtubeFrom('https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG')).toEqual({ list: 'PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG' });
    expect(youtubeFrom('https://music.youtube.com/playlist?list=OLAK5uy_kXyz1234567890')).toEqual({ list: 'OLAK5uy_kXyz1234567890' });
    expect(youtubeFrom('https://www.youtube.com/watch?list=RDdQw4w9WgXcQ')).toEqual({});
    expect(youtubeFrom('https://youtube.com/playlist?list=PLfrCXry7dQ84')).toEqual({ cut: true });
    expect(parseLine('https://youtube.com/playlist?list=PLfrCXry7dQ84')).toMatchObject({ kind: 'skip', why: expect.stringContaining('cut off') });
    expect(youtubeFrom('https://vimeo.com/watch?v=dQw4w9WgXcQ')).toBeNull();
  });

  it('finds the song in Apple Music links', () => {
    expect(appleFrom('https://music.apple.com/us/album/mr-brightside/1526194184?i=1526194192')).toBe(1526194192);
    expect(appleFrom('https://music.apple.com/us/album/mr-brightside/1526194184?i=1526194192&uo=4')).toBe(1526194192);
    expect(appleFrom('https://music.apple.com/gb/song/mr-brightside/1526194192')).toBe(1526194192);
    expect(appleFrom('https://music.apple.com/us/song/1526194192')).toBe(1526194192);
    expect(appleFrom('https://itunes.apple.com/us/album/hot-fuss/1526194184?i=1526194192')).toBe(1526194192);
    expect(appleFrom('https://music.apple.com/us/album/hot-fuss/1526194184')).toBe(0);
    expect(appleFrom('https://example.com/song/1')).toBeNull();
  });
});

describe('reading pasted lines', () => {
  it('reads links inside list items, markdown and prose', () => {
    expect(parseLine('1. https://youtu.be/dQw4w9WgXcQ')).toMatchObject({ kind: 'youtube', id: 'dQw4w9WgXcQ' });
    expect(parseLine('- [Never Gonna Give You Up](https://www.youtube.com/watch?v=dQw4w9WgXcQ)')).toMatchObject({ kind: 'youtube', id: 'dQw4w9WgXcQ' });
    expect(parseLine('• Rick Astley: https://youtu.be/dQw4w9WgXcQ (the classic)')).toMatchObject({ kind: 'youtube', id: 'dQw4w9WgXcQ' });
    expect(parseLine('https://music.apple.com/us/album/x/1?i=42')).toMatchObject({ kind: 'apple', id: 42 });
    expect(parseLine('https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG')).toMatchObject({ kind: 'playlist' });
    expect(parseLine('https://music.apple.com/us/album/hot-fuss/1526194184')).toMatchObject({ kind: 'skip' });
    expect(parseLine('https://example.com/a-song')).toMatchObject({ kind: 'skip' });
  });

  it('reads "Title - Artist" either way round, with numbering, quotes and years', () => {
    expect(parseLine('12) "Mr. Brightside" - The Killers (2004)')).toMatchObject({
      kind: 'text', query: 'Mr. Brightside The Killers',
      guesses: [{ title: 'Mr. Brightside', artist: 'The Killers' }, { title: 'The Killers', artist: 'Mr. Brightside' }],
    });
    expect(parseLine('Toxic | Britney Spears')).toMatchObject({ guesses: [{ title: 'Toxic', artist: 'Britney Spears' }, expect.anything()] });
    expect(parseLine('**Outkast — Hey Ya!**')).toMatchObject({ guesses: [{ title: 'Outkast', artist: 'Hey Ya!' }, { title: 'Hey Ya!', artist: 'Outkast' }] });
    expect(parseLine('Stand by Me by Ben E. King')).toMatchObject({ guesses: [{ title: 'Stand by Me', artist: 'Ben E. King' }, { title: 'Stand by Me by Ben E. King', artist: '' }] });
    expect(parseLine('Stand by Me')).toMatchObject({ guesses: [{ title: 'Stand', artist: 'Me' }, { title: 'Stand by Me', artist: '' }] });
  });

  it('skips blanks, headings, table rules and repeats', () => {
    const got = parsePaste('## 2000s pop punk\n\n| # | Title | Artist |\n|---|---|---|\n| 1 | Welcome to the Black Parade | My Chemical Romance |\n1. Sugar, We\'re Goin Down - Fall Out Boy\n2. Sugar, We\'re Goin Down - Fall Out Boy\n```\nhttps://youtu.be/dQw4w9WgXcQ\nhttps://youtu.be/dQw4w9WgXcQ\n```');
    expect(got.map((w) => w.kind)).toEqual(['text', 'text', 'youtube']);
    expect(got[0]).toMatchObject({ guesses: [{ title: 'Welcome to the Black Parade', artist: 'My Chemical Romance' }, expect.anything()] });
  });
});

describe('cleaning YouTube titles', () => {
  it('drops the decoration and splits artist from title', () => {
    expect(cleanVideoTitle('The Killers - Mr. Brightside (Official Music Video)', 'TheKillersVEVO')).toEqual({ artist: 'The Killers', title: 'Mr. Brightside' });
    expect(cleanVideoTitle('Pitbull - Timber ft. Ke$ha', 'PitbullVEVO')).toEqual({ artist: 'Pitbull', title: 'Timber' });
    expect(cleanVideoTitle('Mark Ronson - Uptown Funk (Official Video) ft. Bruno Mars', 'Mark Ronson')).toEqual({ artist: 'Mark Ronson', title: 'Uptown Funk' });
    expect(cleanVideoTitle('Queen – Bohemian Rhapsody [Remastered 2011] [HD]', 'Queen Official')).toEqual({ artist: 'Queen', title: 'Bohemian Rhapsody' });
    expect(cleanVideoTitle('Avril Lavigne - Complicated (Lyrics)', 'Some Lyrics Channel')).toEqual({ artist: 'Avril Lavigne', title: 'Complicated' });
    expect(cleanVideoTitle('Billie Eilish - bad guy | Official Music Video', 'BillieEilishVEVO')).toEqual({ artist: 'Billie Eilish', title: 'bad guy' });
    expect(cleanVideoTitle('Rolling in the Deep', 'Adele - Topic')).toEqual({ title: 'Rolling in the Deep', artist: 'Adele' });
    expect(cleanVideoTitle('Single Ladies (Put a Ring on It) HD', 'beyonceVEVO')).toEqual({ title: 'Single Ladies (Put a Ring on It)', artist: 'beyonce' });
  });

  it('turns channel names into artists', () => {
    expect(channelArtist('TaylorSwiftVEVO')).toBe('Taylor Swift');
    expect(channelArtist('Dua Lipa - Topic')).toBe('Dua Lipa');
    expect(channelArtist('Linkin Park')).toBe('Linkin Park');
  });
});

describe('ranking search results', () => {
  it('normalises names and scores similar ones', () => {
    expect(normalize('The Beyoncé & Jay-Z (Remix) feat. X')).toBe('beyonce and jay z');
    expect(normalize("Ke$ha")).toBe('kesha');
    expect(similarity("Livin' on a Prayer", 'Livin On A Prayer')).toBe(1);
    expect(similarity('Single Ladies', 'Single Ladies (Put a Ring on It)')).toBe(1);
    expect(similarity('Toxic', 'Umbrella')).toBeLessThan(0.3);
  });

  it('prefers the original studio recording over live, karaoke, cover and remix versions', () => {
    const results = [
      T(1, 'Hey Ya! (Karaoke Version)', 'Karaoke Hits Band', 'Karaoke Hits Vol. 3'),
      T(2, 'Hey Ya! (Live)', 'Outkast', 'Live at the Garden'),
      T(3, 'Hey Ya!', 'Rockabye Baby!', 'Lullaby Renditions of Outkast'),
      T(4, 'Hey Ya! (Remix)', 'Outkast', 'Hey Ya! Remixes'),
      T(5, 'Hey Ya!', 'Outkast', 'Speakerboxxx/The Love Below', undefined, '2003-09-23'),
      T(6, 'Hey Ya', 'Sleep Token', 'Hey Ya - Single'),
    ];
    const r = rank(results, [{ title: 'Hey Ya', artist: 'Outkast' }]);
    expect(r[0].track.id).toBe(5);
    expect(r[0].score).toBeGreaterThan(0.9);
    // Unless the line asked for that version.
    expect(rank(results, [{ title: 'Hey Ya Live', artist: 'Outkast' }])[0].track.id).toBe(2);
  });

  it('prefers the album to a greatest-hits copy, and anything with a preview', () => {
    const r = rank([
      T(1, 'Mr. Brightside', 'The Killers', 'Direct Hits', undefined, '2003-09-23'),
      T(2, 'Mr. Brightside', 'The Killers', 'Hot Fuss (Deluxe Version)', undefined, '2004-06-07'),
      T(3, 'Mr. Brightside', 'The Killers', 'Hot Fuss', '', '2004-06-07'),
    ], [{ title: 'Mr. Brightside', artist: 'The Killers' }]);
    expect(r.map((x) => x.track.id)).toEqual([2, 1, 3]);
  });
});

describe('matching a line', () => {
  const library = [
    T(10, 'Mr. Brightside', 'The Killers', 'Hot Fuss'),
    T(11, 'Mr. Brightside (Live)', 'The Killers', 'Live from the Royal Albert Hall'),
    T(20, 'Timber (feat. Ke$ha)', 'Pitbull', 'Global Warming: Meltdown'),
    T(30, 'Toxic', 'Britney Spears', 'In the Zone'),
    T(40, 'Mystery Song', 'Nobody Famous', 'B-Sides', ''),
  ];
  const calls: string[] = [];
  const deps: MatchDeps = {
    search: async (term) => {
      calls.push(term);
      const n = normalize(term);
      return library.filter((t) => normalize(t.title).split(' ').some((w) => w.length > 2 && n.includes(w)));
    },
    lookup: async (id) => library.find((t) => t.id === id) ?? null,
    oembed: async (id) => (id === 'aaaaaaaaaaa' ? { title: 'Pitbull - Timber ft. Ke$ha (Official Video)', author: 'PitbullVEVO' } : null),
  };

  it('matches text, keeps the YouTube id, and reads Apple links without a search', async () => {
    const text = await matchWanted(parseLine('The Killers - Mr. Brightside')!, deps);
    expect(text).toMatchObject({ track: { id: 10 }, sure: true });
    expect(text.others.map((t) => t.id)).toContain(11);
    const yt = await matchWanted(parseLine('https://youtu.be/aaaaaaaaaaa')!, deps);
    expect(yt).toMatchObject({ track: { id: 20 }, sure: true, youtube: 'aaaaaaaaaaa' });
    calls.length = 0;
    expect(await matchWanted(parseLine('https://music.apple.com/us/song/toxic/30')!, deps)).toMatchObject({ track: { id: 30 }, sure: true });
    expect(calls).toEqual([]);
  });

  it('finds an original buried under remixes by looking through the artist’s own songs', async () => {
    const remixes = [T(50, 'Poker Face (Space Cowboy Remix)', 'Lady Gaga', 'Poker Face (Remixes) - EP'), T(51, 'Poker Face', 'Vitamin String Quartet', 'VSQ Performs Lady Gaga')];
    const theirs = [T(52, 'Just Dance', 'Lady Gaga', 'The Fame'), T(53, 'Poker Face', 'Lady Gaga', 'The Fame')];
    const asked: string[] = [];
    const m = await matchWanted(parseLine('Poker Face - Lady Gaga')!, {
      ...deps, search: async () => remixes, artistSongs: async (a) => { asked.push(a); return theirs; },
    });
    expect(m).toMatchObject({ track: { id: 53 }, sure: true });
    expect(asked).toEqual(['Lady Gaga']);
  });

  it('marks doubtful matches and says why nothing matched', async () => {
    expect(await matchWanted(parseLine('Mystery Song - Nobody Famous')!, deps)).toMatchObject({ track: { id: 40 }, sure: false });
    expect(await matchWanted(parseLine('Toxic - Some Other Singer')!, deps)).toMatchObject({ track: { id: 30 }, sure: false });
    expect(await matchWanted(parseLine('Completely Unknown Thing')!, deps)).toMatchObject({ track: null, why: 'nothing found' });
    // A bare title that two artists both recorded.
    const twins = [T(60, 'Seven Nation Army', 'The White Stripes', 'Elephant'), T(61, 'Seven Nation Army', 'Postmodern Jukebox', 'Covers Vol. 2')];
    expect(await matchWanted(parseLine('Seven Nation Army')!, { ...deps, search: async () => twins })).toMatchObject({ track: { id: 60 }, sure: false });
    expect(await matchWanted(parseLine('Seven Nation Army - The White Stripes')!, { ...deps, search: async () => twins })).toMatchObject({ track: { id: 60 }, sure: true });
    expect(await matchWanted(parseLine('https://youtu.be/bbbbbbbbbbb')!, deps)).toMatchObject({ track: null });
  });
});

describe('Apple results and names', () => {
  it('reads an iTunes result and resizes artwork', () => {
    const t = toTrack({ kind: 'song', trackId: 5, trackName: 'A', artistName: 'B', collectionName: 'C', artworkUrl100: 'https://x/100x100bb.jpg', previewUrl: 'https://p.m4a', trackViewUrl: 'https://music.apple.com/us/album/a/1?i=5&uo=4', releaseDate: '2001' });
    expect(t).toMatchObject({ id: 5, link: 'https://music.apple.com/us/album/a/1?i=5' });
    expect(toTrack({ kind: 'music-video', trackId: 5 })).toBeNull();
    expect(art('https://x/100x100bb.jpg', 600)).toBe('https://x/600x600bb.jpg');
  });

  it('tidies names for the reveal', () => {
    expect(tidy({ title: 'Timber (feat. Ke$ha)', artist: 'Pitbull' })).toEqual({ title: 'Timber', artist: 'Pitbull ft. Ke$ha' });
    expect(tidy({ title: 'Bohemian Rhapsody (Remastered 2011)', artist: 'Queen' })).toEqual({ title: 'Bohemian Rhapsody', artist: 'Queen' });
    expect(tidy({ title: 'Here Comes the Sun - Remastered 2009', artist: 'The Beatles' })).toEqual({ title: 'Here Comes the Sun', artist: 'The Beatles' });
    expect(tidy({ title: 'Single Ladies (Put a Ring on It)', artist: 'Beyoncé' })).toEqual({ title: 'Single Ladies (Put a Ring on It)', artist: 'Beyoncé' });
  });
});
