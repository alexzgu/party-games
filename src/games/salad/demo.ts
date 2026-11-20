// Demonstrate both sides by running the same room logic with fixed players and a fixed clock.
import { saladPacks } from '../../lib/content';
import type { Link } from '../../lib/room/phone-link.svelte';
import * as L from './logic';
import type { Action } from './protocol';
import { playerView, type PlayerView } from './view';

const START = 10_000;
const PLAYERS = ['Maya', 'Drew', 'Sam', 'Jules'];
const ONLINE = new Set(PLAYERS.map((_, i) => `p${i}`));

function lobby(empty: boolean): L.Game {
  const classic = saladPacks().find((pack) => pack.id === 'classic');
  const room = L.newGame('BCDF', ['classic'], classic?.secrets ?? [], 23);
  return empty ? room : PLAYERS.reduce((g, name, i) => L.join(g, `p${i}`, name, ONLINE).game, room);
}

function action(g: L.Game, pid: string, msg: Action, now: number): L.Game {
  return L.fromPhone(g, pid, { ...msg, serial: g.serial }, now);
}

function withGuesses(g: L.Game, now: number): L.Game {
  return ['A talking toaster', 'The aquarium', 'A pet frog'].reduce((game, text, i) =>
    action(game, `p${i + 1}`, { t: 'guess', id: `preview-${i}`, text }, now), g);
}

function inComparison(g: L.Game, now: number): L.Game {
  let next = g;
  for (let i = 0; i < 16; i++) {
    const draft = playerView(next, 'p0', now).draft;
    if (!draft || draft.frame.slots.includes('guess')) break;
    next = action(next, 'p0', { t: 'skipFrame', frame: draft.index }, now);
  }
  return next;
}

function duringTurn(g: L.Game, now: number): L.Game {
  const compared = inComparison(withGuesses(g, now), now);
  const draft = playerView(compared, 'p0', now).draft;
  if (draft?.frame.slots.length !== 1 || draft.frame.slots[0] !== 'guess') return compared;
  const chosen = action(compared, 'p0', { t: 'word', frame: draft.index, slot: 0, value: '0' }, now);
  return action(chosen, 'p0', { t: 'publish', frame: draft.index }, now);
}

function playedRound(g: L.Game, now: number): L.Game {
  let next = g;
  for (const [i] of PLAYERS.entries()) {
    const secret = L.currentTurn(next)?.secret;
    if (i % 2 === 0 && secret) next = action(next, `p${i + 1}`, { t: 'guess', id: 'preview-solve', text: secret.answer }, now);
    if (next.phase === 'present') next = L.step(next, now, ONLINE, false);
    if (next.phase === 'reveal') next = L.step(next, now, ONLINE);
  }
  return next;
}

export function demoHost(screen: string): { game: L.Game; online: ReadonlySet<string>; now: number } {
  const room = lobby(screen === 'lobby-empty');
  if (screen === 'lobby' || screen === 'lobby-empty') return { game: room, online: ONLINE, now: START };
  const pick = L.startRound(room, START);
  if (screen === 'pick' || screen === 'wait') {
    const game = action(pick, screen === 'wait' ? 'p0' : 'p1', { t: 'pick', index: 1, reshuffled: false }, START + 3000);
    return { game, online: ONLINE, now: START + 7000 };
  }
  if (screen === 'late') return { game: L.join(pick, 'late', 'Riley', ONLINE).game, online: ONLINE, now: START + 7000 };

  const prepare = L.step(pick, START + 10_000, ONLINE);
  if (screen === 'prepare') return { game: prepare, online: ONLINE, now: START + 16_000 };
  const present = L.step(prepare, START + 20_000, ONLINE);
  const now = START + 35_000;
  const play = duringTurn(present, now);

  let game = play;
  switch (screen) {
    case 'comparison': game = inComparison(withGuesses(present, now), now); break;
    case 'paused': game = L.pause(play, now); break;
    case 'unsolved': game = L.step(play, now, ONLINE, false); break;
    case 'reveal': {
      const secret = L.currentTurn(play)?.secret;
      if (secret) game = action(play, 'p2', { t: 'guess', id: 'preview-solve', text: secret.answer }, now);
      break;
    }
    case 'scores': game = playedRound(play, now); break;
    case 'over': {
      const scores = playedRound(play, now);
      const next = L.step(scores, now, ONLINE);
      const nextTurn = L.step(L.step(next, now, ONLINE), now, ONLINE);
      game = L.step(playedRound(nextTurn, now), now, ONLINE);
      break;
    }
    case 'present':
    case 'guess': break;
    default: game = room;
  }
  return { game, online: ONLINE, now };
}

export function demoPhone(screen: string): { view: PlayerView | null; link: Link } {
  if (screen === 'join') return { view: null, link: 'idle' };
  const { game, now } = demoHost(screen);
  const pid = screen === 'late' ? 'late' : screen === 'guess' || screen === 'paused' ? 'p2' : 'p0';
  return { view: playerView(game, pid, now), link: 'live' };
}
