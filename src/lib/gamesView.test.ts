import { describe, expect, it } from 'vitest';
import { GAMES } from '../app.config';
import { categories, clearFilters, deleteCategory, EMPTY, freeName, MAX_OWN, markOpened, nameProblem, nextId, pickedLabel, putCategory, readState, shownGames, togglePick, type GamesState } from './gamesView';

const ids = (s: GamesState) => shownGames(s).map((g) => g.id);
const put = (s: GamesState, name: string, games: string[] = []) => {
  const next = putCategory(s, { id: nextId(s.own), name, games: games as never });
  if (typeof next === 'string') throw new Error(next);
  return next;
};

describe('categories', () => {
  it('lists the default ones with games, in their order, then the phone’s own', () => {
    const own = put(EMPTY, 'Chill').own;
    expect(categories(own).map((c) => c.name)).toEqual(['One phone', 'Own phones', 'Teams', 'Words', 'Drawing', 'Trivia', 'Cards', 'Funny', 'Chill']);
    expect(categories([]).find((c) => c.name === 'Teams')!.games).toEqual(['dial', 'quiz', 'taboo']);
  });
  it('leaves out a default category no game is in', () => {
    expect(categories([], GAMES.filter((g) => g.id !== 'quiz' && g.id !== 'trivia')).map((c) => c.name)).not.toContain('Trivia');
  });
});

describe('shownGames', () => {
  it('needs a game to be in every picked category', () => {
    const s = togglePick(togglePick(EMPTY, 'tag:Words'), 'tag:Teams');
    expect(ids(s)).toEqual(['taboo']);
    expect(ids(togglePick(s, 'tag:Teams'))).toEqual(['forehead', 'gibberish', 'taboo', 'quick', 'salad', 'odd']);
  });
  it('sorts A–Z and by last opened, never-opened games after in default order', () => {
    expect(ids({ ...EMPTY, order: 'az' }).slice(0, 3)).toEqual(['hand', 'big2', 'quiz']);
    const s = markOpened(markOpened({ ...EMPTY, order: 'recent' }, 'hand', 100), 'dial', 200);
    expect(ids(s).slice(0, 4)).toEqual(['dial', 'hand', 'forehead', 'gibberish']);
    expect(shownGames(s, GAMES, { hand: 100 }).slice(0, 2).map((g) => g.id)).toEqual(['hand', 'forehead']); // the times the page opened with
  });
  it('clears the picked categories only', () => {
    expect(clearFilters({ ...EMPTY, picked: ['tag:Teams'], order: 'az' })).toEqual({ ...EMPTY, order: 'az' });
  });
  it('labels the closed box by what is picked, in chip order', () => {
    const cats = categories([]);
    expect(pickedLabel(cats, [])).toBe('All categories');
    expect(pickedLabel(cats, ['tag:Teams'])).toBe('Teams');
    expect(pickedLabel(cats, ['tag:Funny', 'tag:Teams', 'tag:Words'])).toBe('Teams + 2');
    expect(pickedLabel(cats, ['tag:Gone'])).toBe('All categories');
  });
});

describe('own categories', () => {
  it('refuses an empty, too long or taken name, ignoring case', () => {
    const s = put(EMPTY, 'Chill');
    expect(nameProblem('  ', s.own)).toBeTruthy();
    expect(nameProblem('x'.repeat(21), s.own)).toBeTruthy();
    expect(nameProblem('x'.repeat(20), s.own)).toBe('');
    expect(nameProblem('chill', s.own)).toBeTruthy();
    expect(nameProblem('TEAMS', s.own)).toBeTruthy();
    expect(nameProblem('all', s.own)).toBeTruthy(); // the chip showing every game
    expect(nameProblem('Chill ', s.own, s.own[0].id)).toBe(''); // renaming to itself
  });
  it('renames in place, keeps games in app order and stops at the most', () => {
    let s = put(EMPTY, ' Late   night ', ['hand', 'dial']);
    expect(s.own[0]).toEqual({ id: 'own1', name: 'Late night', games: ['dial', 'hand'] });
    s = putCategory(s, { ...s.own[0], name: 'Late' }) as GamesState;
    expect(s.own.map((c) => c.name)).toEqual(['Late']);
    for (let i = 1; i < MAX_OWN; i++) s = put(s, `C${i}`);
    expect(typeof putCategory(s, { id: nextId(s.own), name: 'One more', games: [] })).toBe('string');
  });
  it('deleting one unpicks it', () => {
    const s = togglePick(put(EMPTY, 'Chill', ['salad']), 'own1');
    expect(ids(s)).toEqual(['salad']);
    expect(deleteCategory(s, 'own1')).toEqual(EMPTY);
  });
});

describe('readState', () => {
  it('falls back to the defaults for missing or broken data', () => {
    expect(readState(null)).toEqual(EMPTY);
    expect(readState('oops')).toEqual(EMPTY);
    expect(readState({ order: 'sideways', picked: 'x', own: {}, opened: [] })).toEqual(EMPTY);
  });
  it('keeps what still makes sense and drops the rest', () => {
    const s = readState({
      order: 'recent', players: 4, // a field older versions kept: dropped
      picked: ['tag:Teams', 'tag:Nope', 'own1', 'own2', 'tag:Teams'],
      own: [{ id: 'own1', name: 'Chill', games: ['salad', 'song', 7] }, { id: 'own2', name: 'chill', games: [] }, { id: 'x', name: 'Y', games: [] }],
      opened: { dial: 5, song: 9, quiz: -1, hand: 'x' },
    });
    expect(s).toEqual({ order: 'recent', picked: ['tag:Teams', 'own1'], own: [{ id: 'own1', name: 'Chill', games: ['salad'] }], opened: { dial: 5 } });
  });
  it('keeps an own category whose name a default one took since, under a free name', () => {
    const s = readState({ own: [{ id: 'own1', name: 'teams', games: ['hand'] }, { id: 'own2', name: 'Teams 2', games: [] }, { id: 'own3', name: 'All', games: [] }] });
    expect(s.own.map((c) => c.name)).toEqual(['teams 3', 'Teams 2', 'All 2']);
    expect(s.own[0].games).toEqual(['hand']);
    expect(freeName('x'.repeat(20), [])).toBe(`${'x'.repeat(18)} 2`);
  });
});
