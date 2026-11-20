// Spoken cues and direction tones for when the phone is on a forehead and nobody can read it
// (calibration, the Tilt lab). `unlockVoice` must run inside a tap: iOS starts audio and speech
// only from a user gesture.
let audio: AudioContext | null = null;

export function unlockVoice(): void {
  try {
    audio ??= new AudioContext();
    void audio.resume();
    speechSynthesis.speak(new SpeechSynthesisUtterance(' '));
  } catch { /* no audio: the screen still shows every cue */ }
}

/** Says `text`, cutting off anything still being said; `onstart` gets the moment speech began. */
export function say(text: string, onstart?: () => void): void {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.1;
    if (onstart) u.onstart = onstart;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch { /* no speech */ }
}

export function hush(): void {
  try { speechSynthesis.cancel(); } catch { /* ignore */ }
}

/** A short tone: falling for down, rising for up, flat otherwise. */
export function tone(kind: 'down' | 'up' | 'other'): void {
  if (!audio) return;
  const [f, to] = kind === 'down' ? [440, 300] : kind === 'up' ? [660, 990] : [550, 550];
  const now = audio.currentTime + 0.01;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.frequency.setValueAtTime(f, now);
  osc.frequency.exponentialRampToValueAtTime(to, now + 0.18);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.3, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
  osc.connect(gain).connect(audio.destination);
  osc.start(now);
  osc.stop(now + 0.25);
}
