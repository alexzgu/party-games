import { choicesFor, currentTurn, timeLeft, timerLength, type Game } from './logic';
import type { Secret } from './words';

const label = ({ answer, category, level }: Secret) => ({ answer, category, level });

/** Keep other players' offers, drafts and answers on the host. */
export function playerView(g: Game, pid: string, now: number) {
  const active = new Set(g.players.filter((p) => !p.kicked).map((p) => p.pid));
  const turn = active.has(pid) ? g.turns.find((t) => t.pid === pid) : undefined;
  const current = currentTurn(g);
  const onStage = (g.phase === 'present' || g.phase === 'reveal') && current;
  const composing = g.phase === 'prepare' || (g.phase === 'present' && current === turn);
  const draft = composing && turn?.draft
    ? { ...turn.draft, choices: choicesFor(g, turn.draft) } : null;
  return {
    code: g.code, phase: g.phase, round: g.round, at: g.at, you: pid, serial: g.serial,
    players: g.players, presenter: onStage ? current.pid : undefined,
    deadline: g.deadline, left: timeLeft(g, now), span: timerLength(g), paused: g.paused !== null,
    solved: g.solved, total: g.total,
    progress: g.turns.filter((t) => active.has(t.pid) && (g.phase === 'pick' ? t.secret : t.first)).map((t) => t.pid),
    sentences: g.sentences, guesses: g.guesses.map(({ id, pid, text }) => ({ id, pid, text })),
    acknowledged: g.guesses.filter((guess) => guess.pid === pid).map((guess) => guess.request),
    result: g.phase === 'reveal' ? g.result : null,
    offers: g.phase === 'pick' ? turn?.offers.map(label) ?? [] : [],
    reshuffled: turn?.reshuffled ?? false,
    secret: turn?.secret && (composing || g.phase === 'pick') ? label(turn.secret) : null,
    draft,
    ready: !!(g.phase === 'pick' ? turn?.secret : turn?.first),
  };
}

export type PlayerView = ReturnType<typeof playerView>;
