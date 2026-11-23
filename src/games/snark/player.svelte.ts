// A phone's link to the Snark Tank host screen (the shared room link, with Snark Tank's views).
import { PhoneLink } from '../../lib/room/phone-link.svelte';
import type { ToHost } from './protocol';
import type { PlayerView } from './view';

export type { Link } from '../../lib/room/phone-link.svelte';

/** Drops queued messages the host has clearly received (or that are for a prompt that moved on). */
function keep(m: ToHost, v: PlayerView): boolean {
  const s = v.screen;
  if (m.t === 'hello' || m.t === 'pong' || (m.match ?? 0) !== (v.match ?? 0)) return false;
  return m.t === 'answer' || m.t === 'lines' ? s.k === 'write' && m.r === v.round && s.tasks.some((t) => t.i === m.i)
    : m.t === 'vote' ? s.k === 'vote' && m.r === v.round && m.at === s.at && s.voted === null
    : s.k === 'vote3' && m.r === v.round && m.at === s.at && !s.sent;
}

const make = () => new PhoneLink<ToHost, PlayerView>('snark', { keep });

// One per page. In development the instance is kept on window, so a hot module reload (another
// file changing) reuses the live session instead of starting a second one beside it; the
// headless tests read it there too.
const devWindow = (import.meta.env.DEV && typeof window !== 'undefined' ? window : null) as unknown as { snarkPhone?: ReturnType<typeof make> } | null;
export const phone = devWindow ? (devWindow.snarkPhone ??= make()) : make();
