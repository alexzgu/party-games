// Fizzwick the Wizard is how players see live generation. How hard he tries picks the model.

export const EFFORTS = [
  { id: 'claude-haiku-5-5', emoji: '🥱', label: 'Half-asleep', hint: 'Quick and cheap, a bit lazy.' },
  { id: 'claude-sonnet-5-5', emoji: '☕', label: 'Had his coffee', hint: 'Good ideas, fairly quick.' },
  { id: 'claude-opus-5-5', emoji: '🔮', label: 'Full beard power', hint: 'His best ideas; takes longest.' },
] as const;

export const DEFAULT_MODEL = 'claude-opus-5-5';

/** The model to use for a stored choice; anything unknown (an old or retired id) gets the default. */
export function modelFor(stored: string): string {
  return EFFORTS.some((e) => e.id === stored) ? stored : DEFAULT_MODEL;
}
