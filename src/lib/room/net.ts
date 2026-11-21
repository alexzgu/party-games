// The PeerJS side: one Peer per screen, on the chosen broker. The broker only introduces
// phones to the host; game messages go phone ↔ host directly over WebRTC.
import Peer, { type PeerJSOption } from 'peerjs';
import type { Broker } from './broker';

export const BROKER_TROUBLE = "Can't reach the online service that links phones to the host. Check the internet, or see Trouble connecting.";

/** Sends a ping this often; a link silent for LINK_TIMEOUT is treated as dropped. */
export const PING_MS = 2500;
export const LINK_TIMEOUT = 9000;

export function makePeer(id: string | null, broker: Broker | null): Peer {
  const opts: PeerJSOption = { debug: 1, ...(broker ?? {}) };
  return id ? new Peer(id, opts) : new Peer(opts);
}

export type Trouble = 'broker' | 'taken' | 'no-host' | 'other';

export function classify(err: { type?: string }): Trouble {
  switch (err.type) {
    case 'network': case 'server-error': case 'socket-error': case 'socket-closed': case 'disconnected': case 'ssl-unavailable':
      return 'broker';
    case 'unavailable-id': return 'taken';
    case 'peer-unavailable': return 'no-host';
    default: return 'other';
  }
}

/** Retry delays: 1 s, 2 s, 4 s, then every 8 s. */
export const backoff = (attempt: number) => Math.min(8000, 1000 * 2 ** attempt);
