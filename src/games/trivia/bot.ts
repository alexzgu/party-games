// Smarty Pants's bot brain (simple, *house*): answers once a question after 2–8 s, right about 55%
// of the time. Its phone's view never says which answer is right, so the host screen running it
// tells it (`rightOf`, the question in play's right answer by number); the bot only uses it to
// play at that rate.
import type { Brain } from '../../lib/room/bots';
import { CHOICES, type Choice } from './state';
import type { View } from './view';

/** How often a bot is right (*house*). */
export const BOT_RIGHT = 0.55;

export const triviaBrain = (rightOf: (n: number) => Choice | null): Brain<View> => ({
  decide({ view: v, me, left, rand }) {
    if (v.phase !== 'answer' || !v.answers || v.mine !== undefined || !v.players.some((p) => p.pid === me)) return null;
    const think = 2000 + Math.round(rand() * 6000);
    const wait = left === null ? think : Math.max(300, Math.min(think, left - 800));
    const lucky = rand() < BOT_RIGHT;
    const spin = rand();
    return {
      key: `answer:${v.at}`, wait, act: () => {
        const right = rightOf(v.n);
        const wrong = CHOICES.filter((c) => c !== right);
        const choice = right !== null && lucky ? right : wrong[Math.floor(spin * wrong.length)];
        return [{ t: 'answer', at: v.at, n: v.n, choice }];
      },
    };
  },
});
