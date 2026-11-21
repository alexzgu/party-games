// What the magic-words box does with what was typed, apart from the screen so it is tested
// without a browser. A whole invite link or bare key becomes the phone's key; something that
// looks like one but is not whole stays on the phone (never sent to the wizard server as
// words); anything else is the magic words, sent once.
import { settings, saveSettings } from './settings.svelte';
import { keyFromTyped } from './invite';
import { WIZARD_SERVER, redeemMessage, redeemPhrase } from './wizardServer';

export const BROKEN_KEY = "That looks like a key but isn't a whole one.";

export type Typed = { kind: 'key'; key: string } | { kind: 'broken' } | { kind: 'words' };

/** Whether `text` is a key (or invite link), part of one, or words. */
export function readTyped(text: string): Typed {
  const key = keyFromTyped(text);
  if (key) return { kind: 'key', key };
  const t = text.trim();
  if (/^sk-ant/i.test(t) || t.includes('sk-ant-') || t.includes('#/join/')) return { kind: 'broken' };
  return { kind: 'words' };
}

/** What the box shows after trying; null when the answer came too late to matter. */
export type Said = { ok: boolean; message: string } | null;

/** The phone's way in right now; a change while the words are out makes their answer stale. */
const wayIn = () => `${settings.apiKey}\n${settings.wizardPass}`;

/**
 * Tries `text`. The answer is dropped (null, nothing saved) when `signal` was aborted (the box
 * went away) or the phone's key or pass changed meanwhile ("Send Fizzwick away", say).
 */
export async function sayWords(text: string, signal?: AbortSignal, server = WIZARD_SERVER): Promise<Said> {
  const typed = readTyped(text);
  if (typed.kind === 'broken') return { ok: false, message: BROKEN_KEY };
  if (typed.kind === 'key') {
    settings.apiKey = typed.key;
    saveSettings();
    return { ok: true, message: "Fizzwick heard you. He's yours on this phone." };
  }
  // No wizard server, so no magic words: the box only takes the host's key.
  if (!server) return { ok: false, message: "That isn't the wizard's key." };
  const before = wayIn();
  const r = await redeemPhrase(text, server, signal);
  if (signal?.aborted || wayIn() !== before) return null;
  if (r.ok) {
    settings.wizardPass = r.token;
    saveSettings();
  }
  return { ok: r.ok, message: redeemMessage(r) };
}
