import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, newGame, type Game } from './core';
import * as G from './guess';
import * as L from './logic';
import { hintPlaces, hintsDue, shape } from './hint';
import { isClose, isMatch } from './match';
import { view } from './view';

const pids = ['a', 'b', 'c'];
const at = 1000;
const online = new Set(pids);
const words = ['Lamp', 'Cat', 'Fire truck', 'Moon', 'Sock', 'Tree', 'Bell', 'Kite', 'Rain', 'Ship', 'Drum', 'Hat', 'Pear', 'Fox', 'Bus', 'Egg', 'Map', 'Owl'];
const start = (rounds = 2) => G.startGuess({
  ...newGame('room', 'BCDF', { ...DEFAULT_SETTINGS, mode: 'guess', rounds }),
  players: pids.map((pid) => ({ pid, name: pid.toUpperCase(), score: 0 })),
}, [...words], at);
const picked = (g: Game, i = 0) => G.pick(g, g.dg!.drawer, g.at, i, at, () => 0);
const score = (g: Game) => Object.fromEntries(g.players.map((p) => [p.pid, p.score]));

describe('Draw & guess', () => {
  it('matches guesses ignoring case, spaces, punctuation and a leading article; one letter off is close', () => {
    expect(isMatch('  the FIRE-truck! ', 'Fire truck')).toBe(true);
    expect(isMatch('a lamp', 'Lamp')).toBe(true);
    expect(isMatch('lamps', 'Lamp')).toBe(false);
    expect(isMatch('', 'Lamp')).toBe(false);
    expect(isClose('lamb', 'Lamp')).toBe(true);
    expect(isClose('lam', 'Lamp')).toBe(true);
    expect(isClose('lamps', 'Lamp')).toBe(true);
    expect(isClose('lamp', 'Lamp')).toBe(false);
    expect(isClose('cot', 'Cat')).toBe(false);
    expect(isClose('lbmb', 'Lamp')).toBe(false);
  });

  it('shows the shape, a letter at half time and another at three quarters, never over a third', () => {
    expect(shape("Jack-o'-lantern", [])).toBe("____-_'-_______");
    expect(shape('Fire truck', [1])).toBe('_i__ _____');
    expect(hintsDue(80000, 80000)).toBe(0);
    expect(hintsDue(40000, 80000)).toBe(1);
    expect(hintsDue(20000, 80000)).toBe(2);
    expect(hintPlaces('Cat')).toHaveLength(1);
    expect(hintPlaces('Ox')).toHaveLength(0);
    expect(hintPlaces('Fire truck')).toHaveLength(2);
    let g = picked(start());
    const total = g.total;
    const word = g.dg!.word;
    g = L.tick(g, at + total / 2, online);
    expect(view(g, at, 'b').shape!.replace(/_/g, '')).toHaveLength(1);
    g = L.tick(g, at + total * 0.8, online);
    expect(g.dg!.shown).toBe(Math.min(2, Math.floor(word.length / 3)));
  });

  it('takes turns in seat order, offers three new words each turn, and takes the first when time runs out', () => {
    let g = start();
    const offered: string[] = [];
    const drawers: string[] = [];
    for (let turn = 0; turn < 6; turn++) {
      expect(g.phase).toBe('pick');
      drawers.push(g.dg!.drawer);
      offered.push(...g.dg!.offer);
      expect(view(g, at, g.dg!.drawer).offer).toHaveLength(3);
      expect(view(g, at, 'x').offer).toBeUndefined();
      g = L.tick(g, g.deadline!, online);
      expect(g.dg!.word).toBe(offered.at(-3));
      g = L.tick(g, g.deadline!, online);
      g = L.tick(g, g.deadline!, online);
      if (turn === 2) { expect(g.phase).toBe('scores'); g = L.tick(g, g.deadline!, online); }
    }
    expect(drawers).toEqual([...pids, ...pids]);
    expect(new Set(offered).size).toBe(18);
    expect(g.phase).toBe('over');
  });

  it('scores 50 + 450 × the time left, the drawer the average over all guessers, rounded to 5', () => {
    expect(G.guessPoints(80000, 80000)).toBe(500);
    expect(G.guessPoints(0, 80000)).toBe(50);
    expect(G.guessPoints(30000, 80000)).toBe(220);
    expect(G.drawerPoints([500, 220], 2)).toBe(360);
    expect(G.drawerPoints([500], 2)).toBe(250);
    let g = picked(start());
    const word = g.dg!.word;
    g = G.guess(g, 'b', g.at, 'nope', at + 10000);
    g = G.guess(g, 'b', g.at, word.toLowerCase(), at + 20000);
    expect(G.guess(g, 'b', g.at, word, at + 20000)).toBe(g);
    expect(G.guess(g, 'a', g.at, word, at + 20000)).toBe(g);
    expect(g.dg!.feed.map((f) => f.got ? `${f.name} got it` : `${f.name}: ${f.text}`)).toEqual(['B: nope', 'B got it']);
    expect(view(g, at, 'b').word).toBe(word);
    expect(view(g, at, 'c').word).toBeUndefined();
    g = L.tick(g, g.deadline!, online);
    expect(g.phase).toBe('reveal');
    const b = G.guessPoints(60000, 80000);
    expect(b).toBe(390);
    expect(score(g)).toEqual({ a: 195, b, c: 0 });
  });

  it('tells only the guesser "Close!" and ends the turn when everyone present has it', () => {
    let g = picked(start());
    expect(g.dg!.word).toBe('Lamp');
    g = G.guess(g, 'b', g.at, 'lamb', at);
    expect(view(g, at, 'b').close).toBe('lamb');
    expect(view(g, at, 'c').close).toBeUndefined();
    expect(view(g, at).feed?.at(-1)).toMatchObject({ name: 'B', text: 'lamb' });
    expect(view(G.guess(g, 'b', g.at, 'chair', at), at, 'b').close).toBeUndefined();
    g = G.guess(g, 'b', g.at, 'lamp', at);
    expect(L.tick(g, at + 1, online).phase).toBe('guess');
    expect(L.tick(g, at + 1, new Set(['a', 'b'])).phase).toBe('reveal');
  });

  it('applies a guess that arrives as a hint falls due, after the clock has ticked', () => {
    const g = picked(start());
    const half = at + g.total / 2;
    const ticked = L.tick(g, half, online);
    expect(ticked.dg!.shown).toBe(1);
    expect(ticked.at).toBe(g.at);
    expect(L.act(ticked, 'b', { t: 'guess', at: g.at, text: 'lamp' }, half).dg!.got.map((x) => x.pid)).toEqual(['b']);
    expect(L.act(L.pause(g, at), 'b', { t: 'guess', at: g.at, text: 'lamp' }, at).dg!.got).toEqual([]);
  });

  it('averages the drawer over everyone who got it plus the rest online, and pays no removed drawer', () => {
    let g = picked(start(), 0);
    g = G.guess(g, 'b', g.at, 'lamp', at);
    g = L.leave(g, 'b');
    // b got it and left, c is offline: one guesser, so the drawer gets b's 500.
    expect(L.tick(g, g.deadline!, new Set(['a'])).players.find((p) => p.pid === 'a')!.score).toBe(500);
    // c online and without it: the average of 500 and 0.
    expect(L.tick(g, g.deadline!, new Set(['a', 'c'])).players.find((p) => p.pid === 'a')!.score).toBe(250);
    expect(L.tick(L.kick(g, 'a'), g.deadline!, new Set(['c'])).dg!.points.find((x) => x.pid === 'a')!.points).toBe(0);
  });

  it('keeps the drawer\'s away clock running from the pick into the drawing', () => {
    const g = start();
    const off = new Set(['b', 'c']);
    const away = L.tick(g, at + 9000, off);
    const drawing = L.tick(away, g.deadline!, off);
    expect(drawing.phase).toBe('guess');
    expect(L.tick(drawing, at + 9000 + G.AWAY_MS, off).phase).toBe('reveal');
  });

  it('gives reconnecting phones a grace after the host reopens: nobody away, nobody missing', () => {
    let g = picked(start());
    g = G.guess(g, 'b', g.at, 'lamp', at);
    const reopened = L.afterReload(g, at + 100);
    // Only b is back: not "everyone present has it", and the absent drawer is not away yet.
    const soon = L.tick(reopened, at + 5000, new Set(['b']));
    expect(soon.phase).toBe('guess');
    expect(soon.dg!.away).toBeNull();
    expect(L.tick(reopened, at + 100 + 10000, new Set(['a', 'b'])).phase).toBe('reveal');
  });

  it('ends the turn when the drawer has been offline for 10 seconds, or leaves', () => {
    const g = picked(start());
    const away = L.tick(g, at + 100, new Set(['b', 'c']));
    expect(away.dg!.away).toBe(at + 100);
    expect(L.tick(away, at + 100 + G.AWAY_MS - 1, new Set(['b', 'c'])).phase).toBe('guess');
    expect(L.tick(away, at + 100 + G.AWAY_MS, new Set(['b', 'c'])).phase).toBe('reveal');
    expect(L.tick(away, at + 200, online).dg!.away).toBeNull();
    expect(L.tick(L.leave(g, 'a'), at + 1, online).phase).toBe('reveal');
    const pick = start();
    expect(L.tick(L.kick(pick, 'a'), at + 1, online)).toMatchObject({ phase: 'pick', dg: { drawer: 'b' } });
  });
});
