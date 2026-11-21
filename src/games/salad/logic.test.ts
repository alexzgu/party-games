import { describe, expect, it } from 'vitest';
import classic from '../../content/salad/classic.json';
import * as L from './logic';
import { asPhrase } from './deal';
import { matches, normalise } from './match';
import { readToHost, type Action } from './protocol';
import { playerView } from './view';
import type { Secret } from './words';

const pool = classic.secrets as Secret[];
const both = new Set(['a', 'b']);

function lobby(names = ['a', 'b']) {
  return names.reduce((g, pid) => L.join(g, pid, pid.toUpperCase(), new Set()).game,
    L.newGame('BCDF', ['classic'], pool, 25));
}

const send = (g: L.Game, pid: string, msg: Action, now = g.deadline! - L.timerLength(g)) =>
  L.fromPhone(g, pid, { ...msg, serial: g.serial }, now);

function fill(g: L.Game, pid: string, select?: (choices: string[], slot: number) => string): L.Game {
  const draft = playerView(g, pid, 0).draft!;
  draft.choices.forEach((choices, slot) => {
    g = send(g, pid, { t: 'word', frame: draft.index, slot, value: select?.(choices, slot) ?? choices[0] });
  });
  return send(g, pid, { t: 'publish', frame: draft.index });
}

function openingTurn(g = L.startRound(lobby(), 0), index = 0, online = both) {
  g = send(g, 'a', { t: 'pick', index, reshuffled: false });
  g = L.tick(g, g.deadline!, online);
  return L.tick(g, g.deadline!, online);
}

describe('Word Salad rounds', () => {
  it('offers one easy card and three categories, with one private refresh', () => {
    const g = L.startRound(lobby(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']), 0);
    for (const pid of g.order) {
      const offers = playerView(g, pid, 0).offers;
      expect(offers).toHaveLength(3);
      expect(offers.filter((s) => s.level === 'easy')).toHaveLength(1);
      expect(new Set(offers.map((s) => s.category)).size).toBe(3);
    }
    expect(playerView(g, '', 0).offers).toEqual([]);
    const refreshed = send(g, 'a', { t: 'reshuffle' });
    expect(refreshed.turns[0].offers).not.toEqual(g.turns[0].offers);
    expect(send(refreshed, 'a', { t: 'reshuffle' })).toBe(refreshed);
    expect(refreshed.turns[1]).toBe(g.turns[1]);
    expect(send(refreshed, 'a', { t: 'pick', index: 0, reshuffled: false })).toBe(refreshed);
  });

  it('selects and prepares simultaneously, then publishes openings in seat order', () => {
    const picked = L.startRound(lobby(), 500);
    expect(picked.deadline).toBe(20_500);
    let prep = L.tick(picked, 20_500, both);
    expect(prep.deadline).toBe(50_500);
    expect(prep.turns[0].secret).toBe(picked.turns[0].offers[0]);
    const first = prep.turns[0].draft!.choices;
    expect(first.every((words) => words.length === 6)).toBe(true);
    const secondBefore = prep.turns[1].draft!.choices.map((words) => words[0]);
    const redealt = send(prep, 'a', { t: 'more', slot: 0, frame: 0 });
    const next = redealt.turns[0].draft!.choices;
    expect(next[0]).toHaveLength(6);
    expect(next[0]).not.toEqual(first[0]);
    expect(next[1]).toEqual(first[1]);
    expect(send(redealt, 'a', { t: 'word', slot: 0, frame: 0, value: 'made up' })).toBe(redealt);
    prep = fill(redealt, 'a');
    expect(L.tick(prep, 20_500, both)).toBe(prep);
    expect(playerView(prep, 'b', 20_500).sentences).toEqual([]);
    let g = L.tick(prep, 50_500, both);
    expect(g.phase).toBe('present');
    expect(g.deadline).toBe(125_500);
    expect(g.sentences).toEqual([prep.turns[0].first]);
    expect(playerView(g, 'b', 50_500).secret).toBeNull();
    expect(playerView(g, 'b', 50_500).draft).toBeNull();
    g = L.tick(g, 125_500, both);
    expect(g.result?.reason).toBe('timeout');
    g = L.step(g, 126_500, both);
    expect(playerView(g, 'a', 126_500).presenter).toBe('b');
    for (const word of secondBefore) expect(g.sentences[0]).toContain(word);
  });

  it('starts early once both players finish picking and composing', () => {
    let g = L.startRound(lobby(), 0);
    for (const pid of both) g = send(g, pid, { t: 'pick', index: 1, reshuffled: false });
    g = L.tick(g, 1, both);
    expect(g.phase).toBe('prepare');
    for (const pid of both) g = fill(g, pid);
    expect(L.tick(g, 2, both).phase).toBe('present');
  });

  it('scores the first right guess and used guesses once, with easy and round multipliers', () => {
    let g = openingTurn();
    const answer = L.currentTurn(g).secret!.answer;
    expect(send(g, 'a', { t: 'guess', text: answer, id: 'self' })).toBe(g);
    const guess = { t: 'guess', id: 'wrong', text: 'a jar of fuzzy buttons' } as const;
    g = send(g, 'b', guess);
    expect(send(g, 'b', guess)).toBe(g);
    for (let i = 0; i < 2; i++) {
      while (!L.currentTurn(g).draft!.frame.slots.includes('guess')) g = send(g, 'a', { t: 'skipFrame', frame: L.currentTurn(g).draft!.index });
      g = fill(g, 'a');
    }
    expect(g.sentences.filter((line) => line.includes(guess.text))).toHaveLength(2);
    const solved = send(g, 'b', { t: 'guess', text: answer, id: 'right' }, g.deadline! - 37_500);
    expect(solved.result?.points).toEqual({ a: 300, b: 400 });
    expect(solved.result?.assistPoints).toEqual({ b: 100 });
    expect(solved.solved).toBe(1);
    expect(solved.total).toBe(1);
    expect(send(solved, 'b', { t: 'guess', text: answer, id: 'again' })).toBe(solved);
    const harder = openingTurn({ ...L.startRound(lobby(), 0), round: 2 }, 1);
    expect(send(harder, 'b', { t: 'guess', text: L.currentTurn(harder).secret!.answer, id: 'win' })
      .result?.points).toEqual({ a: 2000, b: 2000 });
  });

  it('lets late joiners guess immediately and seats them in the second round', () => {
    let g = openingTurn();
    g = L.join(g, 'c', 'C', both).game;
    expect(g.order).toEqual(['a', 'b']);
    g = send(g, 'c', { t: 'guess', id: 'late', text: L.currentTurn(g).secret!.answer });
    expect(g.result?.winner).toBe('c');
    const all = new Set(['a', 'b', 'c']);
    for (let i = 0; i < 4; i++) g = L.step(g, 60_000 + i, all);
    expect(g.phase).toBe('pick');
    expect(g.round).toBe(2);
    expect(g.order).toEqual(['a', 'b', 'c']);
    for (let i = 0; i < 9; i++) g = L.step(g, 70_000 + i, all);
    expect(g.phase).toBe('over');
    expect(g.total).toBe(5);
    expect(L.rematch(g).players.every((p) => p.score === 0)).toBe(true);
  });

  it('skips missing presenters and holds a disconnected presenter’s turn, clock stopped, for a minute', () => {
    const solo = new Set(['b']);
    expect(openingTurn(undefined, 0, solo).result?.reason).toBe('offline');
    const onStage = openingTurn();
    const start = onStage.deadline! - L.PRESENT_MS;
    const away = start + 5_000;
    let g = L.tick(onStage, away, solo);
    expect(g.offlineSince).toBe(away);
    expect(L.timeLeft(g, away + 40_000)).toBe(L.PRESENT_MS - 5_000);
    expect(playerView(g, 'b', away + 40_000)).toMatchObject({ held: true, paused: true, hostPaused: false });
    expect(send(g, 'b', { t: 'guess', id: 'held', text: L.currentTurn(g).secret!.answer }, away + 1_000)).toBe(g);
    expect(L.tick(g, away + L.AWAY_MS - 1, solo)).toBe(g);
    const back = L.tick(g, away + 40_000, both);
    expect(back.offlineSince).toBeNull();
    expect(back.deadline).toBe(onStage.deadline! + 40_000);
    expect(L.timeLeft(back, away + 40_000)).toBe(L.PRESENT_MS - 5_000);
    g = L.tick(g, away + L.AWAY_MS, solo);
    expect(g.result).toMatchObject({ answer: L.currentTurn(onStage).secret!.answer, reason: 'offline', points: {} });
  });

  it('lets a player who left come back, but not one the host removed', () => {
    const g = openingTurn();
    const gone = L.leave(g, 'b');
    expect(L.present(gone).map((p) => p.pid)).toEqual(['a']);
    const rejoined = L.join(gone, 'b', 'B', new Set(['a']));
    expect(rejoined.pid).toBe('b');
    expect(L.present(rejoined.game).map((p) => p.pid)).toEqual(['a', 'b']);
    expect(L.join(L.kick(gone, 'b'), 'b', 'B', new Set()).error).toBeTruthy();
    const presenterLeft = L.tick(L.leave(g, 'a'), g.deadline! - L.PRESENT_MS + 1_000, both);
    expect(presenterLeft.result?.reason).toBe('offline');
  });

  it('holds the timer and rejects stale, paused and late messages', () => {
    const g = openingTurn();
    const answer = L.currentTurn(g).secret!.answer;
    const msg = { t: 'guess', id: 'answer', text: answer, serial: g.serial } as const;
    expect(L.fromPhone(g, 'b', msg, g.deadline!)).toBe(g);
    expect(L.fromPhone(g, 'b', { ...msg, serial: g.serial - 1 }, 60_000)).toBe(g);
    const paused = L.pause(g, 60_000);
    expect(L.fromPhone(paused, 'b', msg, 70_000)).toBe(paused);
    expect(L.tick(paused, 200_000, both)).toBe(paused);
    expect(L.resume(paused, 70_000).deadline).toBe(g.deadline! + 10_000);
    expect(L.afterReload(g, 200_000).deadline).toBe(212_000);
    expect(L.join(L.kick(g, 'b'), 'b', 'B', both).error).toBeTruthy();
    expect(L.join(g, 'new', 'B', new Set()).pid).toBe('b');
  });
});

describe('guess matching and phone messages', () => {
  it('normalises punctuation and articles, accepts aliases and forgives limited typos', () => {
    const secret = { ...pool[0], answer: 'The Golden Compass', also: ['Northern Lights'] };
    expect(normalise(' THE   GoLden, Compass! ')).toBe('goldencompass');
    expect(matches('an northernlights', secret)).toBe(true);
    expect(matches('Goldeb Compsss', secret)).toBe(true);
    expect(matches('Golden Campfire', secret)).toBe(false);
    expect(matches('pizaz', { ...secret, answer: 'Pizza', also: [] })).toBe(true);
    expect(matches('pixa', { ...secret, answer: 'Pizza', also: [] })).toBe(false);
  });

  it('reads a guess into a clue without its closing punctuation or a capital article', () => {
    expect(asPhrase(' A talking toaster. ')).toBe('a talking toaster');
    expect(asPhrase('The Matrix?!')).toBe('the Matrix');
    expect(asPhrase('Antman')).toBe('Antman');
  });

  it('rejects malformed, oversized and unknown actions', () => {
    expect(readToHost({ t: 'word', serial: 1, frame: 0, slot: -1, value: 'small' })).toBeNull();
    expect(readToHost({ t: 'guess', serial: 1, id: 'a', text: 'x'.repeat(81) })).toBeNull();
    expect(readToHost({ t: 'guess', serial: 1, id: 'a', text: 'spoon' })).toMatchObject({ t: 'guess' });
    expect(readToHost({ t: 'other', serial: 1 })).toBeNull();
  });
});
