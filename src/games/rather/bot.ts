// Would You Rather's bot brain (simple, *house*): taps a side at random after a short random
// delay, once a question. It sees only its own phone's view.
import { quick, type Brain } from '../../lib/room/bots';
import type { View } from './view';

export const ratherBrain = (): Brain<View> => ({
  decide({ view: v, me, left, rand }) {
    if (v.phase !== 'vote' || !v.prompt || v.mine !== undefined || !v.players.some((p) => p.pid === me)) return null;
    const side = rand() < 0.5 ? 0 : 1;
    return { key: `vote:${v.at}`, wait: quick(rand, left), act: () => [{ t: 'vote', at: v.at, n: v.n, side }] };
  },
});
