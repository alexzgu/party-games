import { leaksAnswer, shared, type Frame, type Secret, type Slot } from './words';

export interface Draft {
  frame: Frame;
  index: number;
  redeals: number;
  choices: string[][];
  values: (string | null)[];
}

export function random(seed: number): () => number {
  let next = seed >>> 0;
  return () => {
    next = (Math.imul(next, 1664525) + 1013904223) >>> 0;
    return next / 4294967296;
  };
}

export function shuffled<T>(items: readonly T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function dealWords(secret: Secret, slot: Slot, rand: () => number, prior: string[] = []): string[] {
  const fitting = secret.words[slot] ?? [];
  const clues = prior.length ? prior.filter((word) => fitting.includes(word)) : shuffled(fitting, rand).slice(0, 3);
  const decoys = shared[slot].filter((word) =>
    !fitting.includes(word) && !prior.includes(word) && !leaksAnswer(word, secret.answer));
  return shuffled([...clues, ...shuffled(decoys, rand).slice(0, 6 - clues.length)], rand);
}

export function draftFor(secret: Secret, frame: Frame, index: number, rand: () => number): Draft {
  return {
    frame, index, redeals: 0,
    choices: frame.slots.map((slot) => slot === 'guess' ? [] : dealWords(secret, slot, rand)),
    values: frame.slots.map(() => null),
  };
}

export function redeal(secret: Secret, draft: Draft, index: number, rand: () => number): Draft {
  const slot = draft.frame.slots[index];
  if (!slot || slot === 'guess') return draft;
  const choices = dealWords(secret, slot, rand, draft.choices[index]);
  return {
    ...draft, redeals: draft.redeals + 1,
    choices: draft.choices.map((old, i) => i === index ? choices : old),
    values: draft.values.map((value, i) => i === index && !choices.includes(value ?? '') ? null : value),
  };
}

export function sentence(frame: Frame, values: string[]): string {
  return frame.text.split('___').map((part, index) => part + (values[index] ?? '')).join('');
}
