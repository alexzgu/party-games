// Doodle Brawl's bot brain (simple, *house*): draws a random doodle and names it from a short
// list, before the timer ends; votes at random; keeps its fighter or tags one in at random. It
// sees only its own phone's view.
import { pickOne, quick, slow, type Brain } from '../../lib/room/bots';
import { doodle } from '../../lib/doodle';
import type { View } from './view';

const NAMES = ['Sir Scribbles', 'Captain Blob', 'Doodlebug', 'The Squiggle', 'Mega Noodle', 'Lord Smudge', 'Professor Zigzag', 'Big Wobbly'];

export const brawlBrain = (): Brain<View> => ({
  decide({ view: v, left, rand }) {
    if ((v.phase === 'draw' || v.phase === 'challenge') && v.draw) {
      const act = () => [{ t: 'draw', at: v.at, name: pickOne(NAMES, rand), d: doodle(rand) }];
      return { key: `draw:${v.draw.id}`, wait: slow(rand, left), act };
    }
    if (v.phase === 'vote' && v.vote) {
      return { key: `vote:${v.at}`, wait: quick(rand, left), act: () => [{ t: 'vote', at: v.at, side: rand() < 0.5 ? 0 : 1 }] };
    }
    if (v.phase === 'tag' && v.options && !v.done) {
      // '' keeps the fighter on the card; an id tags in one shown before.
      const ids = ['', ...v.options.map((f) => f.id)];
      return { key: `tag:${v.at}`, wait: quick(rand, left), act: () => [{ t: 'tag', at: v.at, id: pickOne(ids, rand) }] };
    }
    return null;
  },
});
