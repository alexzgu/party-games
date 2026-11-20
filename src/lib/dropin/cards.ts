import type { RoomCard, WarmCard } from '../content';
import { fold } from '../listing';

export type DropInGame = 'warm' | 'room';
export type Card = WarmCard | RoomCard;
export type RoomType = RoomCard['type'];

export const roomTypes: { type: RoomType; label: string }[] = [
  { type: 'side', label: 'Pick a side' },
  { type: 'proof', label: 'Show proof' },
  { type: 'foley', label: 'Make sounds' },
  { type: 'together', label: 'Say it together' },
];

export const isWarm = (card: Card): card is WarmCard => 'answer' in card;

export function giveaway(card: WarmCard): string | undefined {
  const words = fold(card.answer).split(' ').filter(Boolean);
  return words.find((word) => card.clues.some((clue) => fold(clue).split(' ').includes(word)));
}

export function formatCard(card: Card): string {
  if (isWarm(card)) return `${card.answer}: ${card.clues.join('; ')}`;
  switch (card.type) {
    case 'side': return `side: ${card.a} | ${card.b}`;
    case 'foley': return `foley: ${card.lines.join(' / ')}`;
    default: return `${card.type}: ${card.text}`;
  }
}

export function cardKey(card: Card): string {
  if (isWarm(card)) return fold(card.answer);
  if (card.type === 'side') return 'side:' + [fold(card.a), fold(card.b)].sort().join('|');
  return card.type + ':' + fold(formatCard(card).slice(card.type.length + 1));
}

const textFits = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max;

export function cardProblem(game: DropInGame, raw: unknown): string | undefined {
  if (!raw || typeof raw !== 'object') return 'Enter a card.';
  const card = raw as Card;
  if (game === 'warm') {
    if (!isWarm(card) || !textFits(card.answer, 60) || !Array.isArray(card.clues) ||
        card.clues.length < 4 || card.clues.length > 6 || !card.clues.every((clue) => textFits(clue, 120))) {
      return 'Use an answer up to 60 characters and 4–6 clues up to 120 characters each.';
    }
    if (new Set(card.clues.map(fold)).size !== card.clues.length) return 'Each clue must be different.';
    const word = giveaway(card);
    if (word) return `A clue contains an answer word (“${word}”).`;
    return;
  }
  if (isWarm(card)) return 'Use side, proof, foley or together.';
  switch (card.type) {
    case 'side':
      if (textFits(card.a, 80) && textFits(card.b, 80) && fold(card.a) !== fold(card.b)) return;
      return 'Give two different choices up to 80 characters each.';
    case 'foley':
      if (Array.isArray(card.lines) && card.lines.length >= 2 && card.lines.length <= 4 &&
          card.lines.every((line) => textFits(line, 140)) &&
          card.lines.some((line) => /\[[^\[\]\n]+\]/.test(line))) return;
      return 'Use 2–4 lines up to 140 characters each with a [SOUND] cue.';
    case 'proof':
    case 'together':
      if (textFits(card.text, 140)) return;
      return 'Enter a prompt up to 140 characters.';
    default: return 'Use side, proof, foley or together.';
  }
}

export function parseCard(game: DropInGame, line: string): Card {
  const colon = line.indexOf(':');
  if (colon < 0) throw new Error('Put a colon after the answer or card type.');
  const label = line.slice(0, colon).trim();
  const body = line.slice(colon + 1).trim();
  const split = (separator: string) => body.split(separator).map((part) => part.trim());
  let card: Card;
  if (game === 'warm') {
    card = { answer: label, clues: split(';') };
  } else {
    switch (label.toLowerCase()) {
      case 'side': {
        const [a, b, extra] = split('|');
        if (extra !== undefined) throw new Error('Use one | between the choices.');
        card = { type: 'side', a, b };
        break;
      }
      case 'proof': card = { type: 'proof', text: body }; break;
      case 'together': card = { type: 'together', text: body }; break;
      case 'foley': card = { type: 'foley', lines: split('/') }; break;
      default: throw new Error('Use side, proof, foley or together.');
    }
  }
  const problem = cardProblem(game, card);
  if (problem) throw new Error(problem);
  return card;
}

export function parseCards(game: DropInGame, text: string): Card[] {
  return text.split(/\r?\n/).flatMap((line, index) => {
    if (!line.trim()) return [];
    try {
      return [parseCard(game, line)];
    } catch (error) {
      throw new Error(`Line ${index + 1}. ${(error as Error).message}`);
    }
  });
}
