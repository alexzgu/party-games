// Opening an invite link (`#/join/<key>`) on a phone: the key is wiped from the address bar and
// this history entry first, then stored in settings when it is a valid key. Nothing is logged.
import { keyFromInvite } from './invite';
import { go } from './router.svelte';
import { settings, saveSettings } from './settings.svelte';

/** True when the link carried a valid key, now stored on this phone; false stores nothing. */
export function acceptInvite(path: string): boolean {
  const key = keyFromInvite(path);
  go('/', true); // replaces the entry, so Back and the address bar never show the key again
  if (!key) return false;
  settings.apiKey = key;
  saveSettings();
  return true;
}
