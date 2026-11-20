import { describe, expect, it, vi } from 'vitest';
import { assignPrompts, pairDuels } from './assign';
import { scoreDuel, scoreFinal, scoreLines, validFinalBallot, FINAL_VOTE_POINTS } from './scoring';
import { loadSettings, validGame } from './store';
import * as L from './logic';
import { gameRecord, standings } from './record';
import { playerView } from './view';
import { parseBroker } from '../../lib/room/broker';
import { cleanCode, isCode, newCode, CODE_LETTERS } from '../../lib/room/code';
import { readToHost } from './protocol';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);
const prompts = (n: number) => Array.from({ length: n }, (_, i) => `Prompt ${i}`);
const draw: L.Draw = (n) => prompts(n);
const SETTINGS: L.Settings = { rounds: 3, answerSecs: 75, voteSecs: 15, packIds: ['classic'] };

/** A room with n players joined from the lobby. */
function room(n: number, settings = SETTINGS): L.Game {
  let g = L.newGame('BCDF', settings);
  for (const pid of ids(n)) g = L.join(g, pid, `Name ${pid}`, new Set()).game;
  return g;
}

function answerAll(g: L.Game): L.Game {
  for (const p of L.present(g)) for (const i of L.tasksFor(g, p.pid)) g = L.answer(g, p.pid, i, `answer by ${p.pid}`);
  return g;
}

describe('prompt assignment', () => {
  it('gives each prompt to exactly 2 different players and each player exactly 2 prompts, for 3–8 players', () => {
    for (let n = 3; n <= 8; n++) {
      for (let trial = 0; trial < 50; trial++) {
        const pairs = assignPrompts(ids(n), prompts(n));
        expect(pairs).toHaveLength(n);
        expect(new Set(pairs.map((p) => p.prompt)).size).toBe(n);
        const count = new Map<string, number>();
        for (const p of pairs) {
          expect(p.a).not.toBe(p.b);
          count.set(p.a, (count.get(p.a) ?? 0) + 1);
          count.set(p.b, (count.get(p.b) ?? 0) + 1);
        }
        expect([...count.values()].every((c) => c === 2)).toBe(true);
        expect(count.size).toBe(n);
      }
    }
  });
  it('faces each player against two different rivals when there are 3+ players', () => {
    const pairs = assignPrompts(ids(5), prompts(5));
    for (const pid of ids(5)) {
      const rivals = pairs.filter((p) => p.a === pid || p.b === pid).map((p) => (p.a === pid ? p.b : p.a));
      expect(new Set(rivals).size).toBe(2);
    }
  });
});

describe('scoring', () => {
  it('splits 1000 by share of votes, times the round', () => {
    expect(scoreDuel('a', 'b', { x: 'a', y: 'a', z: 'b' }, 1).points).toEqual({ a: 667, b: 333 });
    expect(scoreDuel('a', 'b', { x: 'a', y: 'b' }, 2).points).toEqual({ a: 1000, b: 1000 });
  });
  it('adds a bonus for taking every vote, only with 2+ votes', () => {
    const r = scoreDuel('a', 'b', { x: 'b', y: 'b' }, 2);
    expect(r.sweep).toBe('b');
    expect(r.points).toEqual({ a: 0, b: 2000 + 500 });
    expect(scoreDuel('a', 'b', { x: 'a' }, 1)).toEqual({ votes: { a: 1, b: 0 }, points: { a: 1000, b: 0 } });
  });
  it('gives nothing when nobody voted', () => {
    expect(scoreDuel('a', 'b', {}, 1).points).toEqual({ a: 0, b: 0 });
  });
  it('final round: a fixed amount per vote', () => {
    const r = scoreFinal(['a', 'b', 'c'], { a: { b: 2, c: 1 }, b: { c: 3 }, c: { a: 1, b: 2 } });
    expect(r.votes).toEqual({ a: 1, b: 4, c: 4 });
    expect(r.points.b).toBe(4 * FINAL_VOTE_POINTS);
  });
  it('final ballots: 1–3 votes, never your own answer', () => {
    const votable = new Set(['a', 'b', 'c']);
    expect(validFinalBallot('a', { b: 3 }, votable)).toBe(true);
    expect(validFinalBallot('a', { b: 1, c: 1 }, votable)).toBe(true);
    expect(validFinalBallot('a', { a: 1, b: 1 }, votable)).toBe(false);
    expect(validFinalBallot('a', { b: 4 }, votable)).toBe(false);
    expect(validFinalBallot('a', {}, votable)).toBe(false);
    expect(validFinalBallot('a', { z: 1 }, votable)).toBe(false);
  });
});

describe('voting rules', () => {
  it('authors cannot vote on their own prompt; others vote once', () => {
    let g = L.step(answerAll(L.startRound(room(4), draw, 0)), 0, draw);
    expect(g.phase).toBe('vote');
    const item = g.items[g.at] as L.Duel;
    expect(L.vote(g, item.a, 'a')).toBe(g);
    expect(L.vote(g, item.b, 'b')).toBe(g);
    const voter = ids(4).find((p) => p !== item.a && p !== item.b)!;
    g = L.vote(g, voter, 'b');
    expect((g.items[g.at] as L.Duel).ballots[voter]).toBe(item.b);
    expect(L.vote(g, voter, 'a')).toBe(g);
  });
  it('final round: nobody can vote for their own answer', () => {
    let g = room(3, { ...SETTINGS, rounds: 2 });
    g = { ...g, round: 1 };
    g = answerAll(L.startRound(g, draw, 0));
    g = L.step(g, 0, draw);
    const item = g.items[0] as L.Finale;
    const me = item.authors[0];
    const own = item.authors.indexOf(me);
    const other = item.authors.indexOf(item.authors[1]);
    expect(L.voteFinal(g, me, { [own]: 1 })).toBe(g);
    expect(L.voteFinal(g, me, { [other]: 4 })).toBe(g);
    const next = L.voteFinal(g, me, { [other]: 3 });
    expect((next.items[0] as L.Finale).ballots[me]).toEqual({ [item.authors[1]]: 3 });
    // The phone is never shown its own answer to vote for.
    const v = playerView(g, me, 0)!;
    expect(v.screen.k === 'vote3' && v.screen.choices.map((c) => c.id)).not.toContain(own);
  });
  it('nobody can vote for a side with no answer', () => {
    let g = L.startRound(room(4), draw, 0);
    const item = g.items[0] as L.Duel;
    for (const p of L.present(g)) for (const i of L.tasksFor(g, p.pid)) if (!(i === 0 && p.pid === item.b)) g = L.answer(g, p.pid, i, 'ok');
    g = L.step(g, 0, draw);
    expect([g.phase, g.at, g.items[0].answers[item.b]]).toEqual(['vote', 0, null]);
    const voter = L.votersFor(g, g.items[0])[0];
    expect(L.vote(g, voter, 'b')).toBe(g);
    expect((L.vote(g, voter, 'a').items[0] as L.Duel).ballots[voter]).toBe(item.a);
    // The phone shows that side, but as one it cannot pick.
    const v = playerView(g, voter, 0)!.screen;
    expect(v.k === 'vote' && v.choices.map((c) => [c.id, c.empty])).toEqual([['a', false], ['b', true]]);
  });
  it('final round: no votes for an answer that was never sent', () => {
    let g = room(4, { ...SETTINGS, rounds: 2 });
    g = L.startRound({ ...g, round: 1 }, draw, 0);
    const item = g.items[0] as L.Finale;
    const silent = item.authors[1];
    for (const pid of item.authors) if (pid !== silent) g = L.answer(g, pid, 0, `by ${pid}`);
    g = L.step(g, 0, draw);
    const me = item.authors[0];
    expect(L.voteFinal(g, me, { 1: 1 })).toBe(g);
    expect(L.voteFinal(g, me, { 1: 1, 2: 1 })).toBe(g);
    expect((L.voteFinal(g, me, { 2: 1 }).items[0] as L.Finale).ballots[me]).toEqual({ [item.authors[2]]: 1 });
    const v = playerView(g, me, 0)!.screen;
    expect(v.k === 'vote3' && v.choices.map((c) => c.id)).not.toContain(1);
  });
  it('voting closes once every connected voter has voted', () => {
    let g = L.step(answerAll(L.startRound(room(4), draw, 0)), 0, draw);
    const item = g.items[g.at] as L.Duel;
    const voters = ids(4).filter((p) => p !== item.a && p !== item.b);
    const online = new Set(ids(4));
    g = L.vote(g, voters[0], 'a');
    expect(L.tick(g, 1, online, draw).phase).toBe('vote');
    // The other voter's phone is off: no need to wait for them.
    expect(L.tick(g, 1, new Set(ids(4).filter((p) => p !== voters[1])), draw).phase).toBe('reveal');
    g = L.vote(g, voters[1], 'a');
    const r = L.tick(g, 1, online, draw);
    expect(r.phase).toBe('reveal');
    expect(L.player(r, item.a)!.score).toBe(1000 + 250);
  });
});

describe('joining and reconnecting', () => {
  it('a phone that rejoins with its id keeps its score and seat', () => {
    let g = room(3);
    g = { ...g, players: g.players.map((p) => (p.pid === 'p1' ? { ...p, score: 1500 } : p)) };
    const res = L.join(g, 'p1', 'whatever', new Set(['p0', 'p2']));
    expect(res.pid).toBe('p1');
    expect(res.game).toBe(g);
    expect(L.player(res.game, 'p1')!.score).toBe(1500);
  });
  it('a phone that lost its storage takes its old seat back by name, if that seat is offline', () => {
    const g = room(3);
    expect(L.join(g, 'new-id', ' name P1 ', new Set(['p0', 'p2'])).pid).toBe('p1');
    expect(L.join(g, 'new-id', 'Name p1', new Set(['p1'])).error).toMatch(/already called/);
  });
  it('refuses a 9th player and a kicked one', () => {
    const g = room(8);
    expect(L.join(g, 'x', 'Extra', new Set()).error).toMatch(/full/);
    const k = L.kick(g, 'p3');
    expect(L.join(k, 'p3', 'Name p3', new Set()).error).toMatch(/removed/);
    expect(L.present(k)).toHaveLength(7);
  });
  it('late joiners watch until the next round, then play', () => {
    let g = L.startRound(room(3), draw, 0);
    g = L.join(g, 'late', 'Late', new Set()).game;
    expect(L.player(g, 'late')!.active).toBe(false);
    expect(playerView(g, 'late', 0)!.screen.k).toBe('late');
    expect(L.tasksFor(g, 'late')).toEqual([]);
    g = answerAll(g);
    // Through every vote and reveal to the scoreboard, then round 2.
    while (g.phase !== 'scores') g = L.step(g, 0, draw);
    g = L.step(g, 0, draw);
    expect(g.round).toBe(2);
    expect(L.tasksFor(g, 'late')).toHaveLength(2);
  });
  it('a player who drops mid-round gets "(no answer)" and the game goes on', () => {
    let g = L.startRound(room(4), draw, 0);
    for (const p of ['p0', 'p1', 'p2']) for (const i of L.tasksFor(g, p)) g = L.answer(g, p, i, 'ok');
    expect(L.tick(g, 1000, new Set(['p0', 'p1', 'p2']), draw).phase).toBe('write');
    g = L.tick(g, 75000, new Set(['p0', 'p1', 'p2']), draw);
    expect(g.phase).toBe('vote');
    const theirs = g.items.filter((it) => L.authorsOf(it).includes('p3'));
    expect(theirs.every((it) => it.answers.p3 === null)).toBe(true);
    const shown = playerView({ ...g, at: g.items.indexOf(theirs[0]) }, 'p0', 75000)!.screen;
    if (shown.k === 'vote') expect(shown.choices.map((c) => c.text)).toContain(L.NO_ANSWER);
  });
  it('the host reload gives a nearly expired timer a little time back', () => {
    const g = { ...L.startRound(room(3), draw, 0), deadline: 1000 };
    expect(L.afterReload(g, 5000).deadline).toBe(5000 + L.RELOAD_GRACE_MS);
  });
  it('phones never see who wrote an answer before the reveal', () => {
    const g = L.step(answerAll(L.startRound(room(4), draw, 0)), 0, draw);
    const json = JSON.stringify(playerView(g, 'p0', 0));
    for (const pid of ids(4).filter((p) => p !== 'p0')) expect(json).not.toContain(`"${pid}"`);
  });
});

describe('a whole game', () => {
  it('runs 3 rounds by the clock alone, pauses, and records once', () => {
    let g = L.startRound(room(5), draw, 0);
    let now = 0;
    const online = new Set(ids(5));
    const seen = new Set<string>();
    for (let guard = 0; g.phase !== 'over' && guard < 500; guard++) {
      seen.add(`${g.round}:${g.phase}`);
      if (g.phase === 'write') g = answerAll(g);
      if (g.phase === 'vote') {
        const item = g.items[g.at];
        for (const pid of L.votersFor(g, item)) {
          if (item.kind !== 'final') g = L.vote(g, pid, 'a');
          else g = L.voteFinal(g, pid, { [item.authors.indexOf(L.votableFinal(item, pid)[0])]: 3 });
        }
      }
      now += 20000;
      g = L.tick(g, now, online, draw);
    }
    expect(g.phase).toBe('over');
    expect([...seen]).toEqual(expect.arrayContaining(['1:write', '1:vote', '1:reveal', '1:scores', '2:write', '3:write', '3:vote', '3:reveal']));
    expect(g.log).toHaveLength(5 + 5 + 1);
    const rec = gameRecord(g, ['Classic'])!;
    expect(rec.finished).toBe(true);
    expect(rec.scores[0].score).toBe(standings(g)[0].score);
    expect(rec.title).toMatch(/won/);
  });
  it('pausing stops the clock; resuming gives the same time back', () => {
    const g = L.startRound(room(3), draw, 0);
    const p = L.pause(g, 10000);
    expect(p.paused).toBe(65000);
    expect(L.tick(p, 999999, new Set(), draw)).toBe(p);
    expect(L.resume(p, 50000).deadline).toBe(115000);
  });
  it('a game ended early is recorded as unfinished, only if something was scored', () => {
    const g = room(3);
    expect(gameRecord(L.endEarly(g), [])).toBeNull();
    const scored = { ...g, players: g.players.map((p, i) => ({ ...p, score: i * 100 })) };
    const rec = gameRecord(L.endEarly(scored), [])!;
    expect(rec.finished).toBe(false);
    expect(rec.title).toMatch(/led/);
  });
  it('2 rounds means one head-to-head round, then the final', () => {
    let g = L.startRound(room(3, { ...SETTINGS, rounds: 2 }), draw, 0);
    expect(g.items[0].kind).toBe('duel');
    g = answerAll(g);
    while (g.phase !== 'scores') g = L.step(g, 0, draw);
    g = L.step(g, 0, draw);
    expect(g.items).toHaveLength(1);
    expect(g.items[0].kind).toBe('final');
  });
});

describe('what a phone with nothing to do sees', () => {
  const screen = (g: L.Game, pid: string) => playerView(g, pid, 0)!.screen;
  it('who is still writing, only once this phone is done', () => {
    let g = L.startRound(room(4), draw, 0);
    const busy = screen(g, 'p0');
    expect(busy.k === 'write' && busy.writers).toBeUndefined();
    for (const i of L.tasksFor(g, 'p0')) g = L.answer(g, 'p0', i, 'done');
    const done = screen(g, 'p0');
    expect(done.k === 'write' && done.writers!.map((w) => [w.name, w.done])).toEqual([['Name p0', true], ['Name p1', false], ['Name p2', false], ['Name p3', false]]);
  });
  it('who has voted, once this phone has voted or the prompt is its own', () => {
    let g = L.step(answerAll(L.startRound(room(4), draw, 0)), 0, draw);
    const item = g.items[g.at] as L.Duel;
    const [voter, other] = L.votersFor(g, item);
    const before = screen(g, voter);
    expect(before.k === 'vote' && [before.voters, before.mine]).toEqual([undefined, undefined]);
    g = L.vote(g, voter, 'a');
    const after = screen(g, voter);
    expect(after.k === 'vote' && after.voters!.map((v) => [v.name, v.done])).toEqual([[`Name ${voter}`, true], [`Name ${other}`, false]]);
    const own = screen(g, item.b);
    expect(own.k === 'vote' && [own.mine, own.voters!.length]).toEqual(['b', 2]);
  });
  it('never who wrote which answer before the reveal, even on a watching phone', () => {
    let g = L.step(answerAll(L.startRound(room(5), draw, 0)), 0, draw);
    const item = g.items[g.at] as L.Duel;
    for (const pid of L.votersFor(g, item)) g = L.vote(g, pid, 'b');
    for (const viewer of ids(5)) {
      const json = JSON.stringify(playerView(g, viewer, 0));
      for (const author of [item.a, item.b].filter((a) => a !== viewer)) expect(json).not.toContain(`"Name ${author}"`);
    }
  });
  it('the reveal: each answer with its author, its voters and its points', () => {
    let g = L.step(answerAll(L.startRound(room(5), draw, 0)), 0, draw);
    const item = g.items[g.at] as L.Duel;
    const [x, y, z] = L.votersFor(g, item);
    g = L.vote(L.vote(L.vote(g, x, 'a'), y, 'a'), z, 'b');
    g = L.step(g, 0, draw);
    const s = screen(g, x);
    if (s.k !== 'reveal' || s.show?.kind !== 'duel') throw new Error('no duel reveal');
    expect(s.show.sides.map((d) => [d.by.name, d.votes, d.points, d.backers.map((b) => b.name)])).toEqual([
      [`Name ${item.a}`, 2, 667, [`Name ${x}`, `Name ${y}`]],
      [`Name ${item.b}`, 1, 333, [`Name ${z}`]],
    ]);
  });
  it('the final: every answer once votes are sent, then ranked by votes at the reveal', () => {
    let g = L.startRound({ ...room(4, { ...SETTINGS, rounds: 2 }), round: 1 }, draw, 0);
    g = L.step(answerAll(g), 0, draw);
    const item = g.items[0] as L.Finale;
    const [me, fav] = item.authors;
    expect((screen(g, me) as { answers?: string[] }).answers).toBeUndefined();
    g = L.voteFinal(g, me, { [item.authors.indexOf(fav)]: 3 });
    const sent = screen(g, me);
    expect(sent.k === 'vote3' && [sent.answers, sent.mine, sent.voters!.filter((v) => v.done).length])
      .toEqual([item.authors.map((a) => `answer by ${a}`), 0, 1]);
    g = L.step(g, 0, draw);
    const r = screen(g, me);
    expect(r.k === 'reveal' && r.show?.kind === 'final' && r.show.cards.map((c) => [c.by.name, c.votes])[0]).toEqual([`Name ${fav}`, 3]);
  });
  it('the scores: highest first, shared places, and what this round added', () => {
    let g = L.step(answerAll(L.startRound(room(3), draw, 0)), 0, draw);
    const item = g.items[0] as L.Duel;
    g = L.vote(g, L.votersFor(g, item)[0], 'a');
    while (g.phase !== 'scores') g = L.step(g, 0, draw);
    g = { ...g, players: g.players.map((p) => ({ ...p, score: { p0: 500, p1: 900, p2: 500 }[p.pid]! })) };
    const s = screen(g, 'p2');
    const gain = (pid: string) => (pid === item.a ? 1000 : 0);
    expect(s.k === 'scores' && s.rows!.map((r) => [r.name, r.place, r.score, r.gain])).toEqual([
      ['Name p1', 1, 900, gain('p1')], ['Name p0', 2, 500, gain('p0')], ['Name p2', 2, 500, gain('p2')],
    ]);
  });
});

describe('codes and brokers', () => {
  it('makes 4-letter codes from unambiguous letters and cleans typed ones', () => {
    for (let i = 0; i < 100; i++) expect(isCode(newCode())).toBe(true);
    expect(CODE_LETTERS).not.toMatch(/[AEIOUL0-9]/);
    expect(cleanCode(' bc-df x')).toBe('BCDF');
  });
  it('reads broker addresses', () => {
    expect(parseBroker('localhost:9000')).toEqual({ host: 'localhost', port: 9000, path: '/', secure: false });
    expect(parseBroker('wss://peer.example.com:443/myapp')).toEqual({ host: 'peer.example.com', port: 443, path: '/myapp', secure: true });
    expect(parseBroker('peer.example.com:443')!.secure).toBe(true);
    expect(parseBroker('nonsense')).toBeNull();
  });
});

describe('messages from phones', () => {
  it('drops anything malformed', () => {
    expect(readToHost({ t: 'hello', pid: 'p1', name: 'Maya' })).toEqual({ t: 'hello', pid: 'p1', name: 'Maya' });
    expect(readToHost({ t: 'vote', r: 1, at: 2, c: 'a' })).toEqual({ t: 'vote', r: 1, at: 2, c: 'a' });
    expect(readToHost({ t: 'vote', r: 1, at: 2, c: 'z' })).toBeNull();
    expect(readToHost({ t: 'answer', r: 1, i: '1', text: 'x' })).toBeNull();
    expect(readToHost({ t: 'votes', r: 3, at: 0, v: { 0: 2, 1: 'x' } })).toEqual({ t: 'votes', r: 3, at: 0, v: { 0: 2 } });
    expect(readToHost('hello')).toBeNull();
  });
  it('drops answers and votes that do not say which round and prompt they are for', () => {
    expect(readToHost({ t: 'vote', c: 'a' })).toBeNull();
    expect(readToHost({ t: 'vote', r: 1, c: 'a' })).toBeNull();
    expect(readToHost({ t: 'answer', i: 1, text: 'x' })).toBeNull();
    expect(readToHost({ t: 'votes', r: 3, v: { 0: 2 } })).toBeNull();
  });
  it('a vote queued for an earlier prompt is ignored when it arrives during a later one', () => {
    let g = L.step(answerAll(L.startRound(room(5), draw, 0)), 0, draw);
    while (g.at < 2) g = L.step(L.step(g, 0, draw), 0, draw); // close the vote, then the reveal
    const late = L.step(L.step(g, 0, draw), 0, draw);
    expect([late.phase, late.at]).toEqual(['vote', 3]);
    // A voter on prompt 3 whose phone queued a vote while prompt 2 was up: it must not land on 3.
    const voter = L.votersFor(late, late.items[3])[0];
    expect(L.fromPhone(late, voter, { t: 'vote', r: 1, at: 2, c: 'a' })).toBe(late);
    expect(L.fromPhone(late, voter, { t: 'votes', r: 1, at: 2, v: { 0: 1 } })).toBe(late);
    const now = L.fromPhone(late, voter, { t: 'vote', r: 1, at: 3, c: 'a' });
    expect((now.items[3] as L.Duel).ballots[voter]).toBe((late.items[3] as L.Duel).a);
  });
  it('an answer from the previous round is ignored', () => {
    let g = answerAll(L.startRound(room(3), draw, 0));
    while (g.phase !== 'scores') g = L.step(g, 0, draw);
    g = L.step(g, 0, draw);
    expect([g.round, g.phase]).toEqual([2, 'write']);
    const [i] = L.tasksFor(g, 'p0');
    expect(L.fromPhone(g, 'p0', { t: 'answer', r: 1, i, text: 'old' })).toBe(g);
    expect(L.fromPhone(g, 'p0', { t: 'answer', r: 2, i, text: 'new' }).items[i].answers.p0).toBe('new');
  });
});

// --- Quiplash 3 options: "Give me one" stock answers and three-line duels in the final ---

const STOCK = 'A stock answer';
/** Every prompt comes with a stock answer; finals come with the house's three lines. */
const drawAll: L.Draw = (n, kind) => kind === 'lines'
  ? Array.from({ length: n }, (_, i) => ({ prompt: `Three things ${i}`, house: ['House one', 'House two', 'House three'] }))
  : prompts(n).map((prompt) => ({ prompt, safety: STOCK }));
const DUELS: L.Settings = { ...SETTINGS, final: 'duels' };

/** n players about to start the final with three-line duels; p(n-1) is in last place. */
function toFinal(n: number, settings = DUELS): L.Game {
  const g = room(n, settings);
  return { ...g, round: settings.rounds - 1, players: g.players.map((p, i) => ({ ...p, score: (n - i) * 100 })) };
}

function writeLines(g: L.Game): L.Game {
  g.items.forEach((item, i) => {
    for (const pid of L.authorsOf(item)) if (pid !== L.HOUSE) g = L.answerLines(g, pid, i, [`${pid} one`, `${pid} two`, '']);
  });
  return g;
}

describe('stock answers ("Give me one")', () => {
  function firstDuel(text: (item: L.Duel) => string) {
    let g = L.startRound(room(4), drawAll, 0);
    const item = g.items[0] as L.Duel;
    g = L.answer(g, item.a, 0, text(item));
    g = L.step(answerAll(g), 0, drawAll);
    for (const pid of L.votersFor(g, g.items[0])) g = L.vote(g, pid, 'a');
    return { g: L.step(g, 0, drawAll), item };
  }
  it('are sent to the writing phone with their prompt', () => {
    const g = L.startRound(room(4), drawAll, 0);
    const s = playerView(g, 'p0', 0)!.screen;
    expect(s.k === 'write' && s.tasks.every((t) => t.safety === STOCK)).toBe(true);
  });
  it('sent untouched, every point it earns is halved (rounded down), sweep bonus included', () => {
    const { g, item } = firstDuel(() => `  ${STOCK} `);
    expect(g.items[0].result!.points[item.a]).toBe(Math.floor((1000 + 250) / 2));
    expect(L.player(g, item.a)!.score).toBe(625);
    const s = playerView(g, 'p0', 0)!.screen;
    expect(s.k === 'reveal' && s.show?.kind === 'duel' && s.show.sides.map((x) => !!x.safety)).toEqual([true, false]);
  });
  it('edited, it is a normal answer with full points', () => {
    const { g, item } = firstDuel(() => `${STOCK}!`);
    expect(L.player(g, item.a)!.score).toBe(1250);
  });
  it('the host decides; a phone cannot flag its own answer', () => {
    expect(readToHost({ t: 'answer', r: 1, i: 0, text: 'x', safety: true })).toEqual({ t: 'answer', r: 1, i: 0, text: 'x' });
  });
});

describe('three-line duels: pairing', () => {
  const score = (pid: string) => Number(pid.slice(1));
  it('pairs everyone once with an even count', () => {
    const { pairs, alone } = pairDuels(ids(6), score);
    expect(alone).toBeUndefined();
    expect(pairs.flat().sort()).toEqual(ids(6));
  });
  it('with an odd count, last place faces the house; ties are broken at random', () => {
    const odd = pairDuels(ids(5), (pid) => 10 - score(pid));
    expect(odd.alone).toBe('p4');
    expect(odd.pairs.flat().sort()).toEqual(ids(4));
    const picked = new Set(Array.from({ length: 60 }, () => pairDuels(ids(3), (pid) => (pid === 'p0' ? 5 : 0)).alone));
    expect(picked).toEqual(new Set(['p1', 'p2']));
  });
  it('a final round deals one prompt per pair, the house getting its lines with its prompt', () => {
    const g = L.startRound(toFinal(5), drawAll, 0);
    expect(g.items.map((it) => it.kind)).toEqual(['lines', 'lines', 'lines']);
    expect(new Set(g.items.map((it) => it.prompt)).size).toBe(3);
    const house = g.items.find((it) => L.authorsOf(it).includes(L.HOUSE)) as L.Lines;
    expect(L.authorsOf(house)).toContain('p4');
    expect(house.answers[L.HOUSE]).toEqual(['House one', 'House two', 'House three']);
    expect(L.tasksFor(g, 'p4')).toEqual([g.items.indexOf(house)]);
  });
  it('falls back to the 3-vote final when no pack has finals', () => {
    const g = L.startRound(toFinal(4), draw, 0);
    expect(g.items.map((it) => it.kind)).toEqual(['final']);
  });
  it('the default setting (and settings saved before it existed) keep the old final', () => {
    expect(L.startRound(toFinal(5, { ...DUELS, final: 'everyone' }), drawAll, 0).items.map((it) => it.kind)).toEqual(['final']);
    expect(L.startRound(toFinal(5, SETTINGS), drawAll, 0).items.map((it) => it.kind)).toEqual(['final']);
    const stored = new Map([['hr:snark:settings', JSON.stringify({ rounds: 2, answerSecs: 45, voteSecs: 10, packIds: ['classic'] })]]);
    vi.stubGlobal('localStorage', { getItem: (k: string) => stored.get(k) ?? null, setItem: () => {}, removeItem: () => {} });
    expect(loadSettings()).toEqual({ rounds: 2, answerSecs: 45, voteSecs: 10, packIds: ['classic'], final: 'everyone' });
    vi.unstubAllGlobals();
  });
  it('a phone can never join as the house', () => {
    expect(L.join(room(3), L.HOUSE, 'House', new Set()).error).toBeTruthy();
  });
});

describe('three-line duels: writing, showing, voting', () => {
  it('takes 1–3 lines of up to 40 characters, blanks dropped; needs at least one', () => {
    const g = L.startRound(toFinal(4), drawAll, 0);
    const i = L.tasksFor(g, 'p0')[0];
    expect(L.answerLines(g, 'p0', i, ['', '  '])).toBe(g);
    expect(L.answer(g, 'p0', i, 'plain answer')).toBe(g);
    const next = L.fromPhone(g, 'p0', { t: 'lines', r: g.round, i, lines: ['', 'x'.repeat(50), ' b '] });
    expect(next.items[i].answers.p0).toEqual(['x'.repeat(40), 'b']);
    const s = playerView(g, 'p0', 0)!.screen;
    expect(s.k === 'write' && [s.lines, s.tasks.length]).toEqual([true, 1]);
  });
  it('shows each duel line by line, then everyone but the duellers votes for twice the vote time', () => {
    let g = writeLines(L.startRound(toFinal(5), drawAll, 0));
    g = L.join(g, 'late', 'Late', new Set()).game;
    g = L.step(g, 1000, drawAll);
    const item = g.items[0] as L.Lines;
    expect([g.phase, g.deadline]).toEqual(['show', 1000 + L.showLength(item)]);
    const watching = playerView(g, 'late', 1000)!.screen;
    expect(watching.k === 'show' && watching.sides.map((x) => x.lines)).toEqual([item.a, item.b].map((pid) => item.answers[pid]));
    // Authors stay hidden from every phone until the reveal.
    for (const viewer of ['p0', 'late']) {
      const json = JSON.stringify(playerView(g, viewer, 1000));
      for (const pid of L.authorsOf(item).filter((a) => a !== viewer)) expect(json).not.toContain(`"Name ${pid}"`);
      expect(json).not.toContain(L.HOUSE);
    }
    expect(L.vote(g, L.votersFor(g, item)[0], 'a')).toBe(g);
    g = L.tick(g, 1000 + L.showLength(item), new Set(), drawAll);
    expect([g.phase, g.deadline]).toEqual(['vote', 1000 + L.showLength(item) + 30000]);
    expect(L.votersFor(g, item)).toEqual(['p0', 'p1', 'p2', 'p3', 'p4', 'late'].filter((p) => !L.authorsOf(item).includes(p)));
    expect(L.vote(g, item.a, 'b')).toBe(g);
    const v = playerView(g, 'late', 0)!.screen;
    expect(v.k === 'vote' && v.choices.every((c) => c.lines?.length === 2 || c.lines?.length === 3)).toBe(true);
  });
  it('lines appear side A first, then side B, 1.5 s apart', () => {
    expect([0, 1499, 1500, 4500, 6000, 99999].map((t) => L.linesShown([3, 2], t))).toEqual([[0, 0], [0, 0], [1, 0], [3, 0], [3, 1], [3, 2]]);
  });
  it('pausing during the showing holds it; skipping opens the vote', () => {
    let g = L.step(writeLines(L.startRound(toFinal(4), drawAll, 0)), 0, drawAll);
    g = L.pause(g, 2000);
    expect(L.tick(g, 999999, new Set(), drawAll)).toBe(g);
    expect(L.step(g, 3000, drawAll).phase).toBe('vote');
    expect(validGame(JSON.parse(JSON.stringify(g)))).not.toBeNull();
  });
});

describe('three-line duels: scoring', () => {
  it('vote share × 3000, plus 750 for a clean sweep of 2+ votes', () => {
    expect(scoreLines('a', 'b', { x: 'a', y: 'a', z: 'b' }).points).toEqual({ a: 2000, b: 1000 });
    const sweep = scoreLines('a', 'b', { x: 'b', y: 'b' });
    expect([sweep.points, sweep.sweep]).toEqual([{ a: 0, b: 3750 }, 'b']);
    expect(scoreLines('a', 'b', { x: 'a' }).points).toEqual({ a: 3000, b: 0 });
  });
  it('votes for the house score nothing, for anyone', () => {
    expect(scoreLines('p', '~house', { x: 'p', y: '~house' }, '~house').points).toEqual({ p: 1500, '~house': 0 });
    const won = scoreLines('~house', 'p', { x: '~house', y: '~house' }, '~house');
    expect([won.points, won.sweep]).toEqual([{ '~house': 0, p: 0 }, undefined]);
  });
  it('a whole final of duels: every duel scored, logged once each, then the winner', () => {
    let g = L.step(writeLines(L.startRound(toFinal(5), drawAll, 0)), 0, drawAll);
    const before = new Map(g.players.map((p) => [p.pid, p.score]));
    let duels = 0;
    while (g.phase !== 'over') {
      if (g.phase === 'vote') for (const pid of L.votersFor(g, g.items[g.at])) g = L.vote(g, pid, 'a');
      if (g.phase === 'reveal') duels++;
      g = L.step(g, 0, drawAll);
    }
    expect(duels).toBe(3);
    expect(g.log).toHaveLength(3);
    const gained = g.items.flatMap((it) => (it.kind === 'lines' ? [it.a] : [])).filter((pid) => pid !== L.HOUSE);
    for (const pid of gained) expect(L.player(g, pid)!.score).toBe(before.get(pid)! + 3750);
    expect(g.players.reduce((n, p) => n + p.score, 0)).toBe([...before.values()].reduce((a, b) => a + b, 0) + 3750 * gained.length);
  });
});

describe('messages from phones: three-line duels', () => {
  it('reads lines and drops anything malformed', () => {
    expect(readToHost({ t: 'lines', r: 3, i: 1, lines: ['a', '', 'c'] })).toEqual({ t: 'lines', r: 3, i: 1, lines: ['a', '', 'c'] });
    expect(readToHost({ t: 'lines', r: 3, i: 1, lines: 'a' })).toBeNull();
    expect(readToHost({ t: 'lines', r: 3, i: 1, lines: [] })).toBeNull();
    expect(readToHost({ t: 'lines', r: 3, i: 1, lines: ['a', 'b', 'c', 'd'] })).toBeNull();
    expect(readToHost({ t: 'lines', r: 3, i: 1, lines: ['a', 7] })).toBeNull();
    expect(readToHost({ t: 'lines', i: 1, lines: ['a'] })).toBeNull();
  });
});
