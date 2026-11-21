import { describe, expect, it } from 'vitest';
import type { Song } from '../../lib/content';
import * as r from './logic';

const song = (n: number): Song => ({ title: `Song ${n}`, artist: `Artist ${n}`, apple: 1000 + n });
const start = (target = 5) => r.newGame(['Maya', 'Jordan', 'Sam'], { target, packIds: ['p'] }, song(1));

describe('Earworm rules', () => {
  it('needs two players and starts on the ready screen with the first song dealt', () => {
    expect(() => r.newGame(['Solo'], { target: 5, packIds: [] }, song(1))).toThrow();
    const g = start();
    expect(g.phase).toBe('ready');
    expect(g.dealt).toEqual(['1001']);
  });

  it('keeps dealt songs oldest first, moving a song dealt again to the end', () => {
    let g = r.setUpcoming(start(), song(2));
    g = r.replaceUpcoming(g, song(1));
    expect(g.dealt).toEqual(['1002', '1001']);
  });

  it('scores 3, 2 or 1 by clip length, and Longer stops at the longest clip', () => {
    let g = r.listen(start());
    expect([r.clipSeconds(g), r.pointsNow(g)]).toEqual([2, 3]);
    g = r.longer(g);
    expect([r.clipSeconds(g), r.pointsNow(g)]).toEqual([5, 2]);
    g = r.longer(r.longer(g));
    expect([r.clipSeconds(g), r.pointsNow(g)]).toEqual([10, 1]);
    g = r.award(g, 1);
    expect(g.players[1].score).toBe(1);
    expect(g.outcome).toEqual({ kind: 'point', scorer: 1, points: 1 });
    expect(r.award(r.listen(start()), 2).players[2].score).toBe(3);
  });

  it('goes reveal → scores → ready with the upcoming song, and never deals a song twice', () => {
    let g = r.award(r.listen(start()), 0);
    g = r.setUpcoming(g, song(2));
    expect(g.dealt).toEqual(['1001', '1002']);
    g = r.next(g);
    expect(g.phase).toBe('scores');
    g = r.next(g);
    expect(g.phase).toBe('ready');
    expect(g.song).toEqual(song(2));
    expect(g.upcoming).toBeNull();
    expect(g.step).toBe(0);
  });

  it('nobody scores nothing; undo takes the points back and returns to the same clip', () => {
    let g = r.longer(r.listen(start()));
    const n = r.nobody(g);
    expect(n.players.every((p) => p.score === 0)).toBe(true);
    expect(n.log.at(-1)).toMatchObject({ by: -1, points: 0 });
    g = r.award(g, 2);
    const u = r.undo(g);
    expect(u.phase).toBe('listen');
    expect(u.step).toBe(1);
    expect(u.players[2].score).toBe(0);
    expect(u.songsPlayed).toBe(0);
    expect(u.log).toEqual([]);
  });

  it('a song whose preview will not play is swapped without penalty and noted for history', () => {
    let g = r.longer(r.listen(start()));
    g = r.replaceSong(g, song(3), true);
    expect(g.song).toEqual(song(3));
    expect(g.step).toBe(0);
    expect(g.skipped).toEqual(['Song 1 — Artist 1']);
    expect(g.players.every((p) => p.score === 0)).toBe(true);
    g = r.replaceUpcoming(r.setUpcoming(g, song(4)), song(5));
    expect(g.upcoming).toEqual(song(5));
    expect(g.skipped).toHaveLength(2);
  });

  it('a song swapped in while the room listens waits on the ready screen, so it is never revealed unheard', () => {
    const listening = r.longer(r.listen(start()));
    for (const g of [r.replaceSong(listening, song(2)), r.replaceSong(listening, song(2), true)]) {
      expect(g.phase).toBe('ready');
      expect(g.song).toEqual(song(2));
      expect(r.nobody(g)).toBe(g);
      expect(r.award(g, 0)).toBe(g);
      expect(r.listen(g).phase).toBe('listen');
    }
  });

  it('wins at the target after the reveal, records history once, rematch zeroes scores', () => {
    let g = start(3);
    g = r.award(r.listen(g), 1);
    expect(r.winner(g)).toBe(1);
    g = r.next(g);
    expect(g.phase).toBe('win');
    const rec = r.gameRecord(g, ['2000s Bangers']);
    expect(rec).toMatchObject({ game: 'song', title: 'Jordan won 3–0–0', finished: true, packs: ['2000s Bangers'] });
    expect(rec.details).toEqual(['Song 1 — Artist 1: Jordan +3']);
    expect(r.endedRecord(g, [])).toBeNull();
    const again = r.rematch(r.setUpcoming(g, song(9)));
    expect(again.players.every((p) => p.score === 0)).toBe(true);
    expect(again.phase).toBe('ready');
    expect(again.song).toEqual(song(9));
  });

  it('a game thrown away is recorded as ended early only when something was played', () => {
    expect(r.endedRecord(start(), [])).toBeNull();
    const g = r.next(r.award(r.listen(start(10)), 0));
    expect(r.endedRecord(g, [])).toMatchObject({ title: 'Maya led 3–0–0', finished: false });
  });

  it('a saved game resumes as it was; damaged saves are refused', () => {
    const g = r.longer(r.listen(start()));
    const back = r.validGame(JSON.parse(JSON.stringify(g)));
    expect(back).toEqual(g);
    expect(r.validGame({ ...g, phase: 'listen', song: { title: 'x', artist: 'y', apple: 'abc' } })).toBeNull();
    expect(r.validGame({ ...g, phase: 'listen', song: { ...song(2), start: 25 } })).toBeNull();
    expect(r.validGame({ ...g, song: { ...song(2), start: 12.5, youtube: 'dQw4w9WgXcQ' } })?.song).toEqual({ ...song(2), start: 12.5, youtube: 'dQw4w9WgXcQ' });
    expect(r.validGame({ ...g, step: 7 })).toBeNull();
    expect(r.validGame({ ...g, players: [{ name: 'A', score: 0 }] })).toBeNull();
    expect(r.validGame(null)).toBeNull();
    expect(r.validSetup({ target: 99, packIds: 'x' })).toEqual(r.DEFAULT_SETUP);
    expect(r.validSetup({ target: 12, packIds: ['a'] })).toEqual({ target: 12, packIds: ['a'] });
  });

  it('a clip-only song (no Apple track) is known by its video and survives a reload; an unmarked one does not', () => {
    const only: Song = { title: 'Unreleased', artist: 'A Friend', youtube: 'zyxwvutsrqp', clipOnly: true };
    expect(r.songKey(only)).toBe('yt:zyxwvutsrqp');
    expect(r.songKey(song(2))).toBe(String(song(2).apple));
    const g = r.listen({ ...start(), song: only });
    expect(r.validGame(JSON.parse(JSON.stringify(g)))?.song).toEqual(only);
    expect(r.validGame({ ...g, song: { title: 'Old', artist: 'X', youtube: 'zyxwvutsrqp' } })).toBeNull();
    expect(r.validGame({ ...g, song: { ...only, youtube: 'short' } })).toBeNull();
  });

  it('a game saved by the YouTube version is refused, but its scores still reach History', () => {
    const old = { ...r.next(r.award(r.listen(start(10)), 1)), v: 1, song: { title: 'Toxic', artist: 'Britney Spears', youtube: 'LOZuxwVk7TU', start: 69 } };
    expect(r.validGame(JSON.parse(JSON.stringify(old)))).toBeNull();
    expect(r.retiredRecord(old, ['2000s Bangers'])).toMatchObject({ title: 'Jordan led 3–0–0', finished: false, packs: ['2000s Bangers'] });
    expect(r.retiredRecord({ ...old, songsPlayed: 0 }, [])).toBeNull();
    expect(r.retiredRecord(start(), [])).toBeNull();
  });

  it('takes the setup’s players on resume: scores kept by name and by seat on a rename, newcomers at 0, leavers kept in the log', () => {
    let g = r.award(r.listen(start()), 0); // Maya +3
    g = r.next(g);
    g = r.award(r.listen({ ...g, phase: 'ready', song: song(2) }), 2); // Sam +3
    expect(r.withRoster(g, ['Maya', 'Jordan', 'Sam'])).toBe(g);
    expect(r.withRoster(g, ['Maya'])).toBe(g);
    const next = r.withRoster(g, ['Jordan', 'sam', 'Alex']);
    expect(next.players).toEqual([{ name: 'Jordan', score: 0 }, { name: 'sam', score: 3 }, { name: 'Alex', score: 0 }]);
    expect(next.outcome).toEqual({ kind: 'point', scorer: 1, points: 3 });
    expect(next.log.map((x) => [x.by, x.name])).toEqual([[-1, 'Maya'], [1, undefined]]);
    expect(r.gameRecord(next, []).details?.[0]).toMatch(/Maya \+3/);
    const renamed = r.withRoster(g, ['Maia', 'Jordan', 'Sam', 'Kim']);
    expect(renamed.players.map((p) => p.score)).toEqual([3, 0, 3, 0]);
    expect(renamed.log.map((x) => x.by)).toEqual([0, 2]);
  });
});
