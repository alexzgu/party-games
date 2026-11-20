// Fixed states for screenshots and design review: #/snark/host?demo=<screen> and
// #/snark/join?demo=<screen>. No network, nothing saved.
import * as L from './logic';
import { playerView, type PlayerView } from './view';
import type { Link } from './player.svelte';

const NAMES = ['Maya', 'Jordan', 'Priya', 'Sam', 'Theo', 'Alex'];
const PROMPTS = [
  'A terrible name for a dentist\'s office',
  'What your houseplant says about you behind your back',
  'A rejected flavor of potato chip',
  'The worst thing to find in your burrito',
  'A new rule for the group chat',
  'What the check engine light actually means',
];
const ANSWERS = [
  'Tooth Hurty Associates', 'Open Wide & Regret', 'It thinks you talk to it too much', 'Overwatered and underappreciated',
  'Wet Sock', 'Grandma\'s Purse', 'A second, smaller burrito', 'Your ex\'s phone number',
  'No voice notes over 4 minutes', 'Every typo must be defended', 'Car is just tired', 'It means $1,800',
];
const NOW = 1_000_000;
const draw: L.Draw = (n) => PROMPTS.slice(0, n);
const seq = (seed: number) => () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);

function lobby(n = 5): L.Game {
  let g = L.newGame('KPXT', { rounds: 3, answerSecs: 75, voteSecs: 15, packIds: ['classic'] });
  NAMES.slice(0, n).forEach((name, i) => (g = L.join(g, `d${i}`, name, new Set()).game));
  return g;
}

function answered(g: L.Game, all = true): L.Game {
  let k = 0;
  for (const p of L.present(g)) {
    for (const i of L.tasksFor(g, p.pid)) {
      if (all || k % 3 !== 0) g = L.answer(g, p.pid, i, ANSWERS[k % ANSWERS.length]);
      k++;
    }
  }
  return g;
}

function votingDuel(): L.Game {
  return L.step(answered(L.startRound(lobby(), draw, NOW - 80000, seq(3))), NOW - 4000, draw);
}

function castAll(g: L.Game): L.Game {
  const item = g.items[g.at];
  L.votersFor(g, item).forEach((pid, k) => {
    if (item.kind === 'duel') g = L.vote(g, pid, k % 3 === 2 ? 'b' : 'a');
    else g = L.voteFinal(g, pid, { [item.authors.indexOf(L.votableFinal(item, pid)[k % 2])]: 2, [item.authors.indexOf(L.votableFinal(item, pid)[2] ?? L.votableFinal(item, pid)[0])]: 1 });
  });
  return g;
}

function finalVote(): L.Game {
  let g = { ...lobby(), round: 2 };
  g.players = g.players.map((p, i) => ({ ...p, score: [3250, 2400, 4100, 1500, 2900][i] }));
  g = L.startRound(g, () => ['The secret ingredient in hospital food'], NOW - 90000, seq(5));
  return L.step(answered(g), NOW - 9000, draw);
}

function scored(g: L.Game): L.Game {
  return { ...g, players: g.players.map((p, i) => ({ ...p, score: [3250, 2400, 4100, 1500, 2900, 800][i] })) };
}

/** The host screen's state for a demo, or null for an unknown name. */
export function demoHost(screen: string): { game: L.Game; online: ReadonlySet<string>; now: number } | null {
  const everyone = new Set(NAMES.map((_, i) => `d${i}`));
  const away = new Set([...everyone].filter((p) => p !== 'd3'));
  let g: L.Game;
  switch (screen) {
    case 'lobby': g = lobby(4); return { game: g, online: away, now: NOW };
    case 'lobby-empty': g = lobby(0); return { game: g, online: everyone, now: NOW };
    case 'write': {
      g = L.startRound(lobby(), draw, NOW - 31000, seq(3));
      let k = 0;
      for (const p of L.present(g)) for (const i of L.tasksFor(g, p.pid)) if (k++ % 3 !== 1) g = L.answer(g, p.pid, i, 'x');
      g = L.join(g, 'd5', 'Alex', new Set()).game;
      return { game: g, online: away, now: NOW };
    }
    case 'vote': {
      g = votingDuel();
      const voter = L.votersFor(g, g.items[0])[0];
      return { game: L.vote(g, voter, 'a'), online: everyone, now: NOW };
    }
    case 'reveal': g = L.step(castAll(votingDuel()), NOW - 2000, draw); return { game: g, online: everyone, now: NOW };
    case 'vote3': {
      g = finalVote();
      const item = g.items[0] as L.Finale;
      for (const pid of L.votersFor(g, item).slice(0, 2)) g = L.voteFinal(g, pid, { [item.authors.indexOf(L.votableFinal(item, pid)[0])]: 3 });
      return { game: g, online: everyone, now: NOW };
    }
    case 'reveal3': g = L.step(castAll(finalVote()), NOW - 2000, draw); return { game: g, online: everyone, now: NOW };
    case 'scores': {
      g = scored(L.step(castAll(votingDuel()), NOW - 2000, draw));
      while (g.phase !== 'scores') g = L.step(g, NOW - 3000, draw);
      return { game: g, online: everyone, now: NOW };
    }
    case 'over': g = L.finish(scored(lobby())); return { game: { ...g, round: 3 }, online: everyone, now: NOW };
    case 'paused': g = L.pause(L.startRound(lobby(), draw, NOW - 31000, seq(3)), NOW); return { game: g, online: everyone, now: NOW };
    default: return null;
  }
}

/** A phone's view for a demo; 'join' shows the join form. */
export function demoPhone(screen: string): { view: PlayerView | null; link: Link } {
  const as = (g: L.Game, pid = 'd0') => ({ view: playerView(g, pid, NOW), link: 'live' as Link });
  switch (screen) {
    case 'join': return { view: null, link: 'idle' };
    case 'lobby': return as(lobby());
    case 'write': return as(L.startRound(lobby(), draw, NOW - 20000, seq(3)));
    case 'wait': return as(answered(L.startRound(lobby(), draw, NOW - 20000, seq(3))));
    case 'vote': {
      const g = votingDuel();
      return as(g, L.votersFor(g, g.items[0])[0]);
    }
    case 'voted': {
      const g = votingDuel();
      const pid = L.votersFor(g, g.items[0])[0];
      return as(L.vote(g, pid, 'b'), pid);
    }
    case 'vote-own': {
      const g = votingDuel();
      return as(g, (g.items[0] as L.Duel).a);
    }
    case 'vote3': return as(finalVote());
    case 'voted3': {
      const g = finalVote();
      const item = g.items[0] as L.Finale;
      return as(L.voteFinal(g, 'd0', { [item.authors.indexOf(L.votableFinal(item, 'd0')[0])]: 2, [item.authors.indexOf(L.votableFinal(item, 'd0')[1])]: 1 }));
    }
    case 'reveal3': return as(L.step(castAll(finalVote()), NOW - 2000, draw), 'd1');
    case 'late': {
      let g = L.startRound(lobby(), draw, NOW - 20000, seq(3));
      g = L.join(g, 'd5', 'Alex', new Set()).game;
      for (const i of L.tasksFor(g, 'd2')) g = L.answer(g, 'd2', i, 'x');
      return as(g, 'd5');
    }
    case 'reveal': {
      const g = L.step(castAll(votingDuel()), NOW - 2000, draw);
      return as(g, (g.items[0] as L.Duel).a);
    }
    case 'scores': {
      let g = scored(L.step(castAll(votingDuel()), NOW - 2000, draw));
      while (g.phase !== 'scores') g = L.step(g, NOW - 3000, draw);
      return as(g, 'd1');
    }
    case 'over': return as({ ...L.finish(scored(lobby())), round: 3 }, 'd1');
    default: return { view: null, link: 'idle' };
  }
}
