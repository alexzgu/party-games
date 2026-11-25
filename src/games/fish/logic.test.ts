import { describe, expect, it } from 'vitest';
import { GAMES } from '../../app.config';
import { seeded } from '../../lib/room/bots';
import { cardOf, rankOf, type Card, type Rank } from '../../lib/cards/deck';
import * as L from './logic';
import { view } from './view';

const SUIT = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' } as const;
/** "7s 7h Kd": cards by rank (A, 2–10, J, Q, K) and suit letter. */
const cards = (list: string): Card[] => list.split(' ').filter(Boolean).map((x) => {
  const r = x.slice(0, -1);
  return cardOf(({ A: 1, J: 11, Q: 12, K: 13 } as Record<string, number>)[r] ?? +r, SUIT[x.slice(-1) as keyof typeof SUIT]);
});

function lobby(n: number, seconds = 30) {
  let g = L.newGame('g', 'BCDF', { seconds });
  for (let i = 0; i < n; i++) g = (L.join(g, `p${i}`, `P${i}`, new Set()) as { game: L.Game }).game;
  return g;
}
/** A game dealt by hand, `p0` to play (begin's rules apply). */
function rigged(hands: string[], pool: string, books: Rank[][] = []): L.Game {
  const g = lobby(hands.length);
  const seats = g.players.map((p) => p.pid);
  return L.begin({
    ...g, seats, pool: cards(pool),
    hands: Object.fromEntries(seats.map((p, i) => [p, cards(hands[i])])),
    books: Object.fromEntries(seats.map((p, i) => [p, books[i] ?? []])),
  }, 'p0', 0);
}
const ask = (g: L.Game, pid: string, to: string, rank: Rank) => L.ask(g, pid, g.at, to, rank, 1);
const ranks = (g: L.Game, pid: string) => L.hand(g, pid).map(rankOf).sort((a, b) => a - b);
const kinds = (g: L.Game) => g.shown.map((e) => e.k);

/** Every one of the 52 cards is in exactly one place: a hand, the pool, or a book. */
function accounted(g: L.Game) {
  const loose = [...Object.values(g.hands).flat(), ...g.pool];
  const booked = Object.values(g.books).flat();
  expect(new Set(loose).size).toBe(loose.length);
  expect(new Set(booked).size).toBe(booked.length);
  expect(loose.some((c) => booked.includes(rankOf(c)))).toBe(false);
  expect(loose.length + booked.length * 4).toBe(52);
}

describe('Go Fish deal', () => {
  it('deals 7 each to 2 or 3 players and 5 each to 4 to 6, the rest to the pool, and a random player starts', () => {
    for (const [n, each] of [[2, 7], [3, 7], [4, 5], [6, 5]]) {
      const g = L.start(lobby(n), 0, seeded(n));
      const held = g.seats.map((p) => L.hand(g, p).length + (g.books[p] ?? []).length * 4);
      expect(held).toEqual(Array(n).fill(each));
      expect(g.pool.length).toBe(52 - n * each);
      expect([g.phase, g.seats.includes(g.turn!)]).toEqual(['turn', true]);
      accounted(g);
    }
    const firsts = new Set(Array.from({ length: 20 }, (_, i) => L.start(lobby(4), 0, seeded(i)).turn));
    expect(firsts.size).toBeGreaterThan(1);
  });

  it('lays a book from the deal at once', () => {
    let rand = 0;
    let g: L.Game;
    do g = L.start(lobby(2), 0, seeded(rand++)); while (!Object.values(g.books).flat().length && rand < 5000);
    const [who, laid] = Object.entries(g.books).find(([, b]) => b.length)!;
    expect(g.log.some((e) => e.k === 'book' && e.by === who && e.rank === laid[0])).toBe(true);
    accounted(g);
  });

  it('seats as many players as the Games page says', () => {
    expect(GAMES.find((g) => g.id === 'fish')!.players).toMatch(new RegExp(`^${L.MIN_PLAYERS}–${L.MAX_PLAYERS} players`));
  });
});

describe('Go Fish turns', () => {
  it('moves every card of the rank asked for to the asker, who goes again', () => {
    const g = ask(rigged(['7s 2h', '7h 7d 9c'], 'Ks Qs'), 'p0', 'p1', 7);
    expect([ranks(g, 'p0'), ranks(g, 'p1'), g.pool.length]).toEqual([[2, 7, 7, 7], [9], 2]);
    expect(g.shown[0]).toMatchObject({ k: 'asked', by: 'p0', from: 'p1', rank: 7, got: 2 });
    expect([g.phase, L.upcoming(g)]).toEqual(['show', 'p0']);
    expect(L.step(g, 2).turn).toBe('p0');
  });

  it('go fish: draws the top of the pool and passes the turn on in seat order', () => {
    const g = ask(rigged(['7s', '9h', '4d'], 'Ks Qs'), 'p0', 'p2', 7);
    expect([ranks(g, 'p0'), g.pool, kinds(g), L.upcoming(g)]).toEqual([[7, 13], cards('Qs'), ['asked', 'drew'], 'p1']);
    expect(g.shown[0]).toMatchObject({ got: 0 });
    expect(g.drew).toBe(cards('Ks')[0]);
    expect(L.step(g, 2)).toMatchObject({ phase: 'turn', turn: 'p1' });
  });

  it('fishing the rank asked for shows it and keeps the turn', () => {
    const g = ask(rigged(['7s', '9h'], '7c Qs'), 'p0', 'p1', 7);
    expect(g.shown[1]).toMatchObject({ k: 'drew', by: 'p0', why: 'fish', rank: 7 });
    expect(L.upcoming(g)).toBe('p0');
  });

  it('lays down four of a rank at once, from an ask or a fish', () => {
    const g = ask(rigged(['7s 7h 2c', '7d 7c 9h'], 'Ks'), 'p0', 'p1', 7);
    expect([kinds(g), g.books.p0, ranks(g, 'p0')]).toEqual([['asked', 'book'], [7], [2]]);
    const fished = ask(rigged(['2s 2h 2d 9c', '5h'], '2c'), 'p0', 'p1', 9);
    expect([kinds(fished), fished.books.p0, L.upcoming(fished)]).toEqual([['asked', 'drew', 'book'], [2], 'p1']);
    accounted(L.start(lobby(3), 0, seeded(4)));
  });

  it('a player with an empty hand draws one and then asks; with the pool empty they are skipped', () => {
    const drew = rigged(['', '9h', '4d'], 'Ks Qs');
    expect([drew.turn, ranks(drew, 'p0'), drew.log.at(-1)]).toEqual(['p0', [13], expect.objectContaining({ k: 'drew', why: 'empty' })]);
    const skipped = rigged(['', '9h', '4d'], '');
    expect([skipped.turn, skipped.log.at(-1)]).toEqual(['p1', expect.objectContaining({ k: 'skip', by: 'p0' })]);
  });

  it('with nobody else holding a card, the asker draws one and the turn passes', () => {
    const g = rigged(['5s', '', ''], 'Ks Qs 2d');
    expect(g.log.map((e) => [e.k, e.by])).toEqual([['drew', 'p0'], ['drew', 'p1']]);
    expect(g.log[0]).toMatchObject({ why: 'nobody' });
    expect([g.turn, ranks(g, 'p0'), ranks(g, 'p1')]).toEqual(['p1', [5, 13], [12]]);
  });

  it('a go fish with the pool empty passes the turn', () => {
    const g = ask(rigged(['7s', '9h', '4d'], ''), 'p0', 'p1', 7);
    expect([kinds(g), L.upcoming(g)]).toEqual([['asked', 'dry'], 'p1']);
  });

  it('ignores an ask out of turn, for a rank not held, of yourself, of a player with no cards or not in the game, a stale one, or while paused', () => {
    const g = rigged(['7s 2h', '7h', '', '9d'], 'Ks');
    const late = (L.join(g, 'late', 'Late', new Set()) as { game: L.Game }).game;
    expect(ask(late, 'p1', 'p0', 7)).toBe(late); // not their turn
    expect(ask(late, 'p0', 'p1', 9)).toBe(late); // a rank they do not hold
    expect(ask(late, 'p0', 'p0', 7)).toBe(late); // themselves
    expect(ask(late, 'p0', 'p2', 7)).toBe(late); // no cards
    expect(ask(late, 'p0', 'late', 7)).toBe(late); // watching, not dealt in
    expect(ask(late, 'p0', 'nobody', 7)).toBe(late);
    const gone = L.kick(late, 'p3', 1);
    expect(ask(gone, 'p0', 'p3', 7)).toBe(gone); // removed
    expect(L.ask(late, 'p0', late.at - 1, 'p1', 7, 1)).toBe(late); // a stale turn
    const paused = L.pause(late, 1);
    expect(ask(paused, 'p0', 'p1', 7)).toBe(paused);
    expect(ask(late, 'p0', 'p1', 7)).not.toBe(late);
  });

  it('when the turn times out, asks for that player: a rank they hold from a player with cards', () => {
    for (let s = 0; s < 10; s++) {
      const g = rigged(['7s 2h', '7h', '', '9d'], 'Ks');
      expect(L.tick(g, 29_999, seeded(s))).toBe(g);
      const t = L.tick(g, 30_000, seeded(s));
      const a = t.shown[0] as Extract<L.Event, { k: 'asked' }>;
      expect([t.phase, a.k, a.by, [2, 7].includes(a.rank), ['p1', 'p3'].includes(a.from)]).toEqual(['show', 'asked', 'p0', true, true]);
    }
    const untimed = L.begin({ ...rigged(['7s', '9h'], ''), settings: { seconds: 0 } }, 'p0', 0);
    expect([untimed.deadline, L.tick(untimed, 1e9).phase, L.step(untimed, 1).phase]).toEqual([null, 'turn', 'show']);
  });

  it('stops the clock while paused', () => {
    const g = L.pause(rigged(['7s', '9h'], ''), 5000);
    expect(L.tick(g, 1e9).phase).toBe('turn');
    expect(L.resume(g, 100_000).deadline).toBe(125_000);
  });
});

describe('Go Fish players', () => {
  it('shuffles a removed player’s hand back into the pool, keeps their books down and passes their turn', () => {
    const g = rigged(['7s 2h', '7h 9c', '4d'], 'Ks', [[], [3], []]);
    const out = L.kick(g, 'p0', 1, seeded(1));
    expect([L.hand(out, 'p0'), out.pool.length, out.books.p1, out.turn, out.log.at(-1)?.k]).toEqual([[], 3, [3], 'p1', 'gone']);
    const left = L.leave(L.step(ask(g, 'p0', 'p1', 7), 2), 'p1', 3);
    expect([L.hand(left, 'p1'), left.books.p1]).toEqual([[], [3]]);
    const back = (L.join(left, 'p1', 'P1', new Set()) as { game: L.Game }).game;
    expect([L.playing(back, 'p1'), L.hand(back, 'p1'), back.books.p1]).toEqual([true, [], [3]]);
  });

  it('ends when fewer than two players are left', () => {
    const g = L.leave(rigged(['7s', '9h'], 'Ks'), 'p1', 1);
    expect(g.phase).toBe('over');
  });

  it('seats a late joiner to watch, and deals them in at the next deal', () => {
    let g = rigged(['7s', '9h'], 'Ks');
    g = (L.join(g, 'late', 'Late', new Set()) as { game: L.Game }).game;
    expect([g.seats.includes('late'), L.askable(g, 'p0')]).toEqual([false, ['p1']]);
    const next = L.start(L.rematch(g, 'g2', { seconds: 30 }), 0, seeded(2));
    expect(next.seats).toEqual(['p0', 'p1', 'late']);
  });
});

describe('Go Fish end', () => {
  it('plays to the end with all 13 books down and every card always accounted for', () => {
    for (const n of [2, 4, 6]) {
      const rand = seeded(n * 7);
      let g = L.start(lobby(n), 0, rand);
      for (let t = 1; g.phase !== 'over' && t < 5000; t++) {
        g = g.phase === 'turn' ? L.anyAsk(g, t, rand) : L.step(g, t, rand);
        accounted(g);
      }
      expect([g.phase, L.booksDown(g)]).toEqual(['over', 13]);
      const books = L.standings(g).map((p) => g.books[p.pid].length);
      expect(books).toEqual([...books].sort((a, b) => b - a));
    }
  });

  it('ends after the outcome that lays the last book', () => {
    const g = ask(rigged(['7s 7h 7d', '7c'], '', [[1, 2, 3, 4, 5, 6], [8, 9, 10, 11, 12, 13]]), 'p0', 'p1', 7);
    expect([g.phase, L.booksDown(g)]).toEqual(['show', 13]);
    expect(L.step(g, 2).phase).toBe('over');
  });
});

describe('Go Fish turns nobody can play', () => {
  it('a removal that leaves the player on turn nobody to ask settles the turn at once: they draw one and it passes', () => {
    const g = rigged(['7s', '', '9h'], 'Ks Qs'); // p0 on turn; p1 holds nothing, p2 the only other cards
    expect(g.turn).toBe('p0');
    const left = L.leave(g, 'p2', 1, seeded(3));
    expect(left.log.slice(-3).map((e) => [e.k, e.by])).toEqual([['gone', 'p2'], ['drew', 'p0'], ['drew', 'p1']]);
    expect(left.log.at(-2)).toMatchObject({ why: 'nobody' });
    expect([left.phase, left.turn, L.askable(left, 'p1')]).toEqual(['turn', 'p1', ['p0']]);
  });

  it('a timed-out turn with nobody to ask follows the same rule', () => {
    const g0 = rigged(['7s', '', '9h'], 'Ks Qs');
    const g = { ...g0, hands: { ...g0.hands, p2: [] }, pool: [...g0.pool, ...cards('9h')] };
    const t = L.tick(g, 30_000, seeded(1));
    expect(t.log.slice(-2).map((e) => [e.k, e.by, 'why' in e ? e.why : ''])).toEqual([['drew', 'p0', 'nobody'], ['drew', 'p1', 'empty']]);
    expect(t.turn).toBe('p1');
  });

  it('never announces as next a player who will be passed by, nor anyone when the game ends', () => {
    // p0 completes a book with the last of their cards and the pool is empty: they are skipped.
    const g = ask(rigged(['7s 7h 7d', '7c 9h', '4d'], ''), 'p0', 'p1', 7);
    expect([g.from, L.upcoming(g), view(g, 1).next]).toEqual(['p0', 'p1', 'p1']);
    expect(L.step(g, 2).turn).toBe('p1');
    const end = ask(rigged(['7s 7h 7d', '7c'], '', [[1, 2, 3, 4, 5, 6], [8, 9, 10, 11, 12, 13]]), 'p0', 'p1', 7);
    expect([L.upcoming(end), view(end, 1).next]).toEqual([null, undefined]);
  });
});

describe('Go Fish players coming and going', () => {
  it('a removal during the outcome, of the asker or of the next player, passes on to whoever can play', () => {
    const again = ask(rigged(['7s 2h', '7h 9c', '4d'], 'Ks'), 'p0', 'p1', 7); // p0 goes again
    const noAsker = L.kick(again, 'p0', 2, seeded(1));
    expect([noAsker.phase, L.upcoming(noAsker), L.hand(noAsker, 'p0'), noAsker.pool.length]).toEqual(['show', 'p1', [], 4]);
    expect(L.step(noAsker, 3).turn).toBe('p1');
    const passed = ask(rigged(['7s', '9h', '4d'], 'Ks'), 'p0', 'p2', 7); // go fish: p1 is next
    const noNext = L.leave(passed, 'p1', 2, seeded(1));
    expect([L.upcoming(noNext), L.step(noNext, 3).turn]).toEqual(['p2', 'p2']);
  });

  it('a random game with removals, leaving and coming back keeps every card in one place and ends', () => {
    for (const seed of [1, 2, 3, 4]) {
      const rand = seeded(seed);
      let g = L.start(lobby(6), 0, rand);
      for (let t = 1; g.phase !== 'over' && t < 20_000; t++) {
        const r = rand();
        const seated = g.seats.filter((p) => L.playing(g, p));
        const any = (list: string[]) => list[Math.floor(rand() * list.length)];
        if (r < 0.03 && seated.length > 2) g = L.leave(g, any(seated), t, rand);
        else if (r < 0.06 && g.left.length) g = (L.join(g, any(g.left), 'Back', new Set()) as { game: L.Game }).game;
        else if (r < 0.07 && seated.length > 3) g = L.kick(g, any(seated), t, rand);
        else g = L.step(g, t, rand);
        accounted(g);
        for (const p of g.seats) if (!L.playing(g, p)) expect(L.hand(g, p)).toEqual([]);
        if (g.phase === 'turn') expect(L.askable(g, g.turn!).length).toBeGreaterThan(0);
      }
      expect(g.phase).toBe('over');
    }
  });
});

describe('Go Fish clock', () => {
  it('after a host reload mid-turn, a turn whose time ran out meanwhile gets 12 s', () => {
    const g = L.afterReload(rigged(['7s', '9h'], 'Ks'), 40_000);
    expect([g.deadline, g.quiet]).toEqual([52_000, 40_000 + L.RECONNECT_MS]);
    expect(L.tick(g, 51_999).phase).toBe('turn');
    expect(L.tick(g, 52_000).phase).toBe('show');
    expect(L.afterReload(rigged(['7s', '9h'], 'Ks'), 10_000).deadline).toBe(30_000);
  });

  it('a pause during an outcome holds it until resumed', () => {
    const shown = ask(rigged(['7s', '9h'], 'Ks'), 'p0', 'p1', 7);
    const paused = L.pause(shown, 1001);
    expect(L.tick(paused, 1e9).phase).toBe('show');
    const resumed = L.resume(paused, 10_000);
    expect([resumed.deadline, L.tick(resumed, 11_999).phase, L.tick(resumed, 12_000).phase]).toEqual([12_000, 'show', 'turn']);
  });
});
