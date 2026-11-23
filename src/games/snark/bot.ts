// Snark Tank's bot brain (simple, *house*): answers with the prompt's stock answer when its view
// carries one, else a short stock line or a random two-word phrase; three-line duels get three
// such lines; votes go at random. It sees only its own phone's view.
import { pickOne, quick, slow, type Brain } from '../../lib/room/bots';
import type { PlayerView } from './view';

const LINES = [
  'My landlord', 'A suspicious casserole', 'Three raccoons in a coat', 'Emotional damage',
  'The group chat', 'Free samples', 'A strongly worded email', 'Grandma\'s secret recipe',
  'Interpretive dance', 'Unpaid overtime', 'A haunted printer', 'Vibes only',
];
const ADJECTIVES = ['Sad', 'Haunted', 'Tiny', 'Spicy', 'Damp', 'Feral', 'Sparkly', 'Overconfident', 'Sleepy', 'Expired'];
const NOUNS = ['raccoon', 'spreadsheet', 'hot tub', 'podcast', 'yoga mat', 'lasagna', 'goose', 'karaoke', 'minivan', 'houseplant'];

/** A short line: a stock one, or an adjective and a noun at random. */
export const snarkLine = (rand: () => number) =>
  rand() < 0.5 ? pickOne(LINES, rand) : `${pickOne(ADJECTIVES, rand)} ${pickOne(NOUNS, rand)}`;

// Job keys carry the prompt: rounds and positions repeat after Play again, prompts do not.
export const snarkBrain = (): Brain<PlayerView> => ({
  decide({ view, left, rand }) {
    const s = view.screen;
    const r = view.round;
    if (s.k === 'write' && s.tasks.length) {
      const t = s.tasks[0];
      const act = () => [s.lines
        ? { t: 'lines', r, i: t.i, lines: [snarkLine(rand), snarkLine(rand), snarkLine(rand)] }
        : { t: 'answer', r, i: t.i, text: t.safety ?? snarkLine(rand) }];
      return { key: `write:${r}:${t.i}:${t.prompt}`, wait: slow(rand, left), act };
    }
    if (s.k === 'vote' && !s.own && s.voted === null) {
      const open = s.choices.filter((c) => !c.empty);
      if (!open.length) return null;
      return { key: `vote:${r}:${s.at}:${s.prompt}`, wait: quick(rand, left), act: () => [{ t: 'vote', r, at: s.at, c: pickOne(open, rand).id }] };
    }
    if (s.k === 'vote3' && !s.sent && s.choices.length) {
      const act = () => {
        const v: Record<string, number> = {};
        for (let k = 0; k < 3; k++) {
          const id = pickOne(s.choices, rand).id;
          v[id] = (v[id] ?? 0) + 1;
        }
        return [{ t: 'votes', r, at: s.at, v }];
      };
      return { key: `votes:${r}:${s.at}:${s.prompt}`, wait: quick(rand, left), act };
    }
    return null;
  },
});
