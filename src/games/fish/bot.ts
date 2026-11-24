// Go Fish's bot brain (simple, *house*): on its turn, after a short random wait, it asks for a rank
// it holds. It remembers, from the events it is shown, who asked for or received each rank and
// has not given it away or laid it down since; it asks one of them for that rank when it can, else
// a random player with cards. It sees only its own phone's view.
import { pickOne, quick, type Brain } from '../../lib/room/bots';
import { rankOf, type Rank } from '../../lib/cards/deck';
import type { Event } from './state';
import type { View } from './view';

/** Who may still hold each rank, as far as the events show, and the last event folded in. */
type Memory = { seen: number; holders: Record<number, string[]> };

function remember(mem: Record<string, unknown>, log: readonly Event[]): Memory {
  const old = mem.fish as Memory | undefined;
  // A new deal numbers its events from 1 again.
  const m: Memory = old && (log.at(-1)?.n ?? 0) >= old.seen ? old : { seen: 0, holders: {} };
  const add = (rank: Rank, pid: string) => { m.holders[rank] = [...new Set([...(m.holders[rank] ?? []), pid])]; };
  const drop = (rank: Rank, pid?: string) => { m.holders[rank] = pid ? (m.holders[rank] ?? []).filter((p) => p !== pid) : []; };
  for (const e of log) {
    if (e.n <= m.seen) continue;
    m.seen = e.n;
    if (e.k === 'asked') {
      add(e.rank, e.by);
      if (e.got) drop(e.rank, e.from);
    } else if (e.k === 'drew' && e.rank) add(e.rank, e.by);
    else if (e.k === 'book') drop(e.rank);
    else if (e.k === 'gone') for (const r of Object.keys(m.holders)) drop(+r, e.by);
  }
  mem.fish = m;
  return m;
}

export const fishBrain = (): Brain<View> => ({
  decide({ view: v, me, left, rand, mem }) {
    const m = remember(mem, v.log);
    if (v.phase !== 'turn' || v.turn !== me || !v.hand?.length) return null;
    const targets = v.players.filter((p) => p.pid !== me && !p.out && !p.watching && p.cards > 0).map((p) => p.pid);
    if (!targets.length) return null;
    const ranks = [...new Set(v.hand.map(rankOf))];
    const known = ranks.flatMap((rank) => (m.holders[rank] ?? []).filter((p) => targets.includes(p)).map((to) => ({ rank, to })));
    const choice = known.length ? pickOne(known, rand) : { rank: pickOne(ranks, rand), to: pickOne(targets, rand) };
    return { key: `ask:${v.at}`, wait: quick(rand, left), act: () => [{ t: 'ask', at: v.at, to: choice.to, rank: choice.rank }] };
  },
});
