// Fixed screens for `#/hand/host?demo=<key>` and `#/hand/join?demo=<key>`: every phase without a room.
import type { Phase, Win } from './logic';
import type { Answer, Card, View } from './view';

const prompt = 'My therapist says ___ is not a personality.';
const texts = ['A haunted air fryer', 'Doing taxes in a bathtub', 'My landlord’s ferret', 'Three raccoons in a trench coat',
  'Aggressive birthday karaoke', 'Unearned confidence', 'A strongly worded sticky note', 'The last slice of pizza',
  'Crying at a car commercial', 'Being weirdly good at bowling'];
const hand: Card[] = texts.map((text, id) => ({ id, text }));
const answers: Answer[] = [
  { texts: ['Knowing every bridge in Ohio'], by: 'c' }, { texts: ['Unearned confidence'], by: 'a' },
  { texts: ['A podcast about my ex'], by: 'd' }, { texts: ['Owning a sword'], by: 'e' },
];
const results: Win[] = [
  { prompt, texts: ['Unearned confidence'], by: 'a' },
  { prompt: 'Step one: ___. Step two: ___.', texts: ['Owning a sword', 'Moving to Portugal'], by: 'e' },
  { prompt: 'What ruined the group chat?', texts: ['A voice memo from Grandma'], by: 'b' },
];
const phases: Phase[] = ['lobby', 'answer', 'judge', 'vote', 'reveal', 'over'];
const aliases: Record<string, Phase> = {
  play: 'answer', spotlight: 'judge', paused: 'answer', wait: 'answer', played: 'answer', judging: 'judge', trade: 'answer', blank: 'answer',
};

export function demo(key: string, phone: boolean): View {
  const phase = phases.find((p) => p === key) ?? aliases[key] ?? 'lobby';
  const judge = key === 'judge' || key === 'spotlight' || key === 'wait' ? 'a' : 'b';
  const v: View = {
    phase, at: 3, round: phase === 'over' ? 9 : 4, target: 7, paused: key === 'paused', house: null,
    left: phase === 'answer' ? 41_000 : phase === 'vote' ? 22_000 : phase === 'reveal' ? 6_000 : null,
    total: phase === 'answer' ? 60_000 : phase === 'vote' ? 30_000 : 8_000,
    players: [
      { pid: 'a', name: 'Jules', score: phase === 'over' ? 7 : 3 }, { pid: 'b', name: 'Cam', score: phase === 'over' ? 5 : 2 },
      { pid: 'c', name: 'Rae', score: phase === 'over' ? 4 : 2 }, { pid: 'd', name: 'Sage', score: 1 }, { pid: 'e', name: 'Theo', score: 0 },
    ],
  };
  if (phase === 'over') return { ...v, results };
  if (phase === 'lobby') return v;
  Object.assign(v, { judge, prompt, picks: 1 });
  const others = v.players.map((p) => p.pid).filter((p) => p !== judge);
  if (phase === 'answer') Object.assign(v, { answering: others.filter((p) => p !== 'e' || key !== 'play'), progress: key === 'played' ? ['a', 'c'] : ['c', 'd'] });
  else {
    const reveal = phase === 'reveal';
    Object.assign(v, { answers: answers.map((a) => reveal ? a : { texts: a.texts }), spotlight: key === 'spotlight' || key === 'judging' ? 1 : reveal ? 1 : null });
    if (reveal) v.winner = 1;
    if (phase === 'vote') Object.assign(v, { voted: true, progress: ['c'] });
  }
  if (!phone) return v;
  v.hand = key === 'blank' ? [{ id: 99, text: '' }, ...hand.slice(1)] : hand;
  v.traded = 0;
  if (key === 'played') v.played = ['Unearned confidence'];
  if (key === 'trade') v.trade = true;
  if (phase !== 'answer' && judge !== 'a') v.mine = 1;
  if (phase === 'vote') Object.assign(v, { canVote: true, hasVoted: false });
  return v;
}

/** A phone demo's selection already under way. */
export function demoStart(key: string | null): { cards: number[]; typed: string; trading: boolean } {
  if (key === 'play') return { cards: [2], typed: '', trading: false };
  if (key === 'blank') return { cards: [99], typed: 'Collecting spoons from hotels', trading: false };
  return { cards: [], typed: '', trading: key === 'trade' };
}
