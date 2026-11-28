// Big 2's bot brain (simple, *house*): on its turn, after a short random wait, it leads its lowest
// card, or follows with the weakest play that beats the table, or passes when it has none. It sees
// only its own phone's view.
import { quick, type Brain } from '../../lib/room/bots';
import { classify } from './combos';
import { lowestSingle, plays, type Need } from './moves';
import type { ToHost } from './protocol';
import type { View } from './view';

/** What the play on turn must meet, as a phone sees it. */
export const needIn = (v: View): Need => ({ table: v.table ? classify(v.table.cards) : null, first: v.first ?? null });

/** The bot's move on this view. */
export function choose(v: View): ToHost | null {
  if (!v.hand?.length) return null;
  const need = needIn(v);
  if (!need.table) {
    const card = lowestSingle(v.hand, need);
    return card === null ? null : { t: 'play', at: v.at, cards: [card] };
  }
  const best = plays(v.hand, need)[0];
  return best ? { t: 'play', at: v.at, cards: best.cards } : { t: 'pass', at: v.at };
}

export const big2Brain = (): Brain<View> => ({
  decide({ view: v, me, left, rand }) {
    if (v.phase !== 'turn' || v.turn !== me) return null;
    const move = choose(v);
    return move ? { key: `move:${v.at}`, wait: quick(rand, left), act: () => [move] } : null;
  },
});
