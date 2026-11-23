// Word Salad's bot brain (simple, *house*): picks one of its three secrets at random, fills each
// clue with the first word offered for every blank and publishes it; when presenting, publishes a
// few follow-ups. As a guesser it tells the category from the opening clue (as a player would)
// and guesses that category's answers from the packs, a few per turn. It sees only its own
// phone's view (and the packs a phone has).
import { pickOne, quick, type Brain } from '../../lib/room/bots';
import { newPid } from '../../lib/room/code';
import { saladPacks } from '../../lib/content';
import { categories, opening, type Category } from './words';
import type { PlayerView } from './view';

/** Follow-up clues a presenting bot publishes, and guesses a guessing bot makes, per turn (*house*). */
const FOLLOW_UPS = 3;
const GUESSES = 5;

/** The category an opening clue was written in, read off its frame. */
export function categoryOf(clue: string): Category | null {
  return categories.find((c) => clue.startsWith(opening[c].text.split('___')[0])) ?? null;
}

const between = (rand: () => number, lo: number, hi: number) => lo + Math.round(rand() * (hi - lo));
const before = (wait: number, left: number | null) => (left === null ? wait : Math.max(300, Math.min(wait, left - 1500)));

export const saladBrain = (): Brain<PlayerView> => ({
  decide({ view: v, me, left, rand }) {
    const serial = v.serial;
    if (v.phase === 'pick' && !v.ready && v.offers.length) {
      const index = Math.floor(rand() * v.offers.length);
      return { key: `pick:${serial}`, wait: quick(rand, left), act: () => [{ serial, t: 'pick', index, reshuffled: v.reshuffled }] };
    }
    const composing = (v.phase === 'prepare' && !v.ready) || (v.phase === 'present' && v.presenter === me);
    if (composing && v.draft) {
      if (v.phase === 'present' && v.sentences.length > FOLLOW_UPS) return null;
      const d = v.draft;
      const frame = d.index;
      const blank = d.values.findIndex((x) => x === null);
      if (blank < 0) {
        return { key: `publish:${serial}:${frame}:${v.sentences.length}`, wait: between(rand, 800, 1500), act: () => [{ serial, t: 'publish', frame }] };
      }
      const first = d.choices[blank]?.[0];
      const thinking = d.values.every((x) => x === null)
        ? before(v.phase === 'present' ? between(rand, 6000, 12000) : between(rand, 1000, 3000), left)
        : between(rand, 600, 1500);
      const act = () => [first === undefined ? { serial, t: 'skipFrame', frame } : { serial, t: 'word', frame, slot: blank, value: first }];
      return { key: `word:${serial}:${frame}:${blank}`, wait: thinking, act };
    }
    if (v.phase === 'present' && v.presenter && v.presenter !== me && v.players.some((p) => p.pid === me && !p.kicked)) {
      const category = categoryOf(v.sentences[0] ?? '');
      const mine = v.guesses.filter((g) => g.pid === me).length;
      if (!category || mine >= GUESSES) return null;
      const said = new Set(v.guesses.map((g) => g.text.toLowerCase()));
      const answers = saladPacks().flatMap((p) => p.secrets).filter((s) => s.category === category && !said.has(s.answer.toLowerCase()));
      if (!answers.length) return null;
      const act = () => [{ serial, t: 'guess', id: newPid(), text: pickOne(answers, rand).answer }];
      return { key: `guess:${serial}:${mine}`, wait: before(between(rand, 5000, 10000), left), act };
    }
    return null;
  },
});
