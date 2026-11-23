// Bad Hand's bot brain (simple, *house*): plays random cards (two, in order, on a two-blank
// prompt; a short typed line on a blank card); as judge shows each answer large for about 3 s,
// then picks one at random; votes at random, never for its own answer. It sees only its own
// phone's view.
import { pickOne, quick, type Brain } from '../../lib/room/bots';
import { shuffle } from '../../lib/random';
import type { View } from './view';

const BLANK_LINES = ['A surprise tax audit', 'My emotional support goose', 'Whatever is in the fridge', 'Free wifi', 'A very long voicemail'];
/** How long the judge shows each answer large (*house*). */
const SPOT_MS = 3000;

export const handBrain = (): Brain<View> => ({
  decide({ view: v, me, left, rand }) {
    if (v.phase === 'answer' && v.answering?.includes(me) && v.judge !== me && !v.played && v.hand && v.picks) {
      const n = v.picks;
      if (v.hand.length < n) return null;
      const act = () => {
        const cards = shuffle(v.hand!, rand).slice(0, n);
        return [{ t: 'play', at: v.at, cards: cards.map((c) => c.id), texts: cards.map((c) => c.text || pickOne(BLANK_LINES, rand)) }];
      };
      return { key: `play:${v.at}`, wait: quick(rand, left), act };
    }
    if (v.phase === 'judge' && v.judge === me && v.answers?.length) {
      // Each answer large in turn, then the pick.
      const next = v.spotlight === null || v.spotlight === undefined ? 0 : v.spotlight + 1;
      if (next < v.answers.length) {
        return { key: `spot:${v.at}:${next}`, wait: next === 0 ? quick(rand, left) : SPOT_MS, act: () => [{ t: 'spot', at: v.at, i: next }] };
      }
      const i = Math.floor(rand() * v.answers.length);
      return { key: `pick:${v.at}`, wait: SPOT_MS, act: () => [{ t: 'pick', at: v.at, i }] };
    }
    if (v.phase === 'vote' && v.canVote && !v.hasVoted && v.answers) {
      const others = v.answers.map((_, i) => i).filter((i) => i !== v.mine);
      if (!others.length) return null;
      return { key: `vote:${v.at}`, wait: quick(rand, left), act: () => [{ t: 'vote', at: v.at, i: pickOne(others, rand) }] };
    }
    return null;
  },
});
