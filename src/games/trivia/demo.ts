// Fixed screens for `#/trivia/host?demo=<key>` and `#/trivia/join?demo=<key>`: every phase without a room.
// `answer-long` and `reveal-full` show the longest a question (140 characters) and its answers (40
// each) may be, and `reveal-full` a full room of twelve with 20-character names.
import type { Asked, Past, Phase, Player, Result } from './logic';
import type { View } from './view';

const plain: Asked = { category: 'Geography', question: 'Which river flows through Cairo?', answers: ['The Amazon', 'The Nile', 'The Danube', 'The Ganges'], right: 1 };
const longest: Asked = {
  category: 'Renaissance Masterpieces',
  question: 'Which famous painting, finished by an Italian artist in the early sixteenth century, now hangs behind thick glass in a busy museum in Paris?',
  answers: ['Johannes Vermeer’s The Milkmaid portrait', 'Leonardo da Vinci’s portrait La Gioconda', 'Sandro Botticelli’s grand Birth of Venus', 'Rembrandt van Rijn’s big The Night Watch'],
  right: 1,
};
const full: Player[] = ['Christopher Halloway', 'Jacqueline Westbrook', 'Kensington Blackwood', 'Bartholomew Winthrop',
  'Alexandria Fairbanks', 'Dominique Ashborough', 'Evangeline Pemberton', 'Fitzgerald Thornbury', 'Gwendolyn Rutherford',
  'Maximilian Blackmore', 'Penelope Fitzwilliam', 'Constantine Ashworth'].map((name, i) => ({ pid: i ? `f${i}` : 'a', name, score: 9870 - i * 655 })); // the phone demos' own seat first
const five: Player[] = [
  { pid: 'a', name: 'Jules', score: 2840 }, { pid: 'b', name: 'Cam', score: 2610 }, { pid: 'c', name: 'Rae', score: 2610 },
  { pid: 'd', name: 'Sage', score: 1450 }, { pid: 'e', name: 'Theo', score: 600 },
];
const results: Past[] = [
  { category: 'Science', question: 'What gas do plants take in from the air?', right: 'Carbon dioxide', correct: 4, of: 5 },
  { category: 'Geography', question: plain.question, right: 'The Nile', correct: 3, of: 5 },
];
const outcomes: Record<string, Result> = {
  reveal: { counts: [1, 3, 0, 1], gains: [{ pid: 'a', points: 940 }, { pid: 'c', points: 815 }, { pid: 'd', points: 560 }] },
  'reveal-full': { counts: [2, 8, 1, 1], gains: full.slice(0, 8).map((p, i) => ({ pid: p.pid, points: 990 - i * 61 })) },
};
const phases: Phase[] = ['lobby', 'category', 'answer', 'reveal', 'over'];
const aliases: Record<string, Phase> = { wait: 'lobby', answered: 'answer', paused: 'answer', 'answer-long': 'answer', 'reveal-full': 'reveal' };

export function demo(key: string, phone: boolean): View {
  const phase = phases.find((p) => p === key) ?? aliases[key] ?? 'lobby';
  const over = phase === 'over';
  const big = key === 'answer-long' || key === 'reveal-full';
  const q = big ? longest : plain;
  const v: View = {
    phase, at: 3, n: over ? 10 : phase === 'lobby' ? 0 : 3, count: 10, paused: key === 'paused',
    left: phase === 'answer' ? 14_000 : phase === 'reveal' ? 6_000 : phase === 'category' ? 2_000 : null,
    total: phase === 'answer' ? 20_000 : phase === 'reveal' ? 8_000 : 3_000,
    players: big ? full : five,
  };
  if (over) return { ...v, results: [...results] };
  if (phase === 'lobby') return v;
  v.category = q.category;
  if (phase === 'category') return v;
  Object.assign(v, { question: q.question, answers: q.answers });
  if (phase === 'answer') v.answered = big ? full.slice(0, 7).map((p) => p.pid) : key === 'answered' ? ['a', 'c', 'd'] : ['c', 'd'];
  if (phase === 'reveal') v.result = { ...(outcomes[key] ?? outcomes.reveal), right: q.right };
  if (phone && (key === 'answered' || phase === 'reveal')) v.mine = 1;
  return v;
}
