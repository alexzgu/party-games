// A Bad Hand round: a prompt, everyone but the judge answers, the judge (or, when the judge is
// missing, the room) picks the funniest, its player scores, hands refill and the next seat judges.
import { picks } from './cards';
import { buildDeck, draw, nextPrompt, shuffle, type Rand } from './deck';
import {
  HOUSE, JUDGE_AWAY_MS, REVEAL_MS, VOTE_MS, active, deal, enter, isActive, isBlank, reconnecting,
  type Game, type Play, type Round,
} from './state';

export type Content = { prompts: string[]; answers: string[] };

/** The next judge after `pid` in seat order, skipping players who left or were removed. */
export function nextJudge(g: Game, pid: string | null): string {
  const seats = g.players.map((p) => p.pid);
  const from = pid === null ? -1 : seats.indexOf(pid);
  for (let k = 1; k <= seats.length; k++) {
    const next = seats[(from + k + seats.length) % seats.length];
    if (isActive(g, next)) return next;
  }
  return seats[0] ?? '';
}

export function start(g: Game, content: Content, now: number, rand: Rand = Math.random): Game {
  const { cards, deck } = buildDeck(content.answers, g.settings.blanks, rand);
  let next: Game = { ...g, cards, deck, discard: [], hands: {}, pool: content.prompts, prompts: shuffle(content.prompts, rand), round: null, house: 0, results: [], traded: {} };
  for (const p of active(next)) next = deal(next, p.pid, rand);
  const seats = active(next);
  const first = seats[Math.floor(rand() * seats.length)]?.pid ?? '';
  return newRound(next, first, now, rand);
}

function newRound(g: Game, judge: string, now: number, rand: Rand): Game {
  if (active(g).length < 2) return enter({ ...g, round: null }, 'over', now);
  const { prompt, queue } = nextPrompt(g.prompts, g.pool, rand);
  const round: Round = {
    n: (g.round?.n ?? 0) + 1, judge, prompt, plays: {}, order: [], spotlight: null, votes: {}, away: null, winner: null, voted: false,
    players: active(g).filter((p) => p.pid !== judge && g.hands[p.pid]?.length).map((p) => p.pid),
  };
  const s = g.settings.seconds;
  return enter({ ...g, prompts: queue, round }, 'answer', now, s ? s * 1000 : undefined);
}

/** Plays one card, or two in order on a two-blank prompt; a blank card carries what was typed. */
export function play(g: Game, pid: string, at: number, cards: number[], texts: string[]): Game {
  const r = g.round;
  const hand = g.hands[pid] ?? [];
  if (g.phase !== 'answer' || g.at !== at || !r || !r.players.includes(pid) || r.plays[pid]) return g;
  if (cards.length !== picks(r.prompt) || new Set(cards).size !== cards.length || !cards.every((c) => hand.includes(c))) return g;
  const said = cards.map((c, i) => isBlank(g, c) ? (texts[i] ?? '').trim() : g.cards[c]);
  if (said.some((t) => !t || t.length > 60)) return g;
  return {
    ...g, hands: { ...g.hands, [pid]: hand.filter((c) => !cards.includes(c)) },
    round: { ...r, plays: { ...r.plays, [pid]: { cards, texts: said } } },
  };
}

/** The house's answer: random cards off the deck (never a blank one). */
function houseAnswer(g: Game, n: number, rand: Rand): Game {
  let pile = { deck: g.deck, discard: g.discard };
  const cards: number[] = [];
  for (let tries = 0; cards.length < n && tries < g.cards.length; tries++) {
    const got = draw(pile, 1, rand);
    pile = got.pile;
    if (!got.cards.length) break;
    if (isBlank(g, got.cards[0])) pile = { ...pile, discard: [...pile.discard, got.cards[0]] };
    else cards.push(got.cards[0]);
  }
  if (cards.length < n) return { ...g, ...pile, discard: [...pile.discard, ...cards] };
  const play: Play = { cards, texts: cards.map((c) => g.cards[c]) };
  return { ...g, ...pile, round: { ...g.round!, plays: { ...g.round!.plays, [HOUSE]: play } } };
}

/** Answering is over: no answers sets the prompt aside, one wins outright, a missing judge hands it to a vote. */
function toJudge(g: Game, now: number, online: ReadonlySet<string>, rand: Rand): Game {
  const r = g.round!;
  const authors = Object.keys(r.plays);
  if (!authors.length) return newRound(g, nextJudge(g, r.judge), now, rand);
  let next = g.settings.house ? houseAnswer(g, picks(r.prompt), rand) : g;
  const order = shuffle(Object.keys(next.round!.plays), rand);
  next = { ...next, round: { ...next.round!, order } };
  if (order.length === 1) return settle(next, 0, now);
  if (!isActive(g, r.judge) || (!online.has(r.judge) && !reconnecting(g, now))) return toVote(next, now);
  return enter(next, 'judge', now);
}

const toVote = (g: Game, now: number): Game => enter({ ...g, round: { ...g.round!, voted: true, spotlight: null } }, 'vote', now, VOTE_MS);

export function spot(g: Game, pid: string, at: number, i: number): Game {
  const r = g.round;
  if (g.phase !== 'judge' || g.at !== at || r?.judge !== pid || !(i >= 0 && i < r.order.length) || r.spotlight === i) return g;
  return { ...g, round: { ...r, spotlight: i } };
}

export function pick(g: Game, pid: string, at: number, i: number, now: number): Game {
  const r = g.round;
  if (g.phase !== 'judge' || g.at !== at || r?.judge !== pid || !(i >= 0 && i < r.order.length)) return g;
  return settle(g, i, now);
}

/** Who votes when the judge is missing: everyone still in who played. */
export const voters = (g: Game) => (g.round?.order ?? []).filter((pid) => pid !== HOUSE && isActive(g, pid));

export function vote(g: Game, pid: string, at: number, i: number): Game {
  const r = g.round;
  if (g.phase !== 'vote' || g.at !== at || !r || !voters(g).includes(pid) || Object.hasOwn(r.votes, pid)) return g;
  if (!(i >= 0 && i < r.order.length) || r.order[i] === pid) return g;
  return { ...g, round: { ...r, votes: { ...r.votes, [pid]: i } } };
}

/** Most votes wins; a tie (no votes at all included) is drawn at random. */
export function counted(r: Round, rand: Rand): number {
  const tally = r.order.map((_, i) => Object.values(r.votes).filter((v) => v === i).length);
  const top = Math.max(...tally);
  const best = tally.flatMap((n, i) => n === top ? [i] : []);
  return best[Math.floor(rand() * best.length)];
}

function settle(g: Game, winner: number, now: number): Game {
  const r = g.round!;
  const by = r.order[winner];
  const players = g.players.map((p) => p.pid === by ? { ...p, score: p.score + 1 } : p);
  const win = { prompt: r.prompt, texts: r.plays[by].texts, by };
  return enter({ ...g, players, house: g.house + (by === HOUSE ? 1 : 0), results: [...g.results, win], round: { ...r, winner, spotlight: winner } },
    'reveal', now, REVEAL_MS);
}

/** Someone still in the game (or the house) has reached the target. */
export const finished = (g: Game) => g.house >= g.settings.target || active(g).some((p) => p.score >= g.settings.target);

/** After the reveal: played cards to the discard pile, hands back to ten, the next seat judges. */
function nextRound(g: Game, now: number, rand: Rand): Game {
  const r = g.round!;
  const played = Object.values(r.plays).flatMap((p) => p.cards);
  let next: Game = { ...g, discard: [...g.discard, ...played] };
  if (finished(next)) return enter(next, 'over', now);
  for (const p of active(next)) next = deal(next, p.pid, rand);
  return newRound(next, nextJudge(next, r.judge), now, rand);
}

/** Trade a point is on, it is not judging or voting, the player has a point, and nobody has just won. */
export function canTrade(g: Game, pid: string): boolean {
  const me = g.players.find((p) => p.pid === pid);
  return g.settings.trade && (g.phase === 'answer' || g.phase === 'reveal') && !!me && me.score >= 1 && isActive(g, pid) && !finished(g);
}

/** Trade a point (option): give up a point to swap any of your cards, outside judging. */
export function trade(g: Game, pid: string, n: number, cards: number[], rand: Rand): Game {
  const hand = g.hands[pid] ?? [];
  if (!canTrade(g, pid)) return g;
  if ((g.traded[pid] ?? 0) !== n || !cards.length || new Set(cards).size !== cards.length || !cards.every((c) => hand.includes(c))) return g;
  const got = draw({ deck: g.deck, discard: g.discard }, cards.length, rand);
  const fresh = [...got.cards];
  return {
    ...g, deck: got.pile.deck, discard: [...got.pile.discard, ...cards],
    hands: { ...g.hands, [pid]: hand.map((c) => cards.includes(c) ? fresh.shift() : c).filter((c): c is number => c !== undefined) },
    players: g.players.map((p) => p.pid === pid ? { ...p, score: p.score - 1 } : p),
    traded: { ...g.traded, [pid]: n + 1 },
  };
}

/** The host's skip: end answering, let the room vote, end voting, or next round. */
export function step(g: Game, now: number, online: ReadonlySet<string>, rand: Rand = Math.random): Game {
  switch (g.phase) {
    case 'answer': return toJudge(g, now, online, rand);
    case 'judge': return toVote(g, now);
    case 'vote': return settle(g, counted(g.round!, rand), now);
    case 'reveal': return nextRound(g, now, rand);
    default: return g;
  }
}

const here = (g: Game, online: ReadonlySet<string>, pids: string[]) => pids.filter((pid) => online.has(pid) && isActive(g, pid));

/** Moves the game on by itself: timers, everyone done, a judge gone too long. */
export function tick(g: Game, now: number, online: ReadonlySet<string>, rand: Rand = Math.random): Game {
  const r = g.round;
  if (g.paused !== null || !r) return g;
  if (g.deadline !== null && g.deadline <= now) return step(g, now, online, rand);
  // Phones still finding the room after a host reload: nobody is missing yet.
  if (reconnecting(g, now)) return g;
  if (g.phase === 'answer') {
    const present = here(g, online, r.players);
    return present.length && present.every((pid) => r.plays[pid]) ? step(g, now, online, rand) : g;
  }
  if (g.phase === 'vote') {
    const present = here(g, online, voters(g));
    return present.length && present.every((pid) => Object.hasOwn(r.votes, pid)) ? step(g, now, online, rand) : g;
  }
  if (g.phase !== 'judge') return g;
  if (!isActive(g, r.judge)) return toVote(g, now);
  if (online.has(r.judge)) return r.away === null ? g : { ...g, round: { ...r, away: null } };
  if (r.away === null) return { ...g, round: { ...r, away: now } };
  return now - r.away >= JUDGE_AWAY_MS ? toVote(g, now) : g;
}
