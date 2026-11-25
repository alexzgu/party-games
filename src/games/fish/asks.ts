// The one ask a phone may still need to send again after a reconnect: its latest, while its turn is
// in play and until the host refuses it. An older ask, or one refused, is never sent again.
import type { ToHost } from './protocol';
import type { View } from './view';

export class LatestAsk {
  private latest: ToHost | null = null;

  /** A new ask replaces any before it. */
  set(m: ToHost): ToHost {
    this.latest = m;
    return m;
  }

  /** The host refused it: it leaves the queue. */
  drop(): void { this.latest = null; }

  /** The phone link's test for each queued message, given the host's newest view. */
  keep = (m: ToHost, v: View): boolean => m === this.latest && v.phase === 'turn' && m.at === v.at;
}
