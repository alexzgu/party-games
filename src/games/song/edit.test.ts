import { describe, expect, it } from 'vitest';
import { checkSong, formatStart, parseStart, startFromLink, videoIdFrom } from './edit';

describe('song form helpers', () => {
  it('reads video ids from links and bare ids', () => {
    expect(videoIdFrom('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(videoIdFrom('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=43s')).toBe('dQw4w9WgXcQ');
    expect(videoIdFrom('youtu.be/dQw4w9WgXcQ?t=43')).toBe('dQw4w9WgXcQ');
    expect(videoIdFrom('https://music.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(videoIdFrom('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(videoIdFrom('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(videoIdFrom('never gonna')).toBeNull();
  });
  it('reads start times', () => {
    expect(parseStart('1:05')).toBe(65);
    expect(parseStart('65')).toBe(65);
    expect(parseStart('1:02:03')).toBe(3723);
    expect(parseStart('soon')).toBeNull();
    expect(formatStart(65)).toBe('1:05');
    expect(startFromLink('https://youtu.be/dQw4w9WgXcQ?t=43')).toBe(43);
    expect(startFromLink('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m5s')).toBe(65);
    expect(startFromLink('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
  });
});

describe('checkSong', () => {
  const other = { title: 'Toxic', artist: 'Britney Spears', youtube: 'LOZuxwVk7TU', start: 69 };
  it('takes the start from the link when the field is empty', () => {
    expect(checkSong({ title: ' Never  Gonna ', artist: 'Rick Astley', link: 'https://youtu.be/dQw4w9WgXcQ?t=43', start: '' }, [other]))
      .toEqual({ song: { title: 'Never Gonna', artist: 'Rick Astley', youtube: 'dQw4w9WgXcQ', start: 43 }, error: '' });
  });
  it('says what is wrong', () => {
    const ok = { title: 'A', artist: 'B', link: 'dQw4w9WgXcQ', start: '0:30' };
    expect(checkSong({ ...ok, title: '' }, []).error).toMatch(/title/);
    expect(checkSong({ ...ok, link: 'nope' }, []).error).toMatch(/YouTube link/);
    expect(checkSong({ ...ok, start: 'soon' }, []).error).toMatch(/Start time/);
    expect(checkSong({ ...ok, link: 'LOZuxwVk7TU' }, [other]).error).toMatch(/already/);
    expect(checkSong({ ...ok, title: 'toxic', artist: 'britney spears' }, [other]).error).toMatch(/already/);
  });
});
