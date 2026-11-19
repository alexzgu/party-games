// Dev-only fixtures for screenshots: #/forehead/play?demo=ready|count|play|flash|flashpass|pause|timesup|results
// (add &rot=90 to see the turned play screen), #/forehead/make?demo=form|triage. Never linked from the UI.
import { newRound, type Round } from './round';
import { recordScore } from './state.svelte';

const WORDS = ['Moon Landing', 'Taylor Swift', 'Pizza', 'Spider-Man', 'Eiffel Tower', 'Karaoke', 'Hot Dog', 'Netflix', 'Zebra', 'Jurassic Park', 'Beyoncé'];

export function demoRound(kind: string): Round {
  const base = newRound(['movies', 'food'], 60, true);
  const shown = WORDS.slice(1).map((word, i) => ({ word, ok: i % 3 !== 1 }));
  if (kind === 'ready' || kind === 'count') return base;
  if (kind === 'results') {
    recordScore({ id: 'demo-a', score: 5, total: 9, decks: 'Movies' });
    recordScore({ id: base.id, score: shown.filter((s) => s.ok).length, total: shown.length, decks: 'Movies + Food & Drink' });
    return { ...base, phase: 'results', shown, ended: 'time', remainingMs: 0 };
  }
  return { ...base, phase: 'play', current: WORDS[0], shown: shown.slice(0, 5), remainingMs: kind === 'play' ? 42_000 : 8_000 };
}
