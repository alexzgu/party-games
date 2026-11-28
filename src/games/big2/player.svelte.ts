import { PhoneLink } from '../../lib/room/phone-link.svelte';
import { LatestMove } from '../../lib/room/latest';
import type { Card } from '../../lib/cards/deck';
import type { ToHost } from './protocol';
import type { View } from './view';

const moves = new LatestMove<ToHost>();

/** The host turned down this phone's last move (counted, so each one is noticed). */
class Refusals { count = $state(0); }
export const refusals = new Refusals();

export const phone = new PhoneLink<ToHost, View>('big2', {
  keep: moves.keep,
  other: (m) => {
    if (m.t !== 'refused') return;
    moves.drop();
    refusals.count++;
  },
});

/** Plays `cards` on the turn in play (`at`). */
export const playCards = (at: number, cards: readonly Card[]) => phone.send(moves.set({ t: 'play', at, cards: [...cards] }));

/** Passes on the turn in play (`at`). */
export const pass = (at: number) => phone.send(moves.set({ t: 'pass', at }));
