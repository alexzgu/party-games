// Don't Say It's packs in the shared pack list.
import { customTaboo, type TabooPack } from '../../lib/content';
import { counted, packTag, type PackEntry } from '../../lib/packList';

/** A pack as the setup's pack list shows it; a search hit names the card's word, found by it or its banned words. */
export const packEntry = (p: TabooPack): PackEntry => ({
  id: p.id, name: p.name, blurb: p.blurb, added: p.added,
  size: p.cards.length, sizeLabel: counted(p.cards.length, 'cards'), tag: packTag(p.custom, customTaboo.isEdited(p.id)),
  items: p.cards.map((c) => ({ label: c.word, text: `${c.word} ${c.banned.join(' ')}` })),
});
