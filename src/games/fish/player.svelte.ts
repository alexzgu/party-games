import { PhoneLink } from '../../lib/room/phone-link.svelte';
import type { Rank } from '../../lib/cards/deck';
import type { ToHost } from './protocol';
import type { View } from './view';

/** An ask still needs to reach the host while its turn is in play. */
const keep = (m: ToHost, v: View): boolean => v.phase === 'turn' && m.at === v.at;

/** The host turned down this phone's last ask (counted, so each one is noticed). */
class Refusals { count = $state(0); }
export const refusals = new Refusals();

export const phone = new PhoneLink<ToHost, View>('fish', {
  keep,
  other: (m) => { if (m.t === 'refused') refusals.count++; },
});

/** Asks `to` for `rank`, on the turn in play (`at`). */
export function ask(at: number, to: string, rank: Rank): void {
  phone.send({ t: 'ask', at, to, rank });
}
