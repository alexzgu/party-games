import { describe, expect, it } from 'vitest';
import type { TabooCard } from '../../lib/content';
import { cardProblems, parseCards } from './cards';
import { demoGame, SCREENS } from './demo';
import {
  finishTurn, fixMark, inTiebreak, markCard, newGame, nextTurn, rematch, reopenTurn, restore, reuseCards, scores, scoresBefore, startTurn, tiedAtEnd, timeUp,
  type Config, type Game,
} from './state';
import { summarize, summarizeEarly, winLine } from './summary';

const card = (word: string): TabooCard => ({ word, banned: ['a', 'b', 'c', 'd', 'e'] });
const cfg = (patch: Partial<Config> = {}): Config => ({
  names: ['Reds', 'Blues'], seconds: 60, mode: 'score', goal: 3, rounds: 2, skipCost: false, packIds: ['classic'], ...patch,
});

/** Plays one whole turn for the active team with these marks, through to the scoreboard (or win). */
function play(g: Game, marks: ('got' | 'skip' | 'buzz')[]): Game {
  g = startTurn(g, card(`w${g.turns.length}-0`));
  marks.forEach((m, i) => (g = markCard(g, m, card(`w${g.turns.length}-${i + 1}`))));
  return finishTurn(timeUp(g));
}

describe('scoring', () => {
  it('gives +1 for got, −1 for a buzz, 0 for a skip and for the card left when time ran out', () => {
    const g = play(newGame(cfg({ goal: 50 })), ['got', 'got', 'buzz', 'skip']);
    expect(g.phase).toBe('scores');
    expect(scores(g)).toEqual([1, 0]);
    expect(g.turns[0].cards.map((c) => c.mark)).toEqual(['got', 'got', 'buzz', 'skip', 'time']);
  });

  it('charges a point per skip with the skip rule on', () => {
    const g = play(newGame(cfg({ goal: 50, skipCost: true })), ['got', 'skip', 'skip']);
    expect(scores(g)).toEqual([-1, 0]);
  });

  it('lets the summary fix a mark, and the score follows', () => {
    let g = startTurn(newGame(cfg({ goal: 50 })), card('one'));
    g = markCard(g, 'skip', card('two'));
    g = timeUp(g);
    expect(scores(g)).toEqual([0, 0]);
    g = fixMark(g, 0); // skip → buzz
    expect(g.turns[0].cards[0].mark).toBe('buzz');
    g = fixMark(g, 0); // buzz → got
    g = fixMark(g, 1); // time → got (said at the buzzer)
    expect(scores(g)).toEqual([2, 0]);
    expect(fixMark(g, 1).turns[0].cards[1].mark).toBe('buzz');
  });

  it('keeps the turn off the scoreboard until it has been reviewed', () => {
    let g = startTurn(newGame(cfg({ goal: 50 })), card('one'));
    g = markCard(g, 'got', card('two'));
    expect(scores(g)).toEqual([1, 0]);
    expect(scoresBefore(g)).toEqual([0, 0]);
    g = finishTurn(timeUp(g));
    expect(scoresBefore(g)).toEqual([0, 0]);
    expect(scoresBefore(nextTurn(g))).toEqual([1, 0]);
  });

  it('ends the turn early when the packs run out of cards', () => {
    const g = markCard(startTurn(newGame(cfg()), card('last')), 'got', undefined);
    expect(g.phase).toBe('summary');
    expect(g.card).toBeNull();
  });
});

describe('turns and winning', () => {
  it('alternates teams and only declares a winner after both teams have had equal turns', () => {
    let g = play(newGame(cfg({ goal: 3 })), ['got', 'got', 'got']);
    expect(g.phase).toBe('scores'); // Reds reached 3, but Blues still get their turn
    g = nextTurn(g);
    expect(g.active).toBe(1);
    g = play(g, ['got']);
    expect(g.phase).toBe('win');
    expect(g.winner).toBe(0);
  });

  it('plays on when both teams are level at the target', () => {
    let g = play(newGame(cfg({ goal: 3 })), ['got', 'got', 'got']);
    g = play(nextTurn(g), ['got', 'got', 'got']);
    expect(g.phase).toBe('scores');
    expect(tiedAtEnd(g)).toBe(true);
    g = play(nextTurn(g), ['got']);
    g = play(nextTurn(g), []);
    expect(g.winner).toBe(0);
  });

  it('ends after the set number of rounds in rounds mode', () => {
    let g = newGame(cfg({ mode: 'rounds', rounds: 2, goal: 1 }));
    g = play(g, ['got', 'got']);
    g = play(nextTurn(g), ['got']);
    expect(g.phase).toBe('scores'); // goal is ignored in rounds mode
    g = play(nextTurn(g), []);
    g = play(nextTurn(g), ['got', 'got']);
    expect(g.phase).toBe('win');
    expect(g.winner).toBe(1);
  });

  it('rematch keeps the settings and lets the other team start', () => {
    const g = rematch({ ...play(newGame(cfg()), ['got']), phase: 'win', winner: 0 });
    expect(g.turns).toEqual([]);
    expect(g.starter).toBe(1);
    expect(g.active).toBe(1);
    expect(g.names).toEqual(['Reds', 'Blues']);
  });
});

describe('resume', () => {
  it('restores every demo screen from saved JSON, and rejects broken saves', () => {
    for (const s of SCREENS) {
      const g = demoGame(s)!;
      expect(restore(JSON.parse(JSON.stringify(g)))).toEqual(g);
    }
    const g = demoGame('turn')!;
    expect(restore({ ...g, v: 2 })).toBeNull();
    expect(restore({ ...g, card: null })).toBeNull();
    expect(restore({ ...g, turns: [{ team: 3, cards: [] }] })).toBeNull();
    expect(restore(null)).toBeNull();
  });
});

describe('history', () => {
  it('counts rounds and words on the win screen in plain English', () => {
    const one = play(nextTurn(play(newGame(cfg({ goal: 1 })), ['got'])), []);
    expect(one.phase).toBe('win');
    expect(winLine(one)).toBe('1 round · 1 word guessed · first to 1');
    let two = play(newGame(cfg({ mode: 'rounds', rounds: 2 })), ['got', 'got']);
    for (const marks of [['got'], [], []] as const) two = play(nextTurn(two), [...marks]);
    expect(two.phase).toBe('win');
    expect(winLine(two)).toBe('2 rounds · 3 words guessed · 2-round game');
  });

  it('records the winner first with one line per turn', () => {
    const e = summarize(demoGame('win')!, ['Classic']);
    expect(e.title).toBe('Loudmouths beat Mimes 3–2');
    expect(e.finished).toBe(true);
    expect(e.details?.[0]).toBe('1. Loudmouths +3 · ✓ Pizza, ✓ Karaoke, ↷ Jet lag, ✓ Fortune cookie, ⏱ Snowman');
  });

  it('records a game ended early only once a card has been marked, including the turn in play', () => {
    expect(summarizeEarly(newGame(cfg()), [])).toBeNull();
    expect(summarizeEarly(startTurn(newGame(cfg()), card('x')), [])).toBeNull();
    const e = summarizeEarly(demoGame('turn')!, ['Classic'])!;
    expect(e.finished).toBe(false);
    expect(e.title).toBe('Loudmouths 4 – Mimes 2');
    expect(e.details).toHaveLength(3);
  });
});

describe('cards', () => {
  it('rejects banned words that overlap the word, wrong counts and long entries', () => {
    expect(cardProblems({ word: 'Pizza', banned: ['Cheese', 'Slice', 'Pepperoni', 'Italian', 'Delivery'] })).toEqual([]);
    expect(cardProblems({ word: 'Pizza', banned: ['Pizzas', 'Slice', 'Pepperoni', 'Italian', 'Delivery'] })).toHaveLength(1);
    expect(cardProblems({ word: 'Hot dog', banned: ['Dog', 'Bun', 'Mustard', 'Ketchup', 'Bun'] })).toHaveLength(2);
    expect(cardProblems({ word: 'A b c d', banned: ['x'] })).toHaveLength(2);
  });

  it('reads pasted lines in colon, dash and table form', () => {
    const { cards, bad } = parseCards([
      '1. Pizza: Cheese, Slice, Pepperoni, Italian, Delivery',
      '- **Beach** – Sand, Ocean, Waves, Sunscreen, Towel',
      '| Word | 1 | 2 | 3 | 4 | 5 |',
      '|---|---|---|---|---|---|',
      '| Coffee | Bean | Mug | Morning | Caffeine | Starbucks |',
      'Gym: Workout, Gym rat, Weights, Treadmill, Sweat',
    ].join('\n'));
    expect(cards.map((c) => c.word)).toEqual(['Pizza', 'Beach', 'Coffee']);
    expect(cards[1].banned).toEqual(['Sand', 'Ocean', 'Waves', 'Sunscreen', 'Towel']);
    expect(bad).toHaveLength(1);
  });
});

describe('between turns', () => {
  it('reopens the turn\'s cards from the scoreboard to fix a mark', () => {
    const g = play(newGame(cfg()), ['got', 'buzz']);
    expect(g.phase).toBe('scores');
    const fixed = fixMark(reopenTurn(g), 1); // the buzz was a got
    expect(scores(finishTurn(fixed))).toEqual([2, 0]);
  });

  it('deals played cards again when the packs run out', () => {
    const g = nextTurn(play(newGame(cfg()), ['got']));
    expect(g.played.length).toBeGreaterThan(0);
    expect(reuseCards(g).played).toEqual([]);
  });

  it('calls the rounds after a level finish a tiebreak', () => {
    let g = newGame(cfg({ mode: 'rounds', rounds: 1 }));
    g = nextTurn(play(g, ['got']));
    g = play(g, ['got']);
    expect(tiedAtEnd(g)).toBe(true);
    expect(inTiebreak(g)).toBe(true);
    expect(inTiebreak(newGame(cfg()))).toBe(false);
  });
});
