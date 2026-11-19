import { describe, expect, it } from 'vitest';
import { checkSong, formatStart } from './edit';

describe('editing a song', () => {
  const base = { title: 'Toxic', artist: 'Britney Spears', apple: 251948354 };
  const other = { title: 'Mr. Brightside', artist: 'The Killers', apple: 1526194192 };
  const draft = { title: ' Toxic ', artist: 'Britney  Spears', youtube: '', start: null };

  it('keeps the Apple track, tidies names, and reads a YouTube link or id', () => {
    expect(checkSong(draft, base, [other])).toEqual({ song: base, error: '' });
    expect(checkSong({ ...draft, youtube: 'https://youtu.be/LOZuxwVk7TU?si=x' }, base, []).song).toEqual({ ...base, youtube: 'LOZuxwVk7TU' });
    expect(checkSong({ ...draft, youtube: 'LOZuxwVk7TU' }, base, []).song?.youtube).toBe('LOZuxwVk7TU');
  });

  it('keeps a start set by hand inside the preview, and none for automatic', () => {
    expect(checkSong({ ...draft, start: 12.44 }, base, []).song?.start).toBe(12.4);
    expect(checkSong({ ...draft, start: 27 }, base, []).song?.start).toBe(19.5);
    expect(checkSong(draft, { ...base, start: 9 } as typeof base, []).song).not.toHaveProperty('start');
  });

  it('says what is wrong', () => {
    expect(checkSong({ ...draft, title: '' }, base, []).error).toMatch(/title/);
    expect(checkSong({ ...draft, artist: ' ' }, base, []).error).toMatch(/artist/);
    expect(checkSong({ ...draft, youtube: 'https://example.com/x' }, base, []).error).toMatch(/YouTube/);
    expect(checkSong({ ...draft, title: 'mr. brightside', artist: 'the killers' }, base, [other]).error).toMatch(/already/);
  });

  it('formats starts', () => {
    expect(formatStart(12.4)).toBe('0:12.4');
    expect(formatStart(65)).toBe('1:05');
    expect(formatStart(1.5)).toBe('0:01.5');
  });
});
