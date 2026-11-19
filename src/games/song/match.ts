// The song matcher: turns what people paste (YouTube links, Apple Music links, "Title - Artist"
// lines, numbered lists from a chat) into Apple Music tracks. The parsing and ranking are pure;
// the network comes in through `MatchDeps`, so the app (itunes.ts) and the laptop script
// (scripts/match-songs.mjs) share this file and the tests drive it with fixtures.
// No runtime imports: Node runs this file directly for the script.

/** One Apple Music song, as the iTunes Search API describes it. */
export interface Track {
  id: number;
  title: string;
  artist: string;
  album: string;
  /** Album art, 100×100; `art(url, size)` gives other sizes. */
  artwork: string;
  /** 30-second preview (m4a); '' when Apple has none. */
  preview: string;
  /** The song's Apple Music page. */
  link: string;
  /** ISO date, '' when unknown. */
  released: string;
  /** On a various-artists compilation. */
  various?: boolean;
}

/** What one pasted line asks for. */
export type Wanted =
  | { kind: 'youtube'; id: string; line: string }
  | { kind: 'apple'; id: number; line: string }
  | { kind: 'playlist'; list: string; line: string }
  | { kind: 'text'; query: string; guesses: Guess[]; line: string }
  | { kind: 'skip'; why: string; line: string };

/** A title and artist the line might mean (artist '' when unknown). */
export interface Guess { title: string; artist: string }

export interface Match {
  line: string;
  /** The best track, or null when nothing came close. */
  track: Track | null;
  /** The other search results, best first, for "Wrong match? Pick another". */
  others: Track[];
  /** False when the best match is not clearly right: the host should check it. */
  sure: boolean;
  /** The YouTube video the line came from, kept for the reveal. */
  youtube?: string;
  /** Why there is no track. */
  why?: string;
}

export interface MatchDeps {
  search(term: string): Promise<Track[]>;
  /** An artist's songs (Apple's search often buries the original under remixes and covers). */
  artistSongs?(artist: string): Promise<Track[]>;
  lookup(id: number): Promise<Track | null>;
  /** A YouTube video's title and channel, or null when YouTube does not know it. */
  oembed(videoId: string): Promise<{ title: string; author: string } | null>;
}

// ---------------------------------------------------------------- iTunes results

/** An iTunes Search/Lookup result → Track, or null when it is not a song. */
export function toTrack(r: unknown): Track | null {
  const x = r as Record<string, unknown> | null;
  if (!x || x.kind !== 'song' || typeof x.trackId !== 'number') return null;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  return {
    id: x.trackId,
    title: str(x.trackName),
    artist: str(x.artistName),
    album: str(x.collectionName),
    artwork: str(x.artworkUrl100),
    preview: str(x.previewUrl),
    link: str(x.trackViewUrl).replace(/([?&])uo=\d+&?/, '$1').replace(/[?&]$/, ''),
    released: str(x.releaseDate),
    ...(x.collectionArtistName && x.collectionArtistName !== x.artistName ? { various: true } : {}),
  };
}

/** Album art at another size (Apple's art URLs end in /100x100bb.jpg). */
export const art = (url: string, size: number) => url.replace(/\/\d+x\d+bb\./, `/${size}x${size}bb.`);

// ---------------------------------------------------------------- reading pasted lines

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const URL_IN_TEXT = /(?:https?:\/\/)?(?:[a-z0-9-]+\.)*(?:youtube\.com|youtu\.be|youtube-nocookie\.com|music\.apple\.com|itunes\.apple\.com)\/[^\s)\]>"']*/i;

/** Strips list markers, quotes and markdown that chats wrap around items. */
export function stripListing(raw: string): string {
  return raw
    .trim()
    .replace(/^(?:[-*•–—+]\s+|\d+[.):]\s*|\(\d+\)\s*|#\d+\s*)/, '')
    .replace(/^\*\*(.+)\*\*$/, '$1')
    .replace(/^`(.+)`$/, '$1')
    .trim();
}

/** A YouTube URL → its video or playlist; null when it is not a YouTube link. */
export function youtubeFrom(raw: string): { video?: string; list?: string } | null {
  const url = asUrl(raw);
  if (!url) return null;
  const host = url.hostname.replace(/^(www|m|music)\./, '');
  let video: string | undefined;
  if (host === 'youtu.be') video = url.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    video = url.searchParams.get('v') ?? /^\/(?:shorts|embed|live|v)\/([^/?#]+)/.exec(url.pathname)?.[1];
  } else return null;
  const list = url.searchParams.get('list') ?? undefined;
  if (video && VIDEO_ID.test(video)) return { video };
  // Radio mixes (RD…) are made up per viewer and cannot be read back as a list.
  if (list && /^[A-Za-z0-9_-]{10,}$/.test(list) && !list.startsWith('RD')) return { list };
  return {};
}

/** An Apple Music / iTunes song link → its track id; 0 for an Apple link that is not one song; null otherwise. */
export function appleFrom(raw: string): number | null {
  const url = asUrl(raw);
  if (!url || !/(^|\.)(music|itunes)\.apple\.com$/.test(url.hostname)) return null;
  const i = url.searchParams.get('i');
  if (i && /^\d+$/.test(i)) return Number(i);
  const song = /\/song\/(?:[^/]+\/)?(\d+)\/?$/.exec(url.pathname);
  return song ? Number(song[1]) : 0;
}

function asUrl(raw: string): URL | null {
  const t = raw.trim();
  try { return new URL(/^https?:\/\//i.test(t) ? t : 'https://' + t); } catch { return null; }
}

const SEPARATORS = [/\s*\|\s*/, /\t+/, /\s+[—–]\s+/, /\s+-\s+/];
const unquote = (s: string) => s.trim().replace(/^["“”'‘’]+|["“”'‘’]+$/g, '').trim();
const dropYear = (s: string) => s.replace(/\s*[([]\s*(?:19|20)\d\d\s*[)\]]\s*$/, '').trim();

/** One pasted line → what it asks for, or null for a blank or heading line. */
export function parseLine(raw: string): Wanted | null {
  const line = stripListing(raw);
  if (!line || /^#{1,6}\s/.test(line) || /^(?:title|song)\s*[|,-]\s*artist$/i.test(line)) return null;
  // A markdown link: the URL if it is a music link, else its text.
  const md = /\[([^\]]+)\]\(([^)]+)\)/.exec(line);
  const url = (md && URL_IN_TEXT.test(md[2]) ? md[2] : URL_IN_TEXT.exec(line)?.[0]) ?? '';
  if (url) {
    const yt = youtubeFrom(url);
    if (yt?.video) return { kind: 'youtube', id: yt.video, line };
    if (yt?.list) return { kind: 'playlist', list: yt.list, line };
    const apple = appleFrom(url);
    if (apple) return { kind: 'apple', id: apple, line };
    if (apple === 0) return { kind: 'skip', why: 'an Apple Music link to an album or playlist, not one song', line };
    return { kind: 'skip', why: 'a link without a song in it', line };
  }
  const text = md ? md[1] : line;
  if (/^https?:\/\//i.test(text)) return { kind: 'skip', why: 'not a YouTube or Apple Music link', line };
  return textWanted(text, line);
}

function textWanted(text: string, line: string): Wanted {
  const clean = dropYear(unquote(text));
  for (const sep of SEPARATORS) {
    const parts = clean.split(sep).map(unquote).filter(Boolean);
    if (parts.length >= 2) {
      const [a, b] = [parts[0], parts.slice(1).join(' ')];
      return { kind: 'text', query: `${a} ${b}`, guesses: [{ title: a, artist: b }, { title: b, artist: a }], line };
    }
  }
  // "Title by Artist": the last " by " splits, but "Stand by Me" alone is a title too.
  const by = /^(.+)\s+by\s+(.+)$/i.exec(clean);
  const guesses: Guess[] = [{ title: clean, artist: '' }];
  if (by) guesses.unshift({ title: unquote(by[1]), artist: unquote(by[2]) });
  return { kind: 'text', query: clean, guesses, line };
}

/** Every line of a paste, parsed, minus blanks and repeats. */
export function parsePaste(text: string): Wanted[] {
  const seen = new Set<string>();
  const out: Wanted[] = [];
  for (const raw of text.split(/\r?\n/)) {
    if (/^\s*```/.test(raw) || /^\s*\|?\s*:?-{3,}/.test(raw)) continue;
    const row = raw.trim().startsWith('|') ? raw.split('|').map((c) => c.trim()).filter((c) => c && !/^\d+[.)]?$/.test(c)).join(' | ') : raw;
    const w = parseLine(row);
    if (!w) continue;
    const key = wantedKey(w);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(w);
  }
  return out;
}

export function wantedKey(w: Wanted): string {
  switch (w.kind) {
    case 'youtube': return 'yt:' + w.id;
    case 'apple': return 'am:' + w.id;
    case 'playlist': return 'pl:' + w.list;
    case 'text': return 'tx:' + normalize(w.query);
    default: return 'sk:' + w.line;
  }
}

// ---------------------------------------------------------------- YouTube titles

const NOISE = /\b(official|video|audio|lyrics?|lyric video|visuali[sz]er|hd|hq|4k|remaster(?:ed)?|m\/?v|explicit|clean|music video|full song|color coded|with lyrics|audio only|performance video|vertical video|letra|subtitulad[oa]|360°?)\b/i;
const FEAT = /\s*[([]?\s*\b(?:ft|feat|featuring)\b\.?\s+[^()[\]|]*?(?=\s+[-–—]\s+|[)\]]|$)[)\]]?/gi;

/** A YouTube video title and channel → the likely title and artist ("Artist - Title (Official Video)"). */
export function cleanVideoTitle(raw: string, channel = ''): Guess {
  let t = raw.replace(/[([{【][^)\]}】]*[)\]}】]/g, (m) => (NOISE.test(m) ? ' ' : m));
  // Trailing "| Official Video", "// Lyrics", "Official Music Video" without brackets.
  t = t.replace(/\s*(?:\||\/\/)\s*[^|]*$/, (m) => (NOISE.test(m) ? '' : m));
  t = t.replace(/\s+(?:official\s+(?:music\s+)?(?:video|audio|visuali[sz]er|lyric video)|lyric video|lyrics|hd|hq|4k)\s*$/i, '');
  t = t.replace(FEAT, ' ').replace(/\s+/g, ' ').trim();
  const dash = /^(.+?)\s+[-–—]\s+(.+)$/.exec(t) ?? /^(.+?)\s*[-–—]\s+(.+)$/.exec(t);
  if (dash) return { artist: unquote(dash[1]), title: unquote(dash[2]) };
  return { title: unquote(t), artist: channelArtist(channel) };
}

/** "TaylorSwiftVEVO" → "Taylor Swift", "Adele - Topic" → "Adele", "Some Label" → "Some Label". */
export function channelArtist(channel: string): string {
  let c = channel.trim().replace(/\s*-\s*Topic$/i, '').replace(/\s*VEVO$/i, '').replace(/\s+(?:official|music|official music)$/i, '');
  if (!/\s/.test(c)) c = c.replace(/([a-z])([A-Z])/g, '$1 $2');
  return c.trim();
}

// ---------------------------------------------------------------- similarity and ranking

/** Lowercase, no accents, brackets, featured artists or punctuation; "&" → "and"; no leading "the". */
export function normalize(s: string): string {
  return s
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\$/g, 's')
    .replace(/[([{][^)\]}]*[)\]}]/g, ' ')
    .replace(/\s[-–—]\s.*(?:remaster|version|edit|mix|live|mono|stereo).*$/, ' ')
    .replace(/\b(?:ft|feat|featuring)\b\.?.*$/, ' ')
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/^the\s+/, '')
    .trim();
}

const words = (s: string) => new Set(normalize(s).split(' ').filter(Boolean));
function bigrams(s: string): string[] {
  const t = normalize(s).replace(/ /g, '');
  return Array.from({ length: Math.max(0, t.length - 1) }, (_, i) => t.slice(i, i + 2));
}

/** 0–1: how alike two titles (or names) are, word by word and letter by letter. */
export function similarity(a: string, b: string): number {
  const na = normalize(a), nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const A = words(a), B = words(b);
  const shared = [...A].filter((w) => B.has(w)).length;
  const wordDice = (2 * shared) / (A.size + B.size);
  const ga = bigrams(a), gb = bigrams(b);
  const pool = [...gb];
  let hits = 0;
  for (const g of ga) { const i = pool.indexOf(g); if (i >= 0) { hits++; pool.splice(i, 1); } }
  const charDice = ga.length + gb.length ? (2 * hits) / (ga.length + gb.length) : 0;
  // One fully inside the other ("Single Ladies" in "Single Ladies Put a Ring on It").
  const inside = (` ${na} `.includes(` ${nb} `) || ` ${nb} `.includes(` ${na} `)) ? 0.85 : 0;
  return Math.max(wordDice, charDice * 0.95, inside);
}

const splitArtists = (s: string) => s.split(/\s*(?:,|&|\band\b|\bx\b|\bwith\b|\bvs\.?|\bft\b\.?|\bfeat\b\.?|\bfeaturing\b)\s*/i).map((x) => x.trim()).filter(Boolean);

/** Like similarity(), but "Pitbull ft. Kesha" matches "Pitbull & Ke$ha" and "Pitbull". */
export function artistSimilarity(a: string, b: string): number {
  const whole = similarity(a, b);
  const [la] = splitArtists(a), [lb] = splitArtists(b);
  const lead = la && lb ? similarity(la, lb) : 0;
  return Math.max(whole, lead * 0.97);
}

const STRONG = /\b(karaoke|tribute|cover(?:ed)?|made famous|in the style of|originally performed|lullaby|lullabies|8[- ]bit|instrumental|backing track|as performed|piano version|music box)\b/i;
const MILD = /\b(live|demo|remix|mix|acoustic|sped up|slowed|reverb|version|unplugged|session|re-?recorded|rehearsal|edit|mashup|medley|a cappella|orbital audio|spatial audio|dolby atmos|8d audio)\b/i;
/** Album names that mark another recording; "(Deluxe Version)" or "(Remastered)" albums are the original. */
const MILD_ALBUM = /\b(live|demos?|acoustic|unplugged|remix(?:es)?|sessions?)\b/i;
const COMPILATION = /\b(nominees|soundtrack hits|greatest hits|best of|the very best|hits|essential|essentials|collection|now that'?s|anthology|gold|ultimate|playlist|compilation|number ones|#1'?s|party|workout|throwback|anthems|classics)\b/i;

/** `other`: the track is a version the line did not ask for (live, remix, karaoke…). */
export interface Ranked { track: Track; score: number; title: number; artist: number; other: boolean; /** Which guess fitted best. */ guess: number }

const plain = (s: string) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

/** Search results scored against what the line asked for, best first. */
export function rank(tracks: Track[], guesses: Guess[]): Ranked[] {
  const asked = plain(guesses.map((g) => `${g.title} ${g.artist}`).join(' '));
  const scored = tracks.map((track, order) => {
    let best = { score: 0, title: 0, artist: 0, guess: 0 };
    for (const g of guesses) {
      const t = similarity(g.title, track.title);
      const a = g.artist ? artistSimilarity(g.artist, track.artist) : 0;
      const score = g.artist ? 0.6 * t + 0.4 * a : 0.85 * t;
      if (score > best.score) best = { score, title: t, artist: g.artist ? a : 1, guess: guesses.indexOf(g) };
    }
    let score = best.score;
    const about = plain(`${track.title} ${track.album} ${track.artist}`);
    const strong = STRONG.exec(about)?.[1];
    const strongOther = !!strong && !new RegExp(`\\b${strong}\\b`, 'i').test(asked);
    if (strongOther) score -= 0.3;
    const mild = MILD.exec(plain(track.title))?.[1] ?? MILD_ALBUM.exec(plain(track.album))?.[1];
    const mildOther = !!mild && !new RegExp(`\\b${mild}\\b`, 'i').test(asked);
    if (mildOther) score -= 0.12;
    // The line asked for a version ("live", "acoustic"): the track that is that version wins.
    const wantVersion = STRONG.exec(asked)?.[1] ?? MILD.exec(asked)?.[1];
    if (wantVersion && new RegExp(`\\b${wantVersion}\\b`, 'i').test(about)) score += 0.1;
    if (COMPILATION.test(track.album) || track.various) score -= 0.04;
    if (!track.preview) score -= 0.5;
    return { track, score, title: best.title, artist: best.artist, other: strongOther || mildOther, guess: best.guess, order };
  });
  return scored
    .sort((a, b) => b.score - a.score || (a.track.released || '9').localeCompare(b.track.released || '9') || a.order - b.order)
    .map(({ order: _, ...r }) => r);
}

/** Thresholds: at or above SURE (with a close title and artist) needs no check; below FOUND is no match. */
export const SURE = 0.8;
export const FOUND = 0.5;

/** The match a ranking gives: the best track (if close enough), the rest, and whether it is clearly right. */
export function decide(ranked: Ranked[], line: string, hasArtist: boolean): Match {
  const best = ranked[0];
  const others = ranked.slice(1, 13).map((r) => r.track);
  if (!best || best.score < FOUND) return { line, track: null, others: ranked.slice(0, 12).map((r) => r.track), sure: false, why: ranked.length ? 'no close match' : 'nothing found' };
  // No artist given and another artist has a song by the same name just as close: the host decides.
  const rival = ranked[1];
  const twin = !hasArtist && !!rival && rival.title >= 0.9 && best.score - rival.score < 0.1 && normalize(rival.track.artist) !== normalize(best.track.artist);
  const sure = best.score >= SURE && best.title >= 0.75 && (!hasArtist || best.artist >= 0.6) && !!best.track.preview && !best.other && !twin;
  return { line, track: best.track, others, sure };
}

// ---------------------------------------------------------------- the whole match

/** Finds the Apple Music track for one parsed line. Never throws for "not found"; network errors do throw. */
export async function matchWanted(w: Wanted, deps: MatchDeps): Promise<Match> {
  if (w.kind === 'skip' || w.kind === 'playlist') return { line: w.line, track: null, others: [], sure: false, why: w.kind === 'skip' ? w.why : 'a playlist' };
  if (w.kind === 'apple') {
    const track = await deps.lookup(w.id);
    if (!track) return { line: w.line, track: null, others: [], sure: false, why: 'Apple Music has no song with that link' };
    return { line: w.line, track, others: [], sure: !!track.preview, why: track.preview ? undefined : 'Apple has no preview for it' };
  }
  let guesses: Guess[];
  let query: string;
  let youtube: string | undefined;
  if (w.kind === 'youtube') {
    const meta = await deps.oembed(w.id);
    if (!meta) return { line: w.line, track: null, others: [], sure: false, youtube: undefined, why: 'YouTube has no public video with that link' };
    const g = cleanVideoTitle(meta.title, meta.author);
    const fromChannel = channelArtist(meta.author);
    guesses = [g, { title: g.artist, artist: g.title }];
    if (fromChannel && normalize(fromChannel) !== normalize(g.artist)) guesses.push({ title: g.title, artist: fromChannel });
    query = `${g.artist} ${g.title}`.trim();
    youtube = w.id;
  } else {
    guesses = w.guesses;
    query = w.query;
  }
  const hasArtist = guesses.some((g) => g.artist);
  const found = await deps.search(query);
  let ranked = rank(found, guesses);
  let m = decide(ranked, w.line, hasArtist);
  // Not clearly right: the original may be buried under remixes and covers, so look through the
  // artist's own songs (the artist from whichever reading of the line fitted best).
  if (!m.sure && hasArtist && deps.artistSongs) {
    const artist = guesses[ranked[0]?.guess ?? 0]?.artist || guesses.find((g) => g.artist)!.artist;
    const theirs = await deps.artistSongs(artist);
    if (theirs.length) {
      const seen = new Set<number>();
      ranked = rank([...theirs, ...found].filter((t) => !seen.has(t.id) && !!seen.add(t.id)), guesses);
      m = decide(ranked, w.line, hasArtist);
    }
  }
  // Too many words can hide the song (a channel name, a subtitle): try the title alone.
  if (!m.track && guesses[0].artist && normalize(guesses[0].title) !== normalize(query)) {
    const again = decide(rank(await deps.search(guesses[0].title), guesses), w.line, hasArtist);
    if (again.track) m = { ...again, sure: false };
  }
  return { ...m, youtube };
}

// ---------------------------------------------------------------- tidy names for the game

const DROP_PAREN = /\s*[([](?:[^)\]]*\b(?:remaster(?:ed)?|version|edit|mono|stereo|from\b[^)\]]*|original mix|bonus track|deluxe)\b[^)\]]*)[)\]]/gi;

/** Apple's names made fit to shout: "Timber (feat. Ke$ha)" by "Pitbull" → "Timber" by "Pitbull ft. Ke$ha". */
export function tidy(t: Pick<Track, 'title' | 'artist'>): { title: string; artist: string } {
  let title = t.title;
  let artist = t.artist;
  const feat = /\s*[([](?:feat\.?|ft\.?|featuring|with)\s+([^)\]]+)[)\]]/i.exec(title);
  if (feat) {
    title = title.replace(feat[0], '');
    if (!normalize(artist).includes(normalize(feat[1]))) artist = `${artist} ft. ${feat[1].trim()}`;
  }
  title = title.replace(DROP_PAREN, '').replace(/\s+[-–]\s+(?:\d{4}\s+)?remaster(?:ed)?(?:\s+\d{4})?(?:\s+version)?$/i, '').replace(/\s+[-–]\s+(?:single|radio|album)\s+(?:version|edit)$/i, '').trim();
  return { title: title || t.title, artist };
}
