import { describe, expect, it } from 'vitest';
import { LatestAsk } from './asks';
import type { ToHost } from './protocol';
import type { View } from './view';

const turn = (at: number): View => ({ phase: 'turn', at, left: 20_000, total: 30_000, paused: false, players: [], pool: 10, log: [], turn: 'me' });
const ask = (to: string, rank: number): ToHost => ({ t: 'ask', at: 4, to, rank });
/** What a reconnecting phone would send again: its queue, pruned by `keep` against the host's fresh view. */
const resent = (asks: LatestAsk, queue: ToHost[], v: View) => queue.filter((m) => asks.keep(m, v));

describe('Go Fish asks a phone keeps', () => {
  it('keep only the latest ask, for its own turn', () => {
    const asks = new LatestAsk();
    const sevens = asks.set(ask('sam', 7));
    expect(resent(asks, [sevens], turn(4))).toEqual([sevens]);
    expect(resent(asks, [sevens], turn(5))).toEqual([]);
    expect(resent(asks, [sevens], { ...turn(4), phase: 'show' })).toEqual([]);
    const nines = asks.set(ask('lee', 9));
    expect(resent(asks, [sevens, nines], turn(4))).toEqual([nines]);
  });

  it('drop an ask the host refused, so a reconnect on the same turn never sends it again', () => {
    const asks = new LatestAsk();
    const sevens = asks.set(ask('sam', 7)); // sent just as the host paused
    asks.drop(); // refused
    expect(resent(asks, [sevens], turn(4))).toEqual([]);
    const nines = asks.set(ask('lee', 9)); // after resuming, a new pick
    expect(resent(asks, [sevens, nines], turn(4))).toEqual([nines]); // the Wi-Fi blips: only the nines go again
  });
});
