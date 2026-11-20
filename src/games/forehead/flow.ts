// Starting and leaving a round. `startRound` must run inside the Start tap: iOS only allows
// audio, the motion prompt and wake lock from a user gesture.
import { unlockAudio } from '../../lib/sound';
import { keepAwake } from '../../lib/wakelock';
import { go } from '../../lib/router.svelte';
import { newRound } from './round';
import { setRound, type Input } from './state.svelte';
import { enterPlayMode, exitPlayMode, motion, startMotion, stopMotion } from './sensors.svelte';

/** Everything a gesture can unlock: sound, fullscreen, wake lock and motion. */
export function wakeDevice(): void {
  if (!motion.live) void startMotion(); // first: the iOS/iPad prompt needs the untouched gesture
  unlockAudio();
  enterPlayMode();
  keepAwake(true);
}

export function startRound(deckIds: string[], seconds: number, input: Input, replace = false): void {
  // Motion first: the iOS/iPad prompt must be requested before fullscreen or anything else
  // touches the gesture. Restarted every round so the sign is re-learned while the player
  // looks at the screen.
  void startMotion(true);
  unlockAudio();
  enterPlayMode();
  keepAwake(true);
  setRound(newRound(deckIds, seconds, input !== 'tap', input !== 'tilt'));
  go('/forehead/play', replace);
}

/** Leaving the play screens: let the phone sleep and rotate normally again. */
export function releaseDevice(): void {
  stopMotion();
  motion.live = false;
  exitPlayMode();
  keepAwake(false);
}
