// The questions a game asks and how an answer scores, shared by the room and Solo: pure.
import { shuffle } from '../../lib/random';
import { parts, triviaKey } from './rules';
import { CHOICES, RIGHT_POINTS, SPEED_POINTS, type Asked, type Choice } from './state';

/** A right answer's points: 500 plus round(500 × time left ÷ time allowed); a wrong one 0 (*house*). */
export const points = (right: boolean, left: number, total: number): number =>
  right ? RIGHT_POINTS + Math.round((SPEED_POINTS * Math.min(total, Math.max(0, left))) / (total || 1)) : 0;

const categoryOf = (line: string) => parts(line).category.trim().toLowerCase();

/**
 * Up to `count` of `lines` in the order they will be asked: each time the next one whose category
 * differs from the one before, while another category still has one left; else the next one.
 */
function spread(lines: readonly string[], count: number, before?: string): string[] {
  const rest = [...lines];
  const out: string[] = [];
  let prev = before === undefined ? undefined : categoryOf(before);
  while (out.length < count && rest.length) {
    const i = Math.max(0, rest.findIndex((l) => categoryOf(l) !== prev));
    const [line] = rest.splice(i, 1);
    out.push(line);
    prev = categoryOf(line);
  }
  return out;
}

/**
 * A game's questions from `pool` (the picked packs' lines as they are now, shuffled): ones this
 * room has not asked yet; when fewer are left than the game needs, the room forgets what it asked
 * and carries on with the rest of the picks (*house*). None twice in one game, by key; as many as
 * the picks hold, up to `count`; the category changes from one to the next whenever it can.
 * Returns the asked keys still in the picks (none, after forgetting), so the list never outgrows them.
 */
export function deal(pool: readonly string[], asked: readonly string[], count: number): { questions: string[]; asked: string[] } {
  const byKey = new Map<string, string>();
  for (const q of pool) if (!byKey.has(triviaKey(q))) byKey.set(triviaKey(q), q);
  const before = asked.filter((k) => byKey.has(k));
  const fresh = spread([...byKey].filter(([k]) => !before.includes(k)).map(([, q]) => q), count);
  const forget = fresh.length < count;
  const rest = forget ? spread([...byKey].filter(([k]) => before.includes(k)).map(([, q]) => q), count - fresh.length, fresh.at(-1)) : [];
  return { questions: [...fresh, ...rest], asked: forget ? [] : before };
}

/** A line as the game asks it: its four answers shuffled once, and which of them is right. */
export function toAsk(line: string, rand: () => number = Math.random): Asked {
  const { category, question, right, wrong } = parts(line);
  const all = [right, ...wrong];
  const order = shuffle(CHOICES, rand);
  return { category, question, answers: order.map((i) => all[i]) as Asked['answers'], right: order.indexOf(0) as Choice };
}
