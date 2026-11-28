import { describe, expect, it } from 'vitest';
import { GAMES } from '../../app.config';
import { seeded } from '../../lib/room/bots';
import { cardList as cards } from '../../lib/cards/notation';
import type { Card } from '../../lib/cards/deck';
import { choose } from './bot';
import { lowest } from './order';
import * as L from './logic';
import { view } from './view';

function lobby(n: number, settings: Partial<L.Settings> = {}) {
  let g = L.newGame('g', 'BCDF', { ...L.DEFAULT_SETTINGS, ...settings });
  for (let i = 0; i < n; i++) g = (L.join(g, `p${i}`, `P${i}`, new Set()) as { game: L.Game }).game;
  return g;
}
/** A deal set by hand, `p0` to lead (with `first`, the card the first play must hold). */
function rigged(hands: string[], first: string | null = null, settings: Partial<L.Settings> = {}): L.Game {
  const g = L.start(lobby(hands.length, settings), 0, seeded(1));
  return { ...g, hands: Object.fromEntries(g.seats.map((p, i) => [p, cards(hands[i])])), turn: 'p0', table: null, passed: [], first: first ? cards(first)[0] : null };
}
const play = (g: L.Game, pid: string, list: string) => L.play(g, pid, g.at, cards(list), 1);
const pass = (g: L.Game, pid: string) => L.pass(g, pid, g.at, 1);

describe('Big 2 deal', () => {
  it('deals 13 each, sets the rest aside, and the holder of the lowest card dealt leads with it', () => {
    for (const n of [2, 3, 4]) {
      const g = L.start(lobby(n), 0, seeded(n));
      const held = g.seats.flatMap((p) => L.hand(g, p));
      expect([g.seats.length, new Set(held).size, ...g.seats.map((p) => L.hand(g, p).length)]).toEqual([n, 13 * n, ...Array(n).fill(13)]);
      expect([g.phase, g.first, L.hand(g, g.turn!).includes(g.first!)]).toEqual(['turn', lowest(held), true]);
      if (n === 4) expect(g.first).toBe(cards('3d')[0]);
    }
  });

  it('seats as many players as the Games page says', () => {
    expect(GAMES.find((g) => g.id === 'big2')!.players).toMatch(new RegExp(`^${L.MIN_PLAYERS}–${L.MAX_PLAYERS} players`));
  });
});

describe('Big 2 tricks', () => {
  it('the first play must hold the lowest card; then play goes round in seat order, each beating the table', () => {
    const g = rigged(['3d 9s', '4c Kd', '5h 2s'], '3d');
    expect(play(g, 'p0', '9s')).toBe(g);
    const a = play(g, 'p0', '3d');
    expect([a.turn, a.first, a.table?.by]).toEqual(['p1', null, 'p0']);
    expect(play(a, 'p1', '4c')).not.toBe(a);
    expect(play(a, 'p1', '4c Kd')).toBe(a); // not a hand, and the wrong size
    expect(play(play(a, 'p1', '4c'), 'p2', '5h').turn).toBe('p0');
  });

  it('a pass sits the player out until the trick ends; when everyone else passed, the last to play leads', () => {
    const g = play(rigged(['8d 9s 3c', '4c Kd 5d', '5h 2s 6d']), 'p0', '8d');
    const b = pass(g, 'p1');
    expect([b.turn, b.passed]).toEqual(['p2', ['p1']]);
    const c = play(b, 'p2', '2s');
    expect(c.turn).toBe('p0'); // p1 passed: skipped
    const d = pass(c, 'p0');
    expect([d.turn, d.table, d.passed, d.log.at(-1)]).toMatchObject(['p2', null, [], { k: 'lead', by: 'p2' }]);
    expect(pass(d, 'p2')).toBe(d); // the player leading cannot pass
  });

  it('ignores a play or pass out of turn, of cards not held, repeated, stale, or while paused', () => {
    const g = rigged(['8d 9s', '4c Kd', '5h 2s']);
    const t = play(g, 'p0', '8d');
    expect([play(g, 'p1', '4c'), play(g, 'p0', '2s'), L.play(g, 'p0', g.at, [cards('8d')[0], cards('8d')[0]], 1), L.play(g, 'p0', g.at - 1, cards('8d'), 1)])
      .toEqual([g, g, g, g]);
    expect(pass(t, 'p2')).toBe(t);
    const paused = L.pause(t, 1);
    expect(pass(paused, 'p1')).toBe(paused);
  });
});

describe('Big 2 scoring', () => {
  it('ends the deal when a player has no cards: one point a card, doubled from 10, tripled with all 13', () => {
    expect([1, 9, 10, 12, 13].map(L.points)).toEqual([1, 9, 20, 24, 39]);
    const g = { ...rigged(['8d', '4c Kd', '5h 2s 6d 7d 8s 9s 10s Js Qs Ks Ah 3h'], null, { deals: 3 }) };
    const r = play(g, 'p0', '8d');
    expect([r.phase, r.result, r.totals]).toEqual(['result', { out: 'p0', rows: [{ pid: 'p0', cards: 0, points: 0 }, { pid: 'p1', cards: 2, points: 2 }, { pid: 'p2', cards: 12, points: 24 }] }, { p0: 0, p1: 2, p2: 24 }]);
    expect(r.log.at(-1)).toMatchObject({ k: 'done', by: 'p0' });
  });

  it('the next deal is led by the last winner, their lowest card not forced; after the last deal the game is over, fewest points first', () => {
    const r = play(rigged(['8d', '4c Kd', '5h 2s'], null, { deals: 2 }), 'p0', '8d');
    expect(L.tick(r, r.deadline! - 1)).toBe(r);
    const next = L.tick(r, r.deadline!, seeded(4));
    expect([next.phase, next.deal, next.turn, next.first]).toEqual(['turn', 2, 'p0', null]);
    const end = play({ ...next, hands: { ...next.hands, p1: cards('3d') }, turn: 'p1' }, 'p1', '3d');
    expect([end.phase, L.standings(end).map((p) => p.pid)]).toEqual(['over', ['p1', 'p0', 'p2']]);
  });
});

describe('Big 2 timer', () => {
  it('when time runs out the game passes for that player, or leading plays their lowest legal single', () => {
    const g = rigged(['3d 9s', '4c Kd', '5h 2s'], '3d');
    expect(L.tick(g, g.deadline! - 1)).toBe(g);
    const led = L.tick(g, g.deadline!);
    expect([led.table?.combo.cards, led.turn]).toEqual([cards('3d'), 'p1']);
    const passed = L.tick(led, led.deadline!);
    expect([passed.passed, passed.turn]).toEqual([['p1'], 'p2']);
    const untimed = rigged(['3d 9s', '4c Kd'], null, { seconds: 0 });
    expect([untimed.deadline, L.tick(untimed, 1e9), L.step(untimed, 1).table?.by]).toEqual([null, untimed, 'p0']);
  });

  it('stops the clock while paused', () => {
    const g = L.pause(rigged(['3d', '4c']), 5000);
    expect(L.tick(g, 1e9)).toBe(g);
    expect(L.resume(g, 100_000).deadline).toBe(125_000);
  });
});

describe('Big 2 players', () => {
  it('a removed player’s cards are set aside, their turn passes on, and they score what they held', () => {
    const g = rigged(['3d 9s', '4c Kd', '5h 2s']);
    const k = L.kick(g, 'p0', 1);
    expect([L.hand(k, 'p0'), k.seats, k.turn, k.table, k.log.at(-1)?.k, k.gone]).toEqual([[], ['p1', 'p2'], 'p1', null, 'gone', { p0: 2 }]);
  });

  it('a trick whose last play was made by a player who left goes to the next player still in it, to lead', () => {
    const g = pass(play(rigged(['3d 9s', '4c Kd', '5h 2s', '6h 7h']), 'p0', '9s'), 'p1');
    const left = L.leave(g, 'p0', 2); // p2 on turn, p1 passed
    expect([left.turn, left.table, left.passed]).toEqual(['p2', null, []]);
    const after = L.leave(pass(g, 'p2'), 'p0', 2); // p3 on turn, p1 and p2 passed
    expect(after.turn).toBe('p3');
  });

  it('fewer than two left ends the game; one who left comes back dealt in at the next deal, keeping their points', () => {
    expect(L.leave(rigged(['3d', '4c']), 'p1', 1).phase).toBe('over');
    const g = L.leave(rigged(['3d 9s', '4c Kd', '5h 2s'], null, { deals: 3 }), 'p2', 1);
    const back = (L.join(g, 'p2', 'P2', new Set()) as { game: L.Game }).game;
    expect([L.playing(back, 'p2'), view(back, 1, 'p2').players.find((p) => p.pid === 'p2')?.watching]).toEqual([false, 'deal']);
    const r = play(back, 'p0', '9s');
    const done = play({ ...r, hands: { ...r.hands, p1: cards('Kd') } }, 'p1', 'Kd');
    expect([done.result?.rows.find((x) => x.pid === 'p2')?.points, L.tick(done, done.deadline!, seeded(2)).seats]).toEqual([2, ['p0', 'p1', 'p2']]);
  });

  it('a late joiner watches until the next game', () => {
    const g = (L.join(rigged(['3d', '4c']), 'late', 'Late', new Set()) as { game: L.Game }).game;
    expect(view(g, 1, 'late').players.find((p) => p.pid === 'late')?.watching).toBe('game');
    expect(L.start(L.rematch(g, 'g2', L.DEFAULT_SETTINGS), 0, seeded(2)).seats).toEqual(['p0', 'p1', 'late']);
  });
});

describe('Big 2 games', () => {
  it('random games with bots, removals and players coming back keep every card in one place and end', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const rand = seeded(seed);
      let g = L.start(lobby(4, { deals: 3 }), 0, rand);
      for (let t = 1; g.phase !== 'over' && t < 5000; t++) {
        const r = rand();
        const seated = g.seats.filter((p) => L.playing(g, p));
        if (r < 0.01 && seated.length > 2) g = L.leave(g, seated[Math.floor(rand() * seated.length)], t);
        else if (r < 0.02 && g.left.length) g = (L.join(g, g.left[0], 'Back', new Set()) as { game: L.Game }).game;
        else if (g.phase === 'turn' && r < 0.8) {
          const m = choose(view(g, t, g.turn!))!;
          g = m.t === 'play' ? L.play(g, g.turn!, g.at, m.cards, t) : L.pass(g, g.turn!, g.at, t);
        } else g = L.step(g, t, rand);
        const held: Card[] = Object.values(g.hands).flat();
        expect(new Set(held).size).toBe(held.length);
        for (const p of Object.keys(g.hands)) if (!g.seats.includes(p)) expect(L.hand(g, p)).toEqual([]);
        if (g.phase === 'turn') expect([L.playing(g, g.turn!), L.hand(g, g.turn!).length > 0]).toEqual([true, true]);
      }
      expect(g.phase).toBe('over');
      const totals = L.standings(g).map((p) => L.total(g, p.pid));
      expect(totals).toEqual([...totals].sort((a, b) => a - b));
    }
  });
});
