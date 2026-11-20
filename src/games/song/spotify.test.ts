import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanSpotifyTitle, matchWanted, parseLine, parsePaste, spotifyFrom, type MatchDeps, type Track } from './match';
import { AT_ONCE, TIMEOUT_MS, spotifyTitle } from './spotify';
import { NetError } from './itunes';

const ID = '4cOdK2wGLETKBW3PvgPWqT';
const LIST = '37i9dQZF1DXcBWIGoYBM5M';
const PLAYLISTS = 'Spotify playlists can’t be read here: paste the songs’ links instead';
const SHORT = 'Spotify short links can’t be read here: open that link and copy the long one';

describe('reading Spotify links', () => {
  it('finds the track in every song link form', () => {
    for (const link of [
      `https://open.spotify.com/track/${ID}`,
      `https://open.spotify.com/track/${ID}?si=1a2b3c4d5e6f7a8b`,
      `https://open.spotify.com/track/${ID}?si=abc&context=spotify%3Aplaylist%3A${LIST}`,
      `open.spotify.com/track/${ID}`,
      `http://open.spotify.com/track/${ID}/`,
      `https://open.spotify.com/intl-de/track/${ID}?si=x`,
      `https://open.spotify.com/intl-pt-BR/track/${ID}`,
      `https://open.spotify.com/embed/track/${ID}?utm_source=generator`,
      `https://play.spotify.com/track/${ID}`,
      `spotify:track:${ID}`,
    ]) expect(spotifyFrom(link), link).toEqual({ track: ID });
  });

  it('turns playlists, albums, artists and short links away with a reason', () => {
    expect(spotifyFrom(`https://open.spotify.com/playlist/${LIST}?si=q`)).toEqual({ skip: PLAYLISTS });
    expect(spotifyFrom(`https://open.spotify.com/intl-fr/playlist/${LIST}`)).toEqual({ skip: PLAYLISTS });
    expect(spotifyFrom(`spotify:playlist:${LIST}`)).toEqual({ skip: PLAYLISTS });
    expect(spotifyFrom(`spotify:user:someone:playlist:${LIST}`)).toEqual({ skip: PLAYLISTS });
    expect(spotifyFrom(`https://open.spotify.com/user/someone/playlist/${LIST}`)).toEqual({ skip: PLAYLISTS });
    expect(spotifyFrom(`https://open.spotify.com/album/${LIST}`)).toEqual({ skip: 'Spotify albums can’t be read here: paste the songs’ links instead' });
    expect(spotifyFrom(`https://open.spotify.com/artist/${LIST}`)).toEqual({ skip: 'Spotify artist pages can’t be read here: paste the songs’ links instead' });
    expect(spotifyFrom('https://spotify.link/aBcD1234efG')).toEqual({ skip: SHORT });
    expect(spotifyFrom('https://spotify.app.link/aBcD1234efG?_p=c')).toEqual({ skip: SHORT });
  });

  it('refuses junk', () => {
    const none = { skip: 'a Spotify link without a song in it' };
    expect(spotifyFrom('https://open.spotify.com/track/tooShort')).toEqual(none);
    expect(spotifyFrom(`https://open.spotify.com/track/${ID}X`)).toEqual(none);
    expect(spotifyFrom('https://open.spotify.com/')).toEqual(none);
    expect(spotifyFrom(`https://open.spotify.com/episode/${ID}`)).toEqual(none);
    expect(spotifyFrom('spotify:track:')).toEqual(none);
    expect(spotifyFrom(`https://spotify.com.evil.example/track/${ID}`)).toBeNull();
    expect(spotifyFrom(`https://www.youtube.com/watch?v=dQw4w9WgXcQ`)).toBeNull();
    expect(spotifyFrom('Mr. Brightside - The Killers')).toBeNull();
  });

  it('reads Spotify lines in a mixed paste, one line per link, repeats dropped', () => {
    const got = parsePaste([
      `1. https://open.spotify.com/track/${ID}?si=aaa`,
      `- [Never Gonna Give You Up](https://open.spotify.com/intl-de/track/${ID}?si=bbb)`,
      `spotify:track:3n3Ppam7vgaVa1iaRUc9Lp`,
      'Toxic - Britney Spears',
      'https://youtu.be/dQw4w9WgXcQ',
      `• My mix: https://open.spotify.com/playlist/${LIST}`,
      'https://spotify.link/aBcD1234efG',
      'https://music.apple.com/us/album/x/1?i=42',
    ].join('\n'));
    expect(got.map((w) => [w.kind, 'id' in w ? w.id : 'why' in w ? w.why : ''])).toEqual([
      ['spotify', ID],
      ['spotify', '3n3Ppam7vgaVa1iaRUc9Lp'],
      ['text', ''],
      ['youtube', 'dQw4w9WgXcQ'],
      ['skip', PLAYLISTS],
      ['skip', SHORT],
      ['apple', 42],
    ]);
    expect(parseLine(`https://open.spotify.com/track/${ID}?context=spotify:playlist:${LIST}`)).toMatchObject({ kind: 'spotify', id: ID });
    expect(parseLine('https://example.com/a-song')).toMatchObject({ kind: 'skip', why: 'not a YouTube, Apple Music or Spotify link' });
  });

  it('cleans Spotify titles for the search', () => {
    expect(cleanSpotifyTitle('Here Comes The Sun - Remastered 2009')).toBe('Here Comes The Sun');
    expect(cleanSpotifyTitle('Timber (feat. Ke$ha)')).toBe('Timber');
    expect(cleanSpotifyTitle('Blinding Lights - Radio Edit')).toBe('Blinding Lights');
    expect(cleanSpotifyTitle('Mr. Brightside')).toBe('Mr. Brightside');
    expect(cleanSpotifyTitle('Hold On - Live')).toBe('Hold On - Live');
  });
});

const T = (id: number, title: string, artist: string, preview = `https://p/${id}.m4a`): Track =>
  ({ id, title, artist, album: title, artwork: '', preview, link: '', released: '2004-01-01' });

describe('matching a Spotify song by its title alone', () => {
  const library = [T(1, 'Mr. Brightside', 'The Killers'), T(2, 'Mr. Brightside', 'Some Cover Band'), T(3, 'Somebody Told Me', 'The Killers')];
  const searched: string[] = [];
  const deps: MatchDeps = {
    search: async (term) => { searched.push(term); return library.filter((t) => t.title.includes(term.split(' ')[0])); },
    lookup: async () => null,
    oembed: async () => null,
    spotifyTitle: async (id) => (id === ID ? 'Mr. Brightside - Remastered 2020' : null),
  };
  const line = (id = ID) => parseLine(`https://open.spotify.com/track/${id}`)!;

  it('searches the title, never calls it sure, and keeps what Spotify said', async () => {
    const m = await matchWanted(line(), deps);
    expect(searched.at(-1)).toBe('Mr. Brightside');
    expect(m).toMatchObject({ track: { id: 1 }, sure: false, linked: { title: 'Mr. Brightside - Remastered 2020', artist: 'N/A' } });
    expect(m.others.map((t) => t.id)).toContain(2);
  });

  it('says why when Spotify has no such song, or has no way to ask', async () => {
    expect(await matchWanted(line('3n3Ppam7vgaVa1iaRUc9Lp'), deps)).toMatchObject({ track: null, why: 'Spotify has no song with that link' });
    const { spotifyTitle: _, ...without } = deps;
    expect(await matchWanted(line(), without)).toMatchObject({ track: null, why: 'Spotify links can’t be read here' });
  });

  it('keeps a Spotify failure on its line, but pauses the list when offline', async () => {
    const failing = { ...deps, spotifyTitle: async () => { throw new NetError('Spotify HTTP 503', false); } };
    expect(await matchWanted(line(), failing)).toMatchObject({ track: null, retry: true, why: 'Spotify didn’t answer: paste the link again to retry' });
    const offline = { ...deps, spotifyTitle: async () => { throw new NetError('no answer from Spotify', true); } };
    await expect(matchWanted(line(), offline)).rejects.toThrow('no answer from Spotify');
  });
});

describe('asking Spotify for a title', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  it('asks the oEmbed endpoint for the track and reads its title', async () => {
    const fetch = vi.fn(async () => json({ title: 'Never Gonna Give You Up', type: 'rich' }));
    vi.stubGlobal('fetch', fetch);
    expect(await spotifyTitle('aaaaaaaaaaaaaaaaaaaaa1')).toBe('Never Gonna Give You Up');
    expect(fetch.mock.calls[0]).toEqual([
      'https://open.spotify.com/oembed?url=https%3A%2F%2Fopen.spotify.com%2Ftrack%2Faaaaaaaaaaaaaaaaaaaaa1',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ]);
    // Remembered: no second call.
    expect(await spotifyTitle('aaaaaaaaaaaaaaaaaaaaa1')).toBe('Never Gonna Give You Up');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('gives null for an unknown song and throws when Spotify fails, then asks again', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'not found' }, 404)));
    expect(await spotifyTitle('aaaaaaaaaaaaaaaaaaaaa2')).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => json({}, 503)));
    await expect(spotifyTitle('aaaaaaaaaaaaaaaaaaaaa3')).rejects.toThrow('Spotify HTTP 503');
    vi.stubGlobal('fetch', vi.fn(async () => json({ title: 'Back' })));
    expect(await spotifyTitle('aaaaaaaaaaaaaaaaaaaaa3')).toBe('Back');
  });

  it('gives up on a call that takes too long', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_, reject) => {
      init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    })));
    const p = spotifyTitle('aaaaaaaaaaaaaaaaaaaaa4');
    const failed = expect(p).rejects.toThrow('Spotify took too long');
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
    await failed;
  });

  it('keeps only a few calls in flight at once', async () => {
    let inFlight = 0, most = 0;
    const done: (() => void)[] = [];
    vi.stubGlobal('fetch', vi.fn(() => {
      inFlight++; most = Math.max(most, inFlight);
      return new Promise<Response>((r) => done.push(() => { inFlight--; r(json({ title: 'Song' })); }));
    }));
    const all = Promise.all(Array.from({ length: 7 }, (_, i) => spotifyTitle(`bbbbbbbbbbbbbbbbbbbbb${i}`)));
    for (let i = 0; i < 20 && (done.length || inFlight); i++) { await new Promise((r) => setTimeout(r, 0)); done.shift()?.(); }
    expect(await all).toEqual(Array(7).fill('Song'));
    expect(most).toBe(AT_ONCE);
  });
});
