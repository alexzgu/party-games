import { PhoneLink } from '../../lib/room/phone-link.svelte';
import type { Rank } from '../../lib/cards/deck';
import { LatestAsk } from './asks';
import type { ToHost } from './protocol';
import type { View } from './view';

const asks = new LatestAsk();

/** The host turned down this phone's last ask (counted, so each one is noticed). */
class Refusals { count = $state(0); }
export const refusals = new Refusals();

export const phone = new PhoneLink<ToHost, View>('fish', {
  keep: asks.keep,
  other: (m) => {
    if (m.t !== 'refused') return;
    asks.drop();
    refusals.count++;
  },
});

/** Asks `to` for `rank`, on the turn in play (`at`). */
export function ask(at: number, to: string, rank: Rank): void {
  phone.send(asks.set({ t: 'ask', at, to, rank }));
}
