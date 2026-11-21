import { PhoneLink } from '../../lib/room/phone-link.svelte';
import type { ToHost } from './protocol';
import type { PlayerView } from './view';

export type { Link } from '../../lib/room/phone-link.svelte';

function keep(msg: ToHost, view: PlayerView): boolean {
  if (msg.serial !== view.serial) return false;
  const draft = view.draft;
  switch (msg.t) {
    case 'guess': return view.phase === 'present' && !view.acknowledged.includes(msg.id);
    case 'pick':
    case 'select': return !view.ready && msg.reshuffled === view.reshuffled;
    case 'reshuffle': return !view.reshuffled && !view.ready;
    case 'word': return !!draft && draft.index === msg.frame && draft.values[msg.slot] !== msg.value
      && draft.choices[msg.slot]?.includes(msg.value) === true;
    case 'publish': return !!draft && draft.index === msg.frame && (view.phase === 'present' || !view.ready);
    default: return false;
  }
}

export const phone = new PhoneLink<ToHost, PlayerView>('salad', { keep });
