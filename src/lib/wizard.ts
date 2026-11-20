// Fizzwick the Wizard is how players see live generation. How hard he tries picks the model.

export const EFFORTS = [
  // `fallback`: the API may switch to another model when this one is overloaded (server-side
  // fallback). Haiku 5.5 has none (Anthropic's refusals-and-fallback docs), so it never asks.
  { id: 'claude-haiku-5-5', emoji: '🥱', label: 'Half-asleep', hint: 'Quick and cheap, a bit lazy.', fallback: false },
  { id: 'claude-sonnet-5-5', emoji: '☕', label: 'Had his coffee', hint: 'Good ideas, fairly quick.', fallback: true },
  { id: 'claude-opus-5-5', emoji: '🔮', label: 'Full beard power', hint: 'His best ideas; takes longest.', fallback: true },
] as const;

export const DEFAULT_MODEL = 'claude-opus-5-5';

/** The model to use for a stored choice; anything unknown (an old or retired id) gets the default. */
export function modelFor(stored: string): string {
  return EFFORTS.some((e) => e.id === stored) ? stored : DEFAULT_MODEL;
}

/** Whether a request for `model` may ask for server-side fallback. */
export function canFallBack(model: string): boolean {
  return EFFORTS.some((e) => e.id === model && e.fallback);
}

/** The API betas `streamLines` turns on with a phone's own key (the wizard server takes none). */
export const WIZARD_BETAS = ['server-side-fallback-2026-07-01'] as const;

/** The most output tokens the wizard server lets one request ask for. */
export const SERVER_MAX_TOKENS = 8000;
