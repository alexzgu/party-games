import { describe, expect, it } from 'vitest';
import * as L from './logic';
import { draw, nextPrompt } from './deck';
import { filled, picks } from './cards';

const rand = () => 0.42;
const answers = Array.from({ length: 60 }, (_, i) => `Answer ${i}`);
const ONE = 'Nothing beats ___.';
const TWO = 'First ___, then ___.';
const ASK = 'What keeps me up at night?';
const settings = (patch: Partial<L.Settings> = {}): L.Settings => ({ ...L.DEFAULT_SETTINGS, ...patch });

function room(n = 3, patch: Partial<L.Settings> = {}, prompts = [ONE, ONE + ' Really.', ASK]) {
  let g = L.newGame('g', 'BCDF', settings(patch));
  for (let i = 0; i < n; i++) g = (L.join(g, `p${i}`, `P${i}`, new Set()) as { game: L.Game }).game;
  return L.start(g, { prompts, answers }, 0, rand);
}
const all = (g: L.Game) => new Set(g.players.map((p) => p.pid));
const r = (g: L.Game) => g.round!;
const answerers = (g: L.Game) => r(g).players;
/** Every answerer plays their first card(s). */
function playAll(g: L.Game, except: string[] = []) {
  for (const pid of answerers(g)) if (!except.includes(pid)) g = L.play(g, pid, g.at, g.hands[pid].slice(0, picks(r(g).prompt)), ['', '']);
  return g;
}
const held = (g: L.Game) => Object.values(g.hands).flat();

describe('Bad Hand deck', () => {
  it('deals ten to everyone, never a card twice, and reshuffles the discard pile when the deck runs out', () => {
    const g = room(4);
    expect(Object.values(g.hands).map((h) => h.length)).toEqual([10, 10, 10, 10]);
    expect(new Set([...held(g), ...g.deck]).size).toBe(60);
    const { pile, cards } = draw({ deck: [1], discard: [2, 3] }, 3, rand);
    expect(cards.sort()).toEqual([1, 2, 3]);
    expect(pile).toEqual({ deck: [], discard: [] });
  });

  it('deals prompts without repeats until they run out', () => {
    let q: string[] = [];
    const seen: string[] = [];
    for (let i = 0; i < 3; i++) ({ prompt: seen[i], queue: q } = nextPrompt(q, ['a', 'b', 'c'], Math.random));
    expect(seen.sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('Bad Hand round', () => {
  it('rotates the judge in seat order, skipping departed players', () => {
    const g = room(4);
    const seats = g.players.map((p) => p.pid);
    const j = seats.indexOf(r(g).judge);
    expect(L.nextJudge(g, r(g).judge)).toBe(seats[(j + 1) % 4]);
    const gone = L.leave(g, seats[(j + 1) % 4]);
    expect(L.nextJudge(gone, r(g).judge)).toBe(seats[(j + 2) % 4]);
    expect(answerers(g)).not.toContain(r(g).judge);
  });

  it('plays two cards in order on a two-blank prompt and only the right number of held cards', () => {
    const g = room(3, {}, [TWO]);
    const pid = answerers(g)[0];
    const [a, b] = g.hands[pid];
    expect(L.play(g, pid, g.at, [a], [''])).toBe(g);
    expect(L.play(g, pid, g.at, [a, g.hands[answerers(g)[1]][0]], ['', ''])).toBe(g);
    const next = L.play(g, pid, g.at, [b, a], ['', '']);
    expect(r(next).plays[pid].texts).toEqual([g.cards[b], g.cards[a]]);
    expect(next.hands[pid]).toHaveLength(8);
    expect(filled(TWO, r(next).plays[pid].texts)).toBe(`First ${g.cards[b]}, then ${g.cards[a]}.`);
    expect(filled(ASK, ['Bees'])).toBe('What keeps me up at night? Bees');
  });

  it('ends answering when every present player has played, at the timer, or never by itself with no limit', () => {
    const g = room(4);
    const [a, b, c] = answerers(g);
    const online = new Set([a, b, r(g).judge]);
    expect(L.tick(playAll(g, [a, b, c]), 1, online).phase).toBe('answer');
    expect(L.tick(playAll(g, [c]), 1, online).phase).toBe('judge');
    expect(L.tick(g, 59_999, online).phase).toBe('answer');
    expect(L.tick(playAll(g, [c]), 1, new Set()).phase).toBe('answer');
    expect(L.tick(playAll(g, [c]), 60_001, online).phase).toBe('judge');
    const none = room(4, { seconds: 0 });
    expect([none.deadline, L.tick(none, 1e9, online).phase]).toEqual([null, 'answer']);
  });

  it('judges: anonymous shuffled answers, a spotlight, one point to the pick, hands back to ten, the next seat judges', () => {
    let g = room(4);
    const judge = r(g).judge;
    g = L.tick(playAll(g), 1, all(g));
    expect(g.phase).toBe('judge');
    expect(r(g).order.sort()).toEqual([...answerers(g)].sort());
    g = L.spot(g, judge, g.at, 2);
    expect(r(g).spotlight).toBe(2);
    expect(L.pick(g, answerers(g)[0], g.at, 1, 2)).toBe(g);
    const winner = r(g).order[1];
    g = L.pick(g, judge, g.at, 1, 2);
    expect(g.phase).toBe('reveal');
    expect(g.players.find((p) => p.pid === winner)!.score).toBe(1);
    g = L.tick(g, 2 + L.REVEAL_MS, all(g));
    expect(g.phase).toBe('answer');
    expect(Object.values(g.hands).every((h) => h.length === 10)).toBe(true);
    expect(r(g).judge).toBe(L.nextJudge(g, judge));
    expect(g.discard).toHaveLength(3);
    expect(new Set([...held(g), ...g.deck, ...g.discard]).size).toBe(60);
  });

  it('a missing judge hands judging to a vote: one vote, never your own, ties at random', () => {
    let g = playAll(room(4));
    const judge = r(g).judge;
    const others = answerers(g);
    g = L.tick(g, 1, new Set(others));
    expect(g.phase).toBe('vote');
    const [a, b, c] = r(g).order;
    expect(L.vote(g, a, g.at, 0)).toBe(g);
    g = L.vote(g, a, g.at, 1);
    expect(L.vote(g, a, g.at, 2)).toBe(g);
    g = L.vote(g, b, g.at, 0);
    expect(L.counted(r(g), () => 0)).toBe(0);
    expect(L.counted(r(g), () => 0.99)).toBe(1);
    g = L.tick(L.vote(g, c, g.at, 1), 2, new Set(others));
    expect(g.phase).toBe('reveal');
    expect(r(g).winner).toBe(1);
    // Online at the start of judging, then gone for 20 s.
    let h = playAll(room(4));
    h = L.tick(h, 1, all(h));
    expect(h.phase).toBe('judge');
    h = L.tick(h, 10, new Set(answerers(h)));
    expect(L.tick(h, 10 + L.JUDGE_AWAY_MS - 1, new Set(answerers(h))).phase).toBe('judge');
    expect(L.tick(h, 10 + L.JUDGE_AWAY_MS, new Set(answerers(h))).phase).toBe('vote');
    expect(others).not.toContain(judge);
  });

  it('sets aside a prompt with no answers and gives a lone answer the point', () => {
    const g = room(3);
    const judge = r(g).judge;
    const empty = L.step(g, 1, all(g));
    expect([empty.phase, r(empty).n, r(empty).judge]).toEqual(['answer', 2, L.nextJudge(g, judge)]);
    const lone = L.step(playAll(g, [answerers(g)[1]]), 1, all(g));
    expect(lone.phase).toBe('reveal');
    expect(lone.players.find((p) => p.pid === answerers(g)[0])!.score).toBe(1);
  });

  it('ends at the target, and the house reaching it means everyone loses', () => {
    let g = room(3, { target: 5 });
    g = { ...g, players: g.players.map((p, i) => ({ ...p, score: i === 0 ? 4 : 0 })) };
    expect(r(g).judge).not.toBe('p0');
    g = L.step(L.play(g, 'p0', g.at, [g.hands.p0[0]], ['']), 1, all(g));
    expect(g.players[0].score).toBe(5);
    expect(L.step(g, 2, all(g)).phase).toBe('over');
    let h = room(3, { house: true, target: 1 });
    h = L.step(playAll(h), 1, all(h));
    expect(r(h).order).toContain(L.HOUSE);
    h = L.pick(h, r(h).judge, h.at, r(h).order.indexOf(L.HOUSE), 2);
    expect([h.house, L.finished(h)]).toEqual([1, true]);
  });

  it('deals late joiners in for the next prompt and takes back the hand of a player who leaves', () => {
    let g = room(3);
    g = (L.join(g, 'late', 'Late', all(g)) as { game: L.Game }).game;
    expect(g.hands.late).toHaveLength(10);
    expect(answerers(g)).not.toContain('late');
    const deck = g.deck.length;
    const pid = answerers(g)[0];
    g = L.leave(L.play(g, pid, g.at, [g.hands[pid][0]], ['']), pid);
    expect(g.hands[pid]).toBeUndefined();
    expect(g.deck).toHaveLength(deck + 10);
    expect(answerers(g)).not.toContain(pid);
    const back = (L.join(g, pid, 'whatever', new Set()) as { game: L.Game }).game;
    expect(back.hands[pid]).toHaveLength(10);
    expect(L.kick(g, 'late').hands.late).toBeUndefined();
  });

  it('trades a point for fresh cards once, outside judging, when the option is on', () => {
    let g = room(3, { trade: true });
    const pid = answerers(g)[0];
    expect(L.trade(g, pid, 0, [g.hands[pid][0]], rand)).toBe(g);
    g = { ...g, players: g.players.map((p) => p.pid === pid ? { ...p, score: 1 } : p) };
    const old = g.hands[pid].slice(0, 3);
    const t = L.trade(g, pid, 0, old, rand);
    expect(t.players.find((p) => p.pid === pid)!.score).toBe(0);
    expect(t.hands[pid]).toHaveLength(10);
    expect(t.hands[pid].some((c) => old.includes(c))).toBe(false);
    expect(L.trade(t, pid, 0, [t.hands[pid][0]], rand)).toBe(t);
    expect(L.trade({ ...g, settings: settings() }, pid, 0, old, rand).hands[pid]).toEqual(g.hands[pid]);
  });

  it('adds about one blank card in twenty and plays it with typed text up to 60 characters', () => {
    let g = room(3, { blanks: true });
    const blanks = g.cards.flatMap((t, i) => t === '' ? [i] : []);
    expect(blanks.length).toBe(Math.round(60 / 19));
    const pid = answerers(g)[0];
    g = { ...g, hands: { ...g.hands, [pid]: [blanks[0], ...g.hands[pid].slice(1)] }, deck: g.deck.filter((c) => c !== blanks[0]) };
    expect(L.play(g, pid, g.at, [blanks[0]], ['  '])).toBe(g);
    expect(L.play(g, pid, g.at, [blanks[0]], ['x'.repeat(61)])).toBe(g);
    expect(r(L.play(g, pid, g.at, [blanks[0]], [' My own '])).plays[pid].texts).toEqual(['My own']);
  });
});

describe('Bad Hand after a host reload, pauses and the target', () => {
  it('gives phones time to reconnect before anyone counts as gone', () => {
    let g = room(4);
    const [a, b, c] = answerers(g);
    g = L.afterReload(L.play(g, a, g.at, [g.hands[a][0]], ['']), 1000);
    const first = new Set([a]);
    expect(L.tick(g, 2000, first).phase).toBe('answer');
    expect(L.tick(g, 1000 + L.RECONNECT_MS, first).phase).toBe('reveal'); // then answering ends; the lone answer wins
    // Judging starts (host skip) while the judge's phone is still on its way: no vote yet.
    const judging = L.step(playAll(g, [a]), 2000, new Set([a, b, c]));
    expect(judging.phase).toBe('judge');
    expect(L.tick(judging, 3000, new Set([a, b, c])).round!.away).toBeNull();
  });

  it('freezes the missing judge\'s 20 s while paused', () => {
    let g = playAll(room(4));
    g = L.tick(g, 1, all(g));
    const others = new Set(answerers(g));
    g = L.pause(L.tick(g, 10, others), 15);
    expect([g.phase, L.tick(g, 10 + L.JUDGE_AWAY_MS, others).phase]).toEqual(['judge', 'judge']);
    g = L.resume(g, 100_000);
    expect(L.tick(g, 100_000 + L.JUDGE_AWAY_MS - 6, others).phase).toBe('judge');
    expect(L.tick(g, 100_000 + L.JUDGE_AWAY_MS - 5, others).phase).toBe('vote');
  });

  it('never lets a trade undo a winning point, and only players still in can end the game', () => {
    let g = room(3, { target: 5, trade: true });
    g = { ...g, players: g.players.map((p) => ({ ...p, score: p.pid === 'p0' ? 4 : 0 })) };
    g = L.step(L.play(g, 'p0', g.at, [g.hands.p0[0]], ['']), 1, all(g));
    expect([g.phase, L.canTrade(g, 'p0')]).toEqual(['reveal', false]);
    expect(L.trade(g, 'p0', 0, [g.hands.p0[0]], rand)).toBe(g);
    expect(L.step(g, 2, all(g)).phase).toBe('over');
    expect(L.step(L.leave(g, 'p0'), 2, all(g)).phase).toBe('answer');
  });
});
