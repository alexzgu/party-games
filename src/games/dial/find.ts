// Spectrum's packs in the shared pack list.
import { customSpectra, type SpectrumPack } from '../../lib/content';
import { counted, packTag, type PackEntry } from '../../lib/packList';

/** A pack as the setup's pack list shows it; a search hit names a whole scale ("Cold | Hot"). */
export const packEntry = (p: SpectrumPack): PackEntry => ({
  id: p.id, name: p.name, blurb: p.blurb, added: p.added,
  size: p.cards.length, sizeLabel: counted(p.cards.length, 'cards'), tag: packTag(p.custom, customSpectra.isEdited(p.id)),
  items: p.cards.map((c) => ({ label: `${c.left} | ${c.right}` })),
});
