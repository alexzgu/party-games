// A phone's side of Sketchy: its link to the host, and the drawings it has been sent.
import { PhoneLink } from '../../lib/room/phone-link.svelte';
import type { Drawing } from '../../lib/ink';
import { apply, type Delta } from './live';
import { readArt, readLive, type ToHost } from './protocol';
import type { View } from './view';

class Gallery {
  art = $state.raw<Record<string, Drawing>>({});
  /** The host asked the drawer for the whole drawing (it missed some ink): counts up each time. */
  resync = $state(0);
  private seq: Record<string, number | undefined> = {};
  private asked = 0;

  put(id: string, d: Drawing, n?: number) {
    this.art = { ...this.art, [id]: d };
    this.seq[id] = n;
  }

  /** Live ink for a drawing: added on, or (if some went missing) the whole drawing asked for. */
  live(id: string, n: number, delta: Delta) {
    const have = this.art[id];
    const next = have && this.seq[id] === n - 1 ? apply(have, delta) : null;
    if (next) return this.put(id, next, n);
    if (Date.now() - this.asked < 1000) return;
    this.asked = Date.now();
    phone.ask({ t: 'art?', id });
  }

  clear() {
    this.art = {};
    this.seq = {};
  }
}

export const gallery = new Gallery();
export const phone: PhoneLink<ToHost, View> = new PhoneLink<ToHost, View>('sketch', {
  keep: (m, v) => m.t !== 'art?' && m.at === v.at &&
    (m.t === 'line' || m.t === 'draw' ? !!v.task && !v.sent : m.t === 'pick' ? !!v.offer : false),
  other: (raw) => {
    if (raw.t === 'ink?') { gallery.resync++; return; }
    const a = readArt(raw);
    if (a) return gallery.put(a.id, a.d, a.n);
    const l = readLive(raw);
    if (l) gallery.live(l.id, l.n, l.delta);
  },
});
