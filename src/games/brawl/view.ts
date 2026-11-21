import * as L from './logic';
export type View = {
  phase: L.Phase; at: number; round: number; left: number | null; total: number; paused: boolean;
  players: L.Player[]; title?: string; cards?: L.Pair<L.Fighter | null>; result?: L.Result; results?: L.Result[];
  draw?: { id: string; opponent: L.Fighter | null }; done?: boolean;
  vote?: boolean; options?: L.Fighter[]; picks?: L.Pair<L.Fighter | null>; progress?: string[];
  rematch?: boolean;
  /** Who draws in this phase (late joiners do not until the next round). */
  artists?: string[];
  /** In a bout this phone's player fights in: which card is theirs. */
  side?: L.Side;
};

export function view(g: L.Game, now: number, pid?: string): View {
  const b = L.current(g);
  const v: View = {
    phase: g.phase, at: g.at, round: g.round, left: L.left(g, now), paused: g.frozen !== null,
    total: 15000, players: g.phase === 'over' || g.phase === 'scores' ? L.standings(g) : L.active(g),
    rematch: g.rematch,
  };
  switch (g.phase) {
    case 'draw':
    case 'challenge': {
      v.total = g.settings.seconds * 1000;
      const t = pid ? L.task(g, pid) : null;
      if (t && !t.fighter) {
        if (t.title) v.title = t.title;
        v.draw = { id: t.id, opponent: t.opponent };
      }
      v.progress = b && g.bouts.filter((x) => x.fighters[g.phase === 'draw' ? 0 : 1])
        .map((x) => x.artists[g.phase === 'draw' ? 0 : 1]);
      v.artists = g.bouts.map((x) => x.artists[g.phase === 'draw' ? 0 : 1]);
      break;
    }
    case 'title':
      v.title = b.title;
      v.total = 3000;
      break;
    case 'vote':
      v.title = g.rematch ? b.surprise : b.title;
      v.cards = L.fighters(g);
      v.vote = !!pid && L.canVote(g, pid) && !Object.hasOwn(g.votes, pid);
      v.progress = Object.keys(g.votes);
      break;
    case 'tag':
      v.title = b.surprise;
      v.cards = b.fighters;
      v.done = !!pid && Object.hasOwn(g.tags, pid);
      if (pid && b.artists.includes(pid) && !v.done) v.options = L.tagOptions(g, pid);
      if (!pid || !v.options) v.picks = b.artists.map((artist, side) => Object.hasOwn(g.tags, artist)
        ? g.shown[artist]?.find((f) => f.id === g.tags[artist]) ?? b.fighters[side] : null) as L.Pair<L.Fighter | null>;
      v.progress = Object.keys(g.tags);
      break;
    case 'payout':
      v.total = 8000;
      v.result = g.results.at(-1);
      v.title = v.result?.title;
      v.cards = v.result?.fighters;
      break;
    case 'over': v.results = g.results; break;
  }
  const fights = v.cards && pid && b ? b.artists.indexOf(pid) : -1;
  if (fights >= 0) v.side = fights as L.Side;
  return v;
}

export function artIds(v: View): string[] {
  return [v.draw?.opponent, ...v.cards ?? [], ...v.options ?? [], ...v.picks ?? [],
    ...v.results?.flatMap((r) => r.winner === null ? [] : [r.fighters[r.winner]]) ?? []]
    .flatMap((f) => f ? [f.id] : []);
}
