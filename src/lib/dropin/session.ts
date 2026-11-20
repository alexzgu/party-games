import { makeBag } from '../bag';
import type { DropInPack } from '../content';
import { load, save } from '../storage';
import { cardKey, isWarm, type Card, type DropInGame, type RoomType } from './cards';

export interface Options {
  packs: string[];
  types: RoomType[];
  drip: 0 | 8 | 15;
}

export interface Round {
  card: Card;
  step: number;
  revealed: boolean;
  left: number;
  options: Options;
}

export function begin(card: Card, options: Options): Round {
  const left = isWarm(card) ? options.drip * 1000 :
    card.type === 'proof' ? 30_000 : card.type === 'foley' ? 0 : 3000;
  return { card, options, step: 0, revealed: false, left };
}

export const readRound = (game: DropInGame) => load<Round | null>(`${game}:round`, null);
export const saveRound = (game: DropInGame, round: Round) => save(`${game}:round`, round);

export function advance(round: Round): Round | undefined {
  const { card, step, options, revealed } = round;
  if (isWarm(card)) {
    if (revealed || step >= card.clues.length - 1) return;
    const next = step + 1;
    return { ...round, step: next, left: next < card.clues.length - 1 ? options.drip * 1000 : 0 };
  }
  if (card.type === 'foley') return step < card.lines.length - 1 ? { ...round, step: step + 1 } : undefined;
  if (!revealed) return { ...round, revealed: true, left: 0 };
}

export function draw(game: DropInGame, packs: DropInPack<Card>[], options: Options): Card | undefined {
  const unique = new Set<string>();
  const bags = packs.filter((pack) => options.packs.includes(pack.id)).flatMap((pack) => {
    const groups = new Map<string, Card[]>();
    for (const card of pack.cards) {
      const type = isWarm(card) ? 'clues' : card.type;
      if (!isWarm(card) && !options.types.includes(card.type)) continue;
      const key = cardKey(card);
      if (unique.has(key)) continue;
      unique.add(key);
      const group = groups.get(type);
      if (group) group.push(card);
      else groups.set(type, [card]);
    }
    return [...groups].map(([type, cards]) => ({
      bag: makeBag(`${game}:${pack.id}:${type}`, cards, cardKey),
      size: cards.length,
    }));
  });
  const fresh = bags.reduce((total, { bag }) => total + bag.remaining, 0);
  if (!fresh && bags.length > 1) bags.forEach(({ bag }) => bag.reset());
  let ticket = Math.random() * (fresh || bags.reduce((total, { size }) => total + size, 0));
  for (const { bag, size } of bags) {
    ticket -= fresh ? bag.remaining : size;
    if (ticket < 0) return bag.next();
  }
}
