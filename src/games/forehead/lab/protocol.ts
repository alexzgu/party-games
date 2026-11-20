// The Tilt lab's spoken script: what the phone tells the holder to do, and when. Every step is
// logged with its time, so the recording carries its own labels ("down" asked at t, "talk and
// look around, no tilting" from t to t + 20 s).

export type CueKind = 'say' | 'still' | 'down' | 'up' | 'hold-down' | 'hold-up' | 'back' | 'noise';

export interface Step {
  kind: CueKind;
  /** What the phone says (and shows). */
  text: string;
  /** Which part of the session, for the analysis. */
  block: string;
  /** Milliseconds until the next step. */
  ms: number;
}

function shuffled<T>(xs: T[], rnd: () => number): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function tilts(block: string, downs: number, ups: number, gapMs: number, jitterMs: number, rnd: () => number): Step[] {
  const kinds = shuffled([...Array(downs).fill('down'), ...Array(ups).fill('up')] as ('down' | 'up')[], rnd);
  return kinds.map((kind) => ({
    kind, block, text: kind === 'down' ? 'Down' : 'Up', ms: gapMs + Math.round(rnd() * jitterMs),
  }));
}

const say = (block: string, text: string, ms: number, kind: CueKind = 'say'): Step => ({ kind, block, text, ms });

/** About three and a half minutes. */
export function labScript(rnd: () => number = Math.random): Step[] {
  return [
    say('intro', 'Put the phone on your forehead, sideways, screen facing out, like in the game.', 7000),
    say('rest', 'Hold still.', 5000, 'still'),
    say('normal', 'Normal tilts, like playing. Tilt, then come back.', 4000),
    ...tilts('normal', 5, 5, 3200, 1000, rnd),
    say('fast', 'Now fast, like a hot streak.', 3000),
    ...tilts('fast', 6, 2, 1700, 300, rnd),
    say('small', 'Now the smallest nod that you think should count.', 4000),
    ...tilts('small', 4, 4, 3200, 800, rnd),
    say('big', 'Now big tilts.', 2500),
    ...tilts('big', 3, 3, 3200, 800, rnd),
    say('noise', 'Now no tilting. Talk, laugh, and look around the room until I say stop.', 20000, 'noise'),
    say('noise', 'Look left.', 3000, 'noise'),
    say('noise', 'Look right.', 3000, 'noise'),
    say('noise', 'Lean back in your chair.', 4000, 'noise'),
    say('noise', 'Sit up straight.', 3000, 'noise'),
    say('noise', 'Laugh out loud.', 4000, 'noise'),
    say('hold', 'Stop. Now tilt down and hold it.', 4000, 'hold-down'),
    say('hold', 'Back to the middle.', 3000, 'back'),
    say('hold', 'Tilt up and hold it.', 4000, 'hold-up'),
    say('hold', 'Back to the middle.', 3000, 'back'),
    say('end', 'Done. Take the phone off.', 1500),
  ];
}
