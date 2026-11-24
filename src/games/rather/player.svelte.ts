import { PhoneLink } from '../../lib/room/phone-link.svelte';
import type { ToHost } from './protocol';
import type { Side } from './state';
import type { View } from './view';

/** This phone's latest tap message: only it is worth (re)sending, as the last tap counts. */
let latest: ToHost | null = null;

/** Whether a queued tap still needs to reach the host, given its newest view. */
const keep = (m: ToHost, v: View): boolean => m === latest && v.phase === 'vote' && m.at === v.at && v.mine !== m.side;

/** The host turned down this phone's last tap (counted, so each one is noticed). */
class Refusals { count = $state(0); }
export const refusals = new Refusals();

export const phone = new PhoneLink<ToHost, View>('rather', {
  keep,
  other: (m) => { if (m.t === 'refused') refusals.count++; },
});

/** Sends a tap on a side of question `n`, asked in phase `at`. */
export function vote(at: number, n: number, side: Side): void {
  latest = { t: 'vote', at, n, side };
  phone.send(latest);
}
