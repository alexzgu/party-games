import { PhoneLink } from '../../lib/room/phone-link.svelte';
import { readArt, type ToHost } from './protocol';
import type { View } from './view';
import type { Drawing } from './ink';

class Gallery {
  art = $state.raw<Record<string, Drawing>>({});
}
export const gallery = new Gallery();
export const phone = new PhoneLink<ToHost, View>('brawl', {
  keep: (m, v) => m.t !== 'art?' && m.at === v.at &&
    (m.t === 'draw' ? !!v.draw : m.t === 'vote' ? !!v.vote : !!v.options),
  other: (raw) => {
    const a = readArt(raw);
    if (a) gallery.art = { ...gallery.art, [a.id]: a.d };
  },
});
