import { describe, expect, it } from 'vitest';
import { endedRecord, finish, gameRecord, judge, newGame, rematch, reseat, reshuffle, reveal, roundNote, startSteal, timeUp, undo, validGame, validSetup, winner, type GameState } from './logic';
import { reseating } from '../../lib/players';

const opts = { target: 2, seconds: 5, steal: true, stealUsesTurn: false, packIds: ['classic'] };
const start = (steal = true, stealUsesTurn = false) => newGame(['Ana', 'Ben', 'Cy'], { ...opts, steal, stealUsesTurn });
const scores = (s: GameState) => s.players.map((p) => p.score);
/** One turn: reveal, run out the clock, judge. */
const turn = (s: GameState, got: boolean, prompt = 'pizza toppings') => judge(timeUp(reveal(s, prompt)), got);
/** A missed turn whose steal is judged `got`. */
const stolen = (s: GameState, got: boolean) => judge(timeUp(startSteal(turn(s, false))), got);
/** Turns judged in a row: true a point, false a miss (Steal off). */
const turns = (s: GameState, ...got: boolean[]) => got.reduce((t, g) => turn(t, g), s);

describe('Brain Freeze rules', () => {
  it('needs two players', () => {
    expect(() => newGame(['Ana'], opts)).toThrow();
    expect(newGame(['Ana', 'Ben'], opts).players).toHaveLength(2);
  });

  it('gives the point to whoever is up and passes the phone round the circle', () => {
    let s = turn(start(), true);
    expect(scores(s)).toEqual([1, 0, 0]);
    expect(s.phase).toBe('handoff');
    expect(s.turn).toBe(1);
    s = turn(s, false);
    s = judge(timeUp(startSteal(s)), false); // Cy's steal fails too
    expect(s.turn).toBe(2);
    expect(scores(s)).toEqual([1, 0, 0]);
  });

  it('a miss with Steal on goes to the next player, same prompt, and their point counts', () => {
    const live = reveal(start(), 'pizza toppings');
    const missed = judge(timeUp(live), false);
    expect(missed.phase).toBe('steal');
    expect(missed.actor).toBe(1);
    const stealLive = startSteal(missed);
    expect(stealLive.phase).toBe('live');
    expect(stealLive.prompt).toBe('pizza toppings');
    expect(stealLive.timeLeft).toBe(5000);
    const stolen = judge(stealLive, true); // Ben got 3 before the buzzer
    expect(scores(stolen)).toEqual([0, 1, 0]);
    expect(stolen.turn).toBe(1); // Ben's own turn is next
    expect(stolen.log).toEqual([{ prompt: 'pizza toppings', player: 0, stealer: 1, scorer: 1 }]);
  });

  it('a miss with Steal off ends the turn with no point', () => {
    const s = turn(start(false), false);
    expect(s.phase).toBe('handoff');
    expect(scores(s)).toEqual([0, 0, 0]);
    expect(s.log[0]).toEqual({ prompt: 'pizza toppings', player: 0, stealer: -1, scorer: -1 });
  });

  it('undo takes back the last judgement, point and all, from the hand-off or the steal', () => {
    const judging = timeUp(reveal(start(), 'pizza toppings'));
    const scored = judge(judging, true);
    const back = undo(scored);
    expect(back.phase).toBe('judge');
    expect(scores(back)).toEqual([0, 0, 0]);
    expect(back.log).toEqual([]);
    expect(back.turn).toBe(0);
    expect(undo(judge(judging, false)).phase).toBe('judge');
    // Once the next prompt is up there is nothing left to undo.
    const next = reveal(scored, 'kinds of soup');
    expect(next.prev).toBeNull();
    expect(undo(next)).toBe(next);
  });

  it('wins at the target once the round is done, through the hand-off', () => {
    let s = turns(start(false), true, true, true, true); // everyone 1, then Ana 2
    expect(winner(s)).toBe(-1); // Ben and Cy still play this round
    expect(roundNote(s)).toBe('Ana reached 2 — the rest of the round still plays');
    expect(finish(s)).toBe(s);
    s = turns(s, false, false);
    expect(winner(s)).toBe(0);
    expect(roundNote(s)).toBe('');
    expect(s.phase).toBe('handoff');
    expect(reveal(s, 'kinds of soup')).toBe(s); // no more prompts once someone has won
    const w = finish(s);
    expect(w.phase).toBe('win');
    expect(undo(w)).toBe(w);
    const r = rematch(w);
    expect(scores(r)).toEqual([0, 0, 0]);
    expect(r.phase).toBe('handoff');
    expect(r.log).toEqual([]);
    expect(r.turn).toBe(1); // Ana started, so Ben starts the rematch
    const again = turns(r, true, false, false, true); // round one from Ben, then Ben 2 as round two starts
    expect(winner(again)).toBe(-1);
    expect(winner(turns(again, false, false))).toBe(1);
  });

  it('plays another full round when the top is tied at the target', () => {
    let s = turns(start(false), true, true, false, true, true); // Ana 2, Ben 2, Cy 0
    s = turn(s, false); // the round ends tied on top
    expect(winner(s)).toBe(-1);
    expect(roundNote(s)).toBe('Ana and Ben are tied on 2 — a tie when the round ends plays one more round');
    s = turns(s, false, true, false); // Ben 3
    expect(winner(s)).toBe(1);
  });

  it('undo takes back a round-ending win', () => {
    const s = turns(start(false), true, true, true, true, false, false);
    expect(winner(s)).toBe(0);
    expect(winner(undo(s))).toBe(-1);
    expect(undo(s).phase).toBe('judge');
  });

  it('a steal can use up the stealer\'s turn, which counts as played in the round', () => {
    expect(stolen(start(), true).turn).toBe(1); // off: Ben stole, then takes his own turn
    let s = stolen(start(true, true), true); // on: Ben's steal was his turn
    expect(s.turn).toBe(2);
    expect(scores(s)).toEqual([0, 1, 0]);
    s = stolen(s, true); // Cy misses, Ana steals with her next round's turn: round one is over
    expect(s.turn).toBe(1); // round two goes on from Ben
    expect(s.left).toBe(2);
    s = stolen(s, false); // Ben misses, Cy's steal fails and was her turn: round two is over
    expect(scores(s)).toEqual([1, 1, 0]);
    expect(s.turn).toBe(0);
    expect(s.left).toBe(3);
  });

  it('remembers dealt prompts so none comes up twice in a game', () => {
    const s = turn(turn(start(false), true, 'Pizza  toppings'), false, 'kinds of soup');
    expect(s.dealt).toEqual(['pizza toppings', 'kinds of soup']);
  });
});

describe('Brain Freeze history', () => {
  it('records a win with every score and a line per turn', () => {
    let s = turn(start(), true, 'pizza toppings'); // Ana
    s = judge(startSteal(judge(timeUp(reveal(s, 'kinds of soup')), false)), true); // Ben misses, Cy steals
    s = turn(s, true, 'birds'); // Cy
    s = finish(s);
    const r = gameRecord(s, ['Classic']);
    expect(r.game).toBe('quick');
    expect(r.title).toBe('Cy won 2–1–0');
    expect(r.finished).toBe(true);
    expect(r.scores).toEqual([{ name: 'Cy', score: 2 }, { name: 'Ana', score: 1 }, { name: 'Ben', score: 0 }]);
    expect(r.details).toEqual(['Name 3 pizza toppings: Ana ✓', 'Name 3 kinds of soup: Ben ✗, Cy stole it', 'Name 3 birds: Cy ✓']);
  });

  it('records a thrown-away game as ended early, and nothing when no turn was played', () => {
    expect(endedRecord(start(), [])).toBeNull();
    expect(endedRecord(reveal(start(), 'birds'), [])).toBeNull();
    const s = turn(start(false), true);
    const r = endedRecord(s, ['Classic']);
    expect(r?.title).toBe('Ana led 1–0–0');
    expect(r?.finished).toBe(false);
    const reached = turns(s, false, false, true); // Ana 2 in a round still under way: not won yet
    expect(endedRecord(reached, [])?.title).toBe('Ana led 2–0–0');
    expect(endedRecord(finish(turns(reached, false, false)), [])).toBeNull(); // already won: recorded by the win
  });
});

describe('Brain Freeze saves', () => {
  it('resumes a saved game, undo included, through JSON', () => {
    const s = judge(timeUp(reveal(start(), 'pizza toppings')), false);
    const back = validGame(JSON.parse(JSON.stringify(s)));
    expect(back).toEqual(s);
    expect(undo(back!).phase).toBe('judge');
  });

  it('rejects damaged saves instead of breaking the screen', () => {
    const s = reveal(start(), 'birds');
    expect(validGame(null)).toBeNull();
    expect(validGame({ ...s, v: 2 })).toBeNull();
    expect(validGame({ ...s, players: [{ name: 'Solo', score: 0 }] })).toBeNull();
    expect(validGame({ ...s, phase: 'reveal' })).toBeNull();
    expect(validGame({ ...s, prompt: null })).toBeNull();
    expect(validGame({ ...s, actor: 7 })).toBeNull();
    expect(validGame({ ...s, prev: { broken: true } })?.prev).toBeNull();
    expect(validGame({ ...s, won: 1 })).toBeNull(); // only a hand-off or the win screen has a winner
  });

  it('loads a game saved before rounds were counted', () => {
    const { stealUsesTurn: _a, left: _b, won: _c, ...old } = turns(start(false), true);
    expect(validGame(old)).toMatchObject({ stealUsesTurn: false, left: 2, won: -1 });
    expect(validGame({ ...old, phase: 'win' })?.won).toBe(0);
    // Under the old rules reaching the target won at once, so that hand-off keeps its winner.
    const { stealUsesTurn: _d, left: _e, won: _f, ...reached } = turns(start(false), false, false, true, false, false, true); // Cy reaches 2
    expect(validGame(reached)?.won).toBe(2);
  });

  it('checks setup choices field by field', () => {
    expect(validSetup(null)).toEqual({ packIds: null, seconds: 5, target: 7, steal: true, stealUsesTurn: false });
    expect(validSetup({ seconds: 7, target: 99, steal: false, stealUsesTurn: true, packIds: ['a'] })).toEqual({ packIds: ['a'], seconds: 7, target: 7, steal: false, stealUsesTurn: true });
  });
});

describe('players edited in setup', () => {
  it('keeps scores by person and drops a removed player with their turns', () => {
    let s = turn(start(), true); // Ana scores
    s = turn(s, true); // Ben scores
    const t = reseat(s, reseating(['Ana', 'Cy', 'Dee'], [0, 2, -1], 3));
    expect(scores(t)).toEqual([1, 0, 0]);
    expect(t.log.map((x) => x.player)).toEqual([0]);
    expect(t.players[t.turn].name).toBe('Cy');
    expect(t.prev).toBeNull();
  });

  it('keeps the round going with whoever still owes a turn, newcomers included', () => {
    let s = turns(start(false), true, true); // Ana 1, Ben 1; Cy is up, last in the round
    const added = reseat(s, reseating(['Ana', 'Ben', 'Cy', 'Dee'], [0, 1, 2, -1], 3));
    expect(added.left).toBe(2); // Cy, then Dee, who sits before Ana
    s = turn(s, true); // Cy 1: a new round
    s = turns(s, true, false); // Ana 2, Ben misses: Cy still to play
    const gone = reseat(s, reseating(['Ana', 'Ben'], [0, 1], 3));
    expect(winner(gone)).toBe(0); // nobody left in the round: it ends
    expect(gone.phase).toBe('handoff');
  });

  it('restarts a steal when a newcomer now sits between the player and the stealer', () => {
    const s = startSteal(judge(timeUp(reveal(turns(start(), true, true), 'birds')), false)); // Cy missed, Ana steals
    const t = reseat(s, reseating(['Ana', 'Ben', 'Cy', 'Dee'], [0, 1, 2, -1], 3));
    expect(t.phase).toBe('handoff');
    expect(t.players[t.turn].name).toBe('Cy');
  });

  it('restarts a turn whose player was removed mid-clock', () => {
    const s = reveal(start(), 'pizza toppings'); // Ana is up
    const t = reseat(s, reseating(['Ben', 'Cy'], [1, 2], 3));
    expect(t.phase).toBe('handoff');
    expect(t.prompt).toBeNull();
    expect(t.players[t.turn].name).toBe('Ben');
  });
});

describe('reshuffle', () => {
  it('frees every prompt but the last one played', () => {
    let s = turn(start(false), true, 'pizza toppings');
    s = turn(s, false, 'dog breeds');
    expect(reshuffle(s).dealt).toEqual(['dog breeds']);
  });
});
