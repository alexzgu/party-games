import { PhoneLink } from '../../lib/room/phone-link.svelte';
import type { ToHost } from './protocol';
import type { View } from './view';

/** Whether a queued message still needs to reach the host, given its newest view. */
function keep(m: ToHost, v: View): boolean {
  if (m.t === 'trade') return (v.traded ?? 0) === m.n && !!v.trade;
  if (m.at !== v.at) return false;
  if (m.t === 'play') return v.phase === 'answer' && !v.played;
  if (m.t === 'spot') return v.phase === 'judge' && v.spotlight !== m.i;
  if (m.t === 'pick') return v.phase === 'judge';
  return v.phase === 'vote' && !v.hasVoted;
}

/** The host turned down this phone's last play, pick, vote or trade (counted, so each one is noticed). */
class Refusals { count = $state(0); }
export const refusals = new Refusals();

export const phone = new PhoneLink<ToHost, View>('hand', {
  keep,
  other: (m) => { if (m.t === 'refused') refusals.count++; },
});
