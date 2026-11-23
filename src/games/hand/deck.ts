// Bad Hand's piles: the answer deck (card ids), its discard pile and the prompt queue. Pure:
// every function takes the randomness it uses, so tests can fix it.

export type Rand = () => number;
export type Pile = { deck: number[]; discard: number[] };

export function shuffle<T>(items: readonly T[], rand: Rand): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** About one card in twenty of a deck with blanks is blank. */
export const blankCount = (answers: number) => Math.round(answers / 19);

/**
 * The answer cards as texts ('' is a blank card, filled in by whoever plays it) and a shuffled
 * deck of their ids.
 */
export function buildDeck(answers: readonly string[], withBlanks: boolean, rand: Rand) {
  const cards = [...answers, ...Array<string>(withBlanks ? blankCount(answers.length) : 0).fill('')];
  return { cards, deck: shuffle(cards.map((_, i) => i), rand) };
}

/**
 * Takes up to `n` cards off the top. When the deck runs out the discard pile is shuffled in;
 * held cards are never in either pile, so a card someone holds is never dealt.
 */
export function draw(pile: Pile, n: number, rand: Rand): { pile: Pile; cards: number[] } {
  let { deck, discard } = pile;
  const cards: number[] = [];
  while (cards.length < n) {
    if (!deck.length) {
      if (!discard.length) break;
      deck = shuffle(discard, rand);
      discard = [];
    }
    cards.push(deck[0]);
    deck = deck.slice(1);
  }
  return { pile: { deck, discard }, cards };
}

/** The next prompt; once every prompt has been dealt the queue starts over, freshly shuffled. */
export function nextPrompt(queue: readonly string[], pool: readonly string[], rand: Rand) {
  const q = queue.length ? [...queue] : shuffle(pool, rand);
  return { prompt: q[0] ?? '', queue: q.slice(1) };
}
