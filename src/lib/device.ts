// Which kind of device this is, only to word device-specific help (Settings' sound and
// vibration notes, the tilt check). Never used to change how a game plays.

export type Device = 'iphone' | 'ipad' | 'android' | 'other';

/** iPadOS reports itself as a Mac; a touchscreen gives it away (Macs have none). */
export function deviceOf(userAgent: string, maxTouchPoints: number): Device {
  if (/Android/i.test(userAgent)) return 'android';
  if (/iPhone|iPod/.test(userAgent)) return 'iphone';
  if (/iPad/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)) return 'ipad';
  return 'other';
}

export const device: Device = typeof navigator === 'undefined' ? 'other' : deviceOf(navigator.userAgent, navigator.maxTouchPoints ?? 0);

/** How this device names itself in a sentence ("on iPhone"). */
export const DEVICE_NAME: Record<Device, string> = { iphone: 'iPhone', ipad: 'iPad', android: 'Android', other: 'another device' };

/** Settings' Sound note: only iPhone and iPad have the silent switch it is about. */
export function soundHint(d: Device): string | undefined {
  return d === 'iphone' || d === 'ipad' ? 'Plays even with the silent switch on' : undefined;
}

/** Settings' Vibration note: what this device actually does when the game buzzes. */
export function vibrationHint(d: Device): string {
  return { iphone: 'A light tick, not a buzz', ipad: "iPads can't vibrate", android: 'Off while the phone is on silent', other: "Most computers and tablets can't vibrate" }[d];
}
