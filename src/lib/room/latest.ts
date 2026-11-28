// The one move a phone may still need to send again after a reconnect: its latest, while the turn
// it was meant for is in play and until the host refuses it. An older move, or one refused, is
// never sent again (Go Fish's asks, Big 2's plays and passes).

/** A move names the turn it was meant for. */
type Move = { at: number };
/** What the phone knows of the host's newest view: the phase and its turn. */
type Turn = { phase: string; at: number };

export class LatestMove<M extends Move> {
  private latest: M | null = null;

  /** A new move replaces any before it. */
  set(m: M): M {
    this.latest = m;
    return m;
  }

  /** The host refused it: it leaves the queue. */
  drop(): void { this.latest = null; }

  /** The phone link's test for each queued message, given the host's newest view. */
  keep = (m: M, v: Turn): boolean => m === this.latest && v.phase === 'turn' && m.at === v.at;
}
