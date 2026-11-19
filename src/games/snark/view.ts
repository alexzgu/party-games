// What each phone is sent: only what that player needs, never who wrote which answer before
// the reveal. Phones render this and nothing else, so a reconnecting phone is up to date at once.
import { NO_ANSWER, authorsOf, currentItem, isFinalRound, player, present, promptCount, tasksFor, timeLeft, timerLength, votableFinal, votersFor, type Game } from './logic';
import { leaders, place } from './record';

export type Screen =
  | { k: 'lobby'; players: number }
  /** Joined mid-round: plays from the next round. */
  | { k: 'late' }
  /** Prompts still to answer; empty when this player is done. */
  | { k: 'write'; tasks: { i: number; prompt: string }[]; total: number }
  | { k: 'vote'; at: number; prompt: string; choices: { id: 'a' | 'b'; text: string }[]; own: boolean; voted: 'a' | 'b' | null }
  | { k: 'vote3'; at: number; prompt: string; choices: { id: number; text: string }[]; own: boolean; sent: boolean }
  | { k: 'reveal'; gain: number | null }
  | { k: 'scores'; place: number }
  | { k: 'over'; place: number; winners: string[] }
  | { k: 'kicked' };

export interface PlayerView {
  code: string;
  round: number;
  rounds: number;
  final: boolean;
  me: { name: string; color: number; score: number };
  screen: Screen;
  /** Time left on the timer when the view was sent (ms); null when untimed. */
  left: number | null;
  /** The timer's full length (ms). */
  span: number;
  paused: boolean;
}

export function playerView(g: Game, pid: string, now: number): PlayerView | null {
  const p = player(g, pid);
  if (!p) return null;
  return {
    code: g.code,
    round: g.round,
    rounds: g.settings.rounds,
    final: g.round > 0 && isFinalRound(g),
    me: { name: p.name, color: p.color, score: p.score },
    screen: p.kicked ? { k: 'kicked' } : screenFor(g, pid),
    left: timeLeft(g, now),
    span: timerLength(g),
    paused: g.paused !== null,
  };
}

function screenFor(g: Game, pid: string): Screen {
  const me = player(g, pid)!;
  const item = currentItem(g);
  switch (g.phase) {
    case 'lobby': return { k: 'lobby', players: present(g).length };
    case 'write':
      if (!me.active) return { k: 'late' };
      return { k: 'write', tasks: tasksFor(g, pid).map((i) => ({ i, prompt: g.items[i].prompt })), total: promptCount(g, pid) };
    case 'vote':
      if (!item) return { k: 'late' };
      if (item.kind === 'duel') {
        const voted = item.ballots[pid];
        return {
          k: 'vote',
          at: g.at,
          prompt: item.prompt,
          choices: (['a', 'b'] as const).map((id) => ({ id, text: item.answers[item[id]] ?? NO_ANSWER })),
          own: !votersFor(g, item).includes(pid),
          voted: voted === undefined ? null : voted === item.a ? 'a' : 'b',
        };
      }
      return {
        k: 'vote3',
        at: g.at,
        prompt: item.prompt,
        choices: votableFinal(item, pid).map((a) => ({ id: item.authors.indexOf(a), text: item.answers[a]! })),
        own: authorsOf(item).includes(pid),
        sent: pid in item.ballots,
      };
    case 'reveal': return { k: 'reveal', gain: item?.result && pid in item.result.points ? item.result.points[pid] : null };
    case 'scores': return { k: 'scores', place: place(g, me.score) };
    case 'over': return { k: 'over', place: place(g, me.score), winners: leaders(g).map((x) => x.name) };
  }
}

