// Sketchy's bot brain (simple, *house*). Telephone: writes a random idea from the room's packs,
// draws a random doodle, describes a drawing with a random word. Draw & guess: picks a word at
// random and streams a random doodle a stroke at a time through the live-ink path, as a phone
// does; as a guesser it guesses honestly, a few words per turn from the packs that fit the word's
// shape and the letters shown. It sees only its own phone's view, and reads the host
// screen's packs (its own packs included).
import { pickOne, quick, slow, type Brain } from '../../lib/room/bots';
import { doodle } from '../../lib/doodle';
import { sketchPacks } from '../../lib/content';
import type { Drawing } from '../../lib/ink';
import { SPARE_IDEAS, SPARE_WORDS } from './spare';
import type { View } from './view';

/** Guesses per turn, at most (*house*). */
const GUESSES = 4;

function packs(ids: string[]) {
  const all = sketchPacks();
  const chosen = all.filter((p) => ids.includes(p.id));
  return chosen.length ? chosen : all;
}
const ideas = (ids: string[]) => [...packs(ids).flatMap((p) => p.ideas), ...SPARE_IDEAS];
const words = (ids: string[]) => [...packs(ids).flatMap((p) => p.words), ...SPARE_WORDS];

/** Whether a word fits the shape a guesser sees: `_` a hidden letter, anything else shown as is. */
export function fits(word: string, shape: string): boolean {
  const w = [...word.toLowerCase()], s = [...shape.toLowerCase()];
  return w.length === s.length && s.every((ch, i) => (ch === '_' ? /\p{L}|\d/u.test(w[i]) : ch === w[i]));
}

/** A drawing being streamed: how many strokes are sent and the number of the last send. */
type Stream = { id: string; d: Drawing; sent: number; n: number };
type Mem = { ink?: Stream; resync?: boolean; tried?: { id: string; words: string[] } };

/** Waits at most until just before the timer ends. */
const before = (wait: number, left: number | null) => (left === null ? wait : Math.max(300, Math.min(wait, left - 1000)));

export const sketchBrain = (): Brain<View> => ({
  hear(msg, mem) {
    if (msg.t === 'ink?') (mem as Mem).resync = true;
  },
  decide({ view: v, me, left, rand, mem: raw }) {
    const mem = raw as Mem;
    const t = v.task;
    if (t && !v.sent) {
      const act = () => [t.kind === 'draw'
        ? { t: 'draw', at: v.at, d: doodle(rand) }
        : { t: 'line', at: v.at, text: pickOne(t.kind === 'write' ? ideas(v.packs) : words(v.packs), rand) }];
      return { key: `step:${t.id}`, wait: slow(rand, left), act };
    }
    if (v.phase === 'pick' && v.offer?.length) {
      const i = Math.floor(rand() * v.offer.length);
      return { key: `pick:${v.at}`, wait: quick(rand, left), act: () => [{ t: 'pick', at: v.at, i }] };
    }
    if (v.phase !== 'guess' || !v.ink) return null;
    if (v.drawer === me) return stream(v, mem, rand, left);
    if (!v.guessing || !v.shape) return null;
    if (mem.tried?.id !== v.ink) mem.tried = { id: v.ink, words: [] };
    const tried = mem.tried;
    const shape = v.shape;
    const fit = words(v.packs).filter((w) => fits(w, shape) && !tried.words.includes(w.toLowerCase()));
    if (tried.words.length >= GUESSES || !fit.length) return null;
    const wait = before((tried.words.length ? 5000 : 4000) + rand() * 7000, left);
    const act = () => {
      const word = pickOne(fit, rand);
      tried.words.push(word.toLowerCase());
      return [{ t: 'guess', at: v.at, text: word }];
    };
    return { key: `guess:${v.ink}:${tried.words.length}`, wait, act };
  },
});

/** The drawer: the first send carries the whole drawing so far, then one stroke at a time; the host asking (`ink?`) gets it all again. */
function stream(v: View, mem: Mem, rand: () => number, left: number | null) {
  if (mem.ink?.id !== v.ink) mem.resync = false;
  const s: Stream = mem.ink && mem.ink.id === v.ink ? mem.ink : (mem.ink = { id: v.ink!, d: doodle(rand), sent: 0, n: 0 });
  if (mem.resync && s.n > 0) {
    const act = () => { mem.resync = false; s.n++; return [{ t: 'ink', at: v.at, n: s.n, all: s.d.slice(0, s.sent) }]; };
    return { key: `ink:${s.id}:all:${s.n}`, wait: 300, act };
  }
  if (s.sent >= s.d.length) return null;
  const act = () => {
    const k = s.sent++;
    s.n++;
    return [s.n === 1 ? { t: 'ink', at: v.at, n: s.n, all: s.d.slice(0, s.sent) } : { t: 'ink', at: v.at, n: s.n, i: k, o: 0, d: [s.d[k]] }];
  };
  return { key: `ink:${s.id}:${s.sent}`, wait: s.sent ? 800 + Math.round(rand() * 1200) : quick(rand, left), act };
}
