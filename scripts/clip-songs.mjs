// Makes an Earworm clip pack: a short clip of every song in a pack, cut on this laptop from the
// song's YouTube video with yt-dlp and ffmpeg, in one file the host imports on the host phone.
//
//   npm run clip:songs -- <pack> [--out <dir>] [--at "Title=1:23"]... [--seconds 12] [--jobs 3]
//
// <pack> is a built-in pack (src/content/song/<id>.json), an exported pack file (.jerkbox.txt),
// or a list with one song per line ("Title - Artist", YouTube or Apple Music links), as for
// match-songs.mjs. For each song: its `youtube` video, else the best of a YouTube search
// (the artist's own channel, "- Topic" or VEVO, about the Apple track's length; never live,
// cover, remix, karaoke or sped-up); its whole audio, downloaded once and kept in <dir>/cache;
// the moment: where Apple's 30-second preview sits in the full audio (cross-correlated), plus
// the pack's `start` or the game's own automatic pick; about 30% in when that match is not sure;
// a `clipAt` field (seconds into the video) or --at "Title=1:23" sets it by hand.
// Each clip is AAC in .m4a, 128 kbps, with a short fade in and out.
//
// Writes <dir>/<pack-id>.clips.jerkbox.txt (default dir ~/Data/party_games/clips). The file holds
// copies of recordings: it must never go into the repo, the site or anywhere public.
// The report (✓ sure, ? check it, ✗ no clip) goes to stderr. Needs yt-dlp, ffmpeg and internet.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { alignPreview } from '../src/games/song/align.ts';
import { fitStart, pickStart } from '../src/games/song/pick.ts';
import { channelArtist, cleanVideoTitle, matchWanted, normalize, parsePaste, similarity, tidy } from '../src/games/song/match.ts';
import { songKey, YOUTUBE_ID } from '../src/games/song/logic.ts';
import { deps, known, lengths, log, lookupMany } from './apple.mjs';

/** Where clip packs (and the downloads they are cut from) go: outside the repo and the site. */
export const CLIPS_DIR = join(homedir(), 'Data', 'party_games', 'clips');
/** The game plays at most 10 s (logic.ts CLIPS); a little more leaves room for the fade. */
const SECONDS = 12;
/** Low rate for matching the preview against the full audio. */
const ALIGN_RATE = 1000;
/** The rate the game's own picker reads the preview at (a phone decodes at 44.1 or 48 kHz). */
const PICK_RATE = 44100;
/** When the preview is not found in the video: this far into the song. */
const FALLBACK = 0.3;
const FADE_IN = 0.03;
const FADE_OUT = 0.5;
const BAD = /\b(live|cover|remix|alternate|alt version|extended|karaoke|sped ?up|slowed|nightcore|8d|reverb|instrumental|acoustic|bass boosted|reaction|tutorial|lesson|piano version|1 hour|10 hours|loop)\b/i;

const run = promisify(execFile);
const BIG = { maxBuffer: 1 << 30, encoding: 'buffer' };

// ---------------------------------------------------------------- arguments

function parseArgs(argv) {
  const a = { input: '', out: CLIPS_DIR, at: [], seconds: SECONDS, jobs: 3 };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === '--out') a.out = argv[++i];
    else if (x === '--at') a.at.push(argv[++i]);
    else if (x === '--seconds') a.seconds = Number(argv[++i]);
    else if (x === '--jobs') a.jobs = Math.max(1, Number(argv[++i]) || 1);
    else if (!a.input) a.input = x;
    else throw new Error(`What is "${x}"?`);
  }
  if (!a.input) throw new Error('Usage: npm run clip:songs -- <pack.json | pack.jerkbox.txt | list.txt> [--out dir] [--at "Title=1:23"]');
  if (!(a.seconds >= 10.5 && a.seconds <= 30)) throw new Error('--seconds must be 10.5 to 30');
  return a;
}

/** "1:23.5" or "83.5" → 83.5 seconds. */
function seconds(t) {
  const parts = String(t).trim().split(':').map(Number);
  if (!parts.length || parts.some((p) => !Number.isFinite(p) || p < 0)) return null;
  return parts.reduce((n, p) => n * 60 + p, 0);
}

/** --at "Title=1:23" (or "<Apple id>=1:23"): title (normalised) or id → seconds. */
function overrides(list) {
  const m = new Map();
  for (const x of list) {
    const i = x.lastIndexOf('=');
    const s = i > 0 ? seconds(x.slice(i + 1)) : null;
    if (s === null) throw new Error(`--at "${x}": write it as "Title=1:23"`);
    m.set(normalize(x.slice(0, i)) || x.slice(0, i).trim(), s);
  }
  return m;
}

const slug = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'songs';
const mmss = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;

// ---------------------------------------------------------------- input

/** The packs in the input: each { pack: {id, name, blurb, added?}, songs } (a list file is matched to Apple first). */
async function readInput(file) {
  const text = readFileSync(file, 'utf8');
  let data = null;
  try { data = JSON.parse(text); } catch { /* a list */ }
  if (data && Array.isArray(data.songs)) return [{ pack: head(data), songs: data.songs }];
  if (data && data.game === 'song' && Array.isArray(data.packs)) return data.packs.map((p) => ({ pack: head(p), songs: p.songs ?? [] }));
  if (data) throw new Error(`${file} is not an Earworm pack`);
  const id = slug(basename(file).replace(/\.[^.]*$/, ''));
  const name = id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return [{ pack: { id, name, blurb: 'Clips made on a laptop' }, songs: await matchList(text) }];
}

const head = (p) => ({ id: p.id, name: p.name, blurb: p.blurb ?? '', ...(p.added ? { added: p.added } : {}) });

/** A list's songs: matched to Apple with the app's matcher; one Apple lacks keeps its title and artist and has only its clip. */
async function matchList(text) {
  const wanted = parsePaste(text).filter((w) => w.kind !== 'playlist' && w.kind !== 'skip');
  const apple = wanted.filter((w) => w.kind === 'apple').map((w) => w.id);
  if (apple.length) await lookupMany(apple);
  const songs = [];
  for (const w of wanted) {
    let m;
    try { m = await matchWanted(w, deps); } catch (e) {
      log(`✗ Apple didn't answer, left out: ${w.line} (${e.message})`);
      continue;
    }
    if (m.track?.preview) {
      if (!songs.some((s) => s.apple === m.track.id)) songs.push({ ...tidy(m.track), apple: m.track.id, ...(m.youtube ? { youtube: m.youtube } : {}) });
      if (!m.sure) log(`? Apple match to check: ${w.line} → ${m.track.title} — ${m.track.artist}`);
      continue;
    }
    // Not on Apple Music: a clip-only song, named from the line or its video.
    let guess = w.kind === 'text' ? w.guesses[0] : null;
    if (w.kind === 'youtube') {
      const meta = await deps.oembed(w.id).catch(() => null);
      if (meta) guess = cleanVideoTitle(meta.title, meta.author);
    }
    if (guess?.title && guess.artist) {
      log(`? Not on Apple Music, clip only: ${w.line}`);
      songs.push({ title: guess.title, artist: guess.artist, clipOnly: true, ...(w.kind === 'youtube' ? { youtube: w.id } : {}) });
    } else log(`✗ Can't tell what song this is: ${w.line}`);
  }
  return songs;
}

// ---------------------------------------------------------------- YouTube

/** Videos for a song from a YouTube search, best first: the score, and whether the best is clearly right. */
async function findVideos(song, length) {
  const q = `ytsearch8:${song.title} ${song.artist} official audio`;
  const { stdout } = await run('yt-dlp', ['--flat-playlist', '-J', '--no-warnings', q], { maxBuffer: 1 << 26 });
  const entries = (JSON.parse(stdout).entries ?? []).filter((e) => YOUTUBE_ID.test(e.id ?? ''));
  // A flat search gives no channel; YouTube's oEmbed (as the app uses) does.
  const authors = await Promise.all(entries.map((e) => (e.channel ? e.channel : deps.oembed(e.id).then((m) => m?.author ?? '', () => ''))));
  const scored = entries.map((e, i) => {
    const title = e.title ?? '';
    const channel = authors[i] || e.uploader || '';
    const g = cleanVideoTitle(title, channel);
    const own = similarity(channelArtist(channel), song.artist);
    let score = 3 * Math.max(similarity(g.title, song.title), similarity(title, song.title) * 0.9);
    score += 1.5 * similarity(g.artist, song.artist) + 2 * own;
    if (/\s-\sTopic$/i.test(channel)) score += 2;
    else if (/vevo/i.test(channel)) score += 1.5;
    if (/official audio/i.test(title)) score += 1;
    else if (/official (music )?video/i.test(title)) score += 0.3;
    // Lyric videos are mostly fan uploads, often sped up or pitched to dodge takedowns.
    if (/\blyrics?\b/i.test(title) && own < 0.8) score -= 1.5;
    if (BAD.test(title) && !BAD.test(song.title)) score -= 4;
    if (length && e.duration) {
      const d = Math.abs(e.duration - length);
      score += d <= 4 ? 1.5 : d <= 15 ? 0.5 : d > 45 ? -2 : 0;
    }
    if (e.duration > 900) score -= 3;
    return { id: e.id, title, channel, duration: e.duration ?? 0, score };
  }).sort((a, b) => b.score - a.score);
  const usable = scored.filter((v) => v.score >= 3);
  const [best, next] = usable;
  return { videos: usable, sure: !!best && best.score >= 6 && (!next || best.score - next.score >= 0.5), all: scored };
}

/** The video's whole audio, downloaded once (best audio only) into the cache. */
async function download(id, cache) {
  const have = () => readdirSync(cache).find((f) => f.startsWith(`${id}.`) && !f.includes('.part-') && !/\.(part|ytdl|tmp)$/.test(f));
  if (!have()) {
    await run('yt-dlp', ['-f', 'bestaudio', '--no-playlist', '--no-progress', '-q', '--no-warnings', '-o', join(cache, `${id}.%(ext)s`), '--', id], { maxBuffer: 1 << 26 });
  }
  const f = have();
  if (!f) throw new Error('yt-dlp wrote no file');
  return join(cache, f);
}

/** Only the part of the video around `at` (a hand-set clip), when the whole audio is not cached. */
async function downloadPart(id, at, secs, cache) {
  const from = Math.max(0, at - 1);
  const name = `${id}.part-${from.toFixed(1)}`;
  const have = () => readdirSync(cache).find((f) => f.startsWith(`${name}.`) && !/\.(part|ytdl|tmp)$/.test(f));
  if (!have()) {
    await run('yt-dlp', ['-f', 'bestaudio', '--no-playlist', '--no-progress', '-q', '--no-warnings', '--download-sections', `*${from}-${at + secs + 1}`, '--force-keyframes-at-cuts', '-o', join(cache, `${name}.%(ext)s`), '--', id], { maxBuffer: 1 << 26 });
  }
  const f = have();
  if (!f) throw new Error('yt-dlp wrote no file');
  return { file: join(cache, f), shift: from };
}

// ---------------------------------------------------------------- audio

/** Mono float samples of a file at `rate` (at most the first 15 minutes). */
async function pcm(file, rate) {
  const { stdout } = await run('ffmpeg', ['-v', 'error', '-t', '900', '-i', file, '-vn', '-ac', '1', '-ar', String(rate), '-f', 'f32le', '-'], BIG);
  return new Float32Array(stdout.buffer.slice(stdout.byteOffset, stdout.byteOffset + stdout.length - (stdout.length % 4)));
}

async function applePreview(track, cache) {
  const file = join(cache, `apple-${track.id}.m4a`);
  if (!existsSync(file)) {
    const res = await fetch(track.preview);
    if (!res.ok) throw new Error(`Apple preview: HTTP ${res.status}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return file;
}

/** The clip: `secs` from `at`, AAC 128 kbps in .m4a, no tags, a short fade in and out. */
async function cut(file, at, secs, out) {
  const fade = `afade=t=in:st=0:d=${FADE_IN},afade=t=out:st=${Math.max(0, secs - FADE_OUT).toFixed(3)}:d=${FADE_OUT}`;
  await run('ffmpeg', ['-v', 'error', '-y', '-ss', at.toFixed(3), '-i', file, '-t', secs.toFixed(3), '-map', '0:a:0', '-map_metadata', '-1',
    '-ac', '2', '-ar', '44100', '-c:a', 'aac', '-b:a', '128k', '-af', fade, '-movflags', '+faststart', '-f', 'mp4', out]);
  return readFileSync(out);
}

// ---------------------------------------------------------------- one song

/**
 * Where the clip starts in the video, and how that was chosen. Apple's preview found in the full
 * audio, plus the pack's `start` (seconds into the preview) or the game's own pick on the preview.
 */
async function chooseStart(song, full, cache) {
  const all = await pcm(full, ALIGN_RATE);
  const length = all.length / ALIGN_RATE;
  const fallback = { at: FALLBACK * length, length, sure: false };
  const track = song.apple ? known.get(song.apple) : null;
  if (!track?.preview) return { ...fallback, noPreview: true, how: 'not on Apple Music, so about 30% in' };
  const prev = await applePreview(track, cache);
  const a = alignPreview(all, await pcm(prev, ALIGN_RATE), ALIGN_RATE);
  const match = `match ${a.score.toFixed(2)}, next best ${a.runnerUp.toFixed(2)}`;
  if (!a.confident) return { ...fallback, how: `Apple's preview not found in the video (${match}), so about 30% in` };
  const samples = await pcm(prev, PICK_RATE);
  const duration = samples.length / PICK_RATE;
  const inPreview = typeof song.start === 'number' ? fitStart(song.start, duration) : pickStart(samples, PICK_RATE);
  const why = typeof song.start === 'number' ? 'the pack’s start' : 'the game’s own pick';
  return { at: a.offset + inPreview, length, sure: true, how: `Apple's preview found at ${mmss(a.offset)} (${match}), ${why} ${inPreview.toFixed(1)} s into it` };
}

/** Videos to try for a song: its own, or up to three from a search (the next is tried when Apple's preview is not in one). */
async function candidates(song) {
  if (song.youtube) return { videos: [{ id: song.youtube, title: '', channel: 'from the pack', duration: 0 }], sure: true, all: [] };
  const found = await findVideos(song, song.apple ? lengths.get(song.apple) : 0);
  return { ...found, videos: found.videos.slice(0, 3) };
}

async function clipSong(song, opts) {
  const note = [];
  const found = await candidates(song);
  if (!found.videos.length) return { song, mark: '✗', note: ['no YouTube video found', ...found.all.slice(0, 3).map(other)] };
  const byHand = typeof song.clipAt === 'number' ? song.clipAt : opts.at.get(normalize(song.title)) ?? opts.at.get(String(song.apple));
  let pick = null;
  for (const video of found.videos) {
    const cached = readdirSync(opts.cache).some((f) => f.startsWith(`${video.id}.`) && !f.includes('.part-'));
    try {
      if (typeof byHand === 'number' && !cached) {
        // Set by hand: only that part of the video is downloaded.
        const part = await downloadPart(video.id, byHand, opts.seconds, opts.cache);
        pick = { video, file: part.file, shift: part.shift, chosen: { at: byHand, sure: true, byHand: true, how: 'set by hand (only that part downloaded)' } };
        break;
      }
      const file = await download(video.id, opts.cache);
      const chosen = typeof byHand === 'number' ? { at: byHand, sure: true, byHand: true, how: 'set by hand' } : await chooseStart(song, file, opts.cache);
      if (!pick || (chosen.sure && !pick.chosen.sure)) pick = { video, file, shift: 0, chosen };
      if (chosen.sure || chosen.noPreview) break;
      note.push(`tried ${video.id} ("${video.title}", ${video.channel}): ${chosen.how}`);
    } catch (e) {
      note.push(`${video.id} would not download: ${String(e.stderr ?? e.message ?? e).trim().split('\n').pop()}`);
    }
  }
  if (!pick) return { song, mark: '✗', note };
  const { video, chosen } = pick;
  const youtube = video.id;
  const key = songKey({ ...song, youtube });
  const length = chosen.length ?? Infinity;
  const at = Math.max(0, Math.min(chosen.at, length - opts.seconds));
  const outFile = join(opts.cache, `cut-${key.replace(':', '-')}.m4a`);
  const bytes = await cut(pick.file, at - pick.shift, Math.min(opts.seconds, length - at), outFile);
  const secs = (await pcm(outFile, ALIGN_RATE)).length / ALIGN_RATE;
  if (secs < 10.2) throw new Error(`the clip came out ${secs.toFixed(1)} s long`);
  const videoSure = !!song.youtube || found.sure || (chosen.sure && !chosen.byHand);
  note.unshift(song.youtube ? `video ${youtube} (from the pack)` : `video ${youtube}: "${video.title}" (${video.channel}, ${mmss(video.duration)}, score ${video.score.toFixed(1)})${videoSure ? '' : ' — check it'}`);
  if (!videoSure) note.push(...found.videos.filter((v) => v !== video).map(other));
  note.push(`clip from ${mmss(at)} for ${secs.toFixed(1)} s, ${Math.round(bytes.length / 1000)} KB: ${chosen.how}`);
  return {
    song: { ...song, youtube }, key, mark: videoSure && chosen.sure ? '✓' : '?', note,
    clip: { youtube, at: Math.round(at * 1000) / 1000, seconds: Math.round(secs * 1000) / 1000, type: 'audio/mp4', data: bytes.toString('base64') },
  };
}

const other = (o) => `  or ${o.id}: "${o.title}" (${o.channel}, ${mmss(o.duration)}, score ${o.score.toFixed(1)})`;

/** `fn` over `items`, `n` at a time; one failure never stops the rest. */
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }));
  return out;
}

// ---------------------------------------------------------------- the run

/** The song as it goes in the pack: the app's fields only. */
const plainSong = ({ title, artist, apple, start, youtube, clipOnly }) => ({
  title, artist, ...(apple ? { apple } : {}), ...(typeof start === 'number' ? { start } : {}), ...(youtube ? { youtube } : {}), ...(clipOnly ? { clipOnly } : {}),
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const opts = { ...args, at: overrides(args.at), cache: join(args.out, 'cache') };
  mkdirSync(opts.cache, { recursive: true });
  const t0 = Date.now();
  for (const { pack, songs } of await readInput(args.input)) {
    const ids = songs.filter((s) => s.apple).map((s) => s.apple);
    if (ids.length) await lookupMany(ids);
    log(`${pack.name}: ${songs.length} songs, ${opts.jobs} at a time`);
    let done = 0;
    const results = await pool(songs, opts.jobs, async (song, i) => {
      const r = await clipSong(song, opts).catch((e) => ({ song, mark: '✗', note: [String(e.stderr ?? e.message ?? e).trim().split('\n').slice(-2).join(' ')] }));
      log(`${r.mark} ${String(i + 1).padStart(3)}/${songs.length} ${song.title} — ${song.artist}  (${++done} done)\n        → ${r.note.join('\n        → ')}`);
      return r;
    });
    const kept = results.filter((r) => r.clip || r.song.apple);
    const clips = Object.fromEntries(results.filter((r) => r.clip).map((r) => [r.key, r.clip]));
    const file = join(args.out, `${slug(pack.id)}.clips.jerkbox.txt`);
    writeFileSync(file, JSON.stringify({ jerkBox: 1, game: 'song', packs: [{ ...pack, songs: kept.map((r) => plainSong(r.song)) }], clips }));
    const marks = (m) => results.filter((r) => r.mark === m).length;
    const lost = results.filter((r) => !r.clip && !r.song.apple).map((r) => r.song.title);
    log(`\n${file}\n  ${Object.keys(clips).length} clips (✓ ${marks('✓')}, ? ${marks('?')}, ✗ ${marks('✗')}), ${(statSync(file).size / 1e6).toFixed(1)} MB, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    if (lost.length) log(`  Left out (no Apple track and no clip): ${lost.join(', ')}`);
    log('  Check every "?" line. Never commit, publish or post this file: it holds copies of the recordings.');
  }
}

main().catch((e) => { log(e.message ?? e); process.exit(1); });
