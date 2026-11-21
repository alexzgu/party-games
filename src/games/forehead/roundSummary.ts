import type { Input } from './state.svelte';

const CONTROLS: Record<Input, string> = { tilt: 'tilt only', tap: 'tap only', both: 'tilt or tap' };

/** The setup's Round card line, in plain words: the round length and how to answer. */
export const roundSummary = (seconds: number, input: Input): string =>
  `${seconds < 120 ? `${seconds} s` : `${seconds / 60} min`} rounds · ${CONTROLS[input]}`;
