import { PhoneLink } from '../../lib/room/phone-link.svelte';
import type { ToHost } from './protocol';
import type { Choice } from './state';
import type { View } from './view';

/** This phone's tap message: worth (re)sending until the host has it, as the first tap is final. */
let latest: ToHost | null = null;

/** Whether a queued tap still needs to reach the host, given its newest view. */
const keep = (m: ToHost, v: View): boolean => m === latest && v.phase === 'answer' && m.at === v.at && v.mine === undefined;

/** The host turned down this phone's last tap (counted, so each one is noticed). */
class Refusals { count = $state(0); }
export const refusals = new Refusals();

export const phone = new PhoneLink<ToHost, View>('trivia', {
  keep,
  other: (m) => { if (m.t === 'refused') refusals.count++; },
});

/** Sends a tap on an answer to question `n`, asked in phase `at`. */
export function answer(at: number, n: number, choice: Choice): void {
  latest = { t: 'answer', at, n, choice };
  phone.send(latest);
}
