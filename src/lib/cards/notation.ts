// Cards written the short way, "7s 7h Kd 10c" (rank A, 2–10, J, Q, K, then a suit letter), for
// tests and fixed demo screens.
import { cardOf, type Card } from './deck';

const SUIT = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' } as const;
const FACE: Record<string, number> = { A: 1, J: 11, Q: 12, K: 13 };

export const cardList = (list: string): Card[] => list.split(' ').filter(Boolean).map((x) => {
  const r = x.slice(0, -1);
  return cardOf(FACE[r] ?? +r, SUIT[x.slice(-1) as keyof typeof SUIT]);
});
