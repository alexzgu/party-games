import { describe, expect, it } from 'vitest';
import { base64Bytes, MAX_CLIP_BYTES, MAX_CLIP_FILE_BYTES, readClipFile, readClips } from './clipfile';

/** A tiny file that starts like an MP4 (an "ftyp" box), as base64. */
const MP4 = btoa(String.fromCharCode(0, 0, 0, 24, ...[...'ftypM4A \0\0\0\0M4A isom'].map((c) => c.charCodeAt(0))));
const clip = (over: Record<string, unknown> = {}) => ({ youtube: 'abcdefghijk', at: 61.5, seconds: 12, type: 'audio/mp4', data: MP4, ...over });
const song = { title: 'Mr. Brightside', artist: 'The Killers', apple: 1526194192 };
const only = { title: 'Unreleased Banger', artist: 'A Friend', youtube: 'zyxwvutsrqp', clipOnly: true };
const file = (over: Record<string, unknown> = {}) => JSON.stringify({
  jerkBox: 1, game: 'song',
  packs: [{ id: 'party', name: 'Party', blurb: 'Tonight', songs: [song, only] }],
  clips: { '1526194192': clip(), 'yt:zyxwvutsrqp': clip({ youtube: 'zyxwvutsrqp' }) },
  ...over,
});

describe('Earworm clip pack files', () => {
  it('reads the pack and each song’s clip, a clip-only song included', () => {
    const r = readClipFile(file());
    if ('error' in r) throw new Error(r.error);
    expect(r.packs[0]).toMatchObject({ id: 'party', songs: [song, { title: only.title, youtube: only.youtube, clipOnly: true }] });
    expect([...r.clips[0].keys()]).toEqual(['1526194192', 'yt:zyxwvutsrqp']);
    expect(r.clips[0].get('1526194192')).toMatchObject({ youtube: 'abcdefghijk', at: 61.5, seconds: 12, type: 'audio/mp4' });
    expect(new Uint8Array(r.clips[0].get('1526194192')!.bytes).subarray(4, 8)).toEqual(new Uint8Array([...'ftyp'].map((c) => c.charCodeAt(0))));
    expect(r.clipsSkipped).toBe(0);
    expect(r.skipped).toBe(0);
  });

  it('reads a plain pack file too, and drops a clip-only song whose clip is not in the file', () => {
    const r = readClipFile(file({ clips: undefined }));
    if ('error' in r) throw new Error(r.error);
    expect(r.packs[0]).toMatchObject({ songs: [song] });
    expect(r.skipped).toBe(1);
    expect(r.clips[0].size).toBe(0);
  });

  it('leaves out clips with bad base64, missing fields, odd keys or audio that is not MP4, and their clip-only songs', () => {
    const bad = {
      '1526194192': clip({ data: 'not base64!' }),
      'yt:zyxwvutsrqp': clip({ youtube: undefined }),
      'Mr. Brightside': clip(),
      '42': clip({ data: btoa('just some text, no box') }),
      '43': clip({ seconds: 0 }),
      '44': clip({ at: -1 }),
      '45': clip({ type: 'audio/ogg' }),
      '46': 'a string',
    };
    const r = readClipFile(file({ clips: bad }));
    if ('error' in r) throw new Error(r.error);
    expect(r.clips[0].size).toBe(0);
    expect(r.clipsSkipped).toBe(8);
    expect(r.packs[0]).toMatchObject({ songs: [song] });
  });

  it('refuses another game’s file, a file that is not a pack file, and one too big', () => {
    expect(readClipFile(file({ game: 'forehead' }))).toEqual({ error: expect.stringContaining('Heads Down.') });
    expect(readClipFile('{"hello": 1}')).toEqual({ error: expect.stringContaining('isn\'t') });
    expect(readClipFile('not json')).toEqual({ error: expect.stringContaining('isn\'t') });
    expect(readClipFile(' '.repeat(MAX_CLIP_FILE_BYTES + 1))).toEqual({ error: expect.stringContaining('too big') });
  });

  it('decodes strict base64 only, up to the size of one clip', () => {
    expect(new Uint8Array(base64Bytes(btoa('abc'))!)).toEqual(new Uint8Array([97, 98, 99]));
    expect(base64Bytes('')).toBeNull();
    expect(base64Bytes('abc')).toBeNull();
    expect(base64Bytes('ab$=')).toBeNull();
    expect(base64Bytes('A'.repeat(Math.ceil((MAX_CLIP_BYTES * 4) / 3 / 4) * 4 + 8))).toBeNull();
    expect(readClips(null)).toEqual({ clips: new Map(), skipped: 0 });
  });
});
