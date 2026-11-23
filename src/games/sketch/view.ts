// What the host screen (no pid) and each phone see. A phone sees only what is handed to it:
// never a chain's start before the album, never the word while it still has to guess it.
import { active, nameOf, present, standings, left, type Feed, type Game, type Mode, type Phase, type Player } from './core';
import { albumEnd, task, inStep, type StepKind } from './telephone';
import { canGuess, guessers } from './guess';
import { shape } from './hint';

export type AlbumItem = { kind: 'text'; text: string; by: string; filled?: boolean } | { kind: 'drawing'; id: string | null; by: string };
export type View = {
  mode: Mode; phase: Phase; at: number; left: number | null; total: number; paused: boolean;
  players: Player[]; packs: string[];
  /** Telephone: the step (from 0) of how many, who plays and who is done. */
  step?: number; steps?: number; order?: string[]; done?: string[];
  /** Telephone: players still to finish this step who are here (online, in the room). */
  waiting?: number;
  /** Telephone: this phone's job this step; `line` or `art` (null: left blank) is what it was handed. */
  task?: { id: string; kind: StepKind; line?: string; art?: string | null };
  /** Telephone: this phone already sent this step's entry. */
  sent?: boolean;
  album?: { chain: number; chains: number; entry: number; starter: string; items: AlbumItem[]; next?: string; end: boolean };
  /** Draw & guess. */
  round?: number; rounds?: number; drawer?: string; offer?: string[]; word?: string; shape?: string;
  /** The id of the drawing being drawn (or just drawn, at the reveal). */
  ink?: string; feed?: Feed[]; got?: string[]; close?: string; points?: { pid: string; points: number }[];
  /** This phone may guess now. */
  guessing?: boolean;
  /** Draw & guess: how many count as guessers this turn (all who got it, and the rest of the room online). */
  guessers?: number;
};

export const inkId = (g: Game) => `${g.id}/${g.dg!.round}/${g.dg!.turn}`;

function telephone(g: Game, v: View, here: Set<string>, pid?: string) {
  const t = g.tel!;
  v.steps = t.order.length;
  v.order = t.order;
  if (inStep(g)) {
    v.step = t.step;
    v.done = t.order.filter((p) => task(g, p)!.done);
    v.waiting = t.order.filter((p) => here.has(p) && !v.done!.includes(p)).length;
    const mine = pid ? task(g, pid) : null;
    if (mine) {
      v.sent = mine.done;
      const h = mine.handed;
      v.task = { id: mine.id, kind: mine.kind, ...h?.kind === 'text' ? { line: h.text } : h ? { art: h.id } : {} };
    }
  }
  if (g.phase === 'album') {
    const { chain, entry } = t.page;
    const items = t.chains[chain].slice(0, entry + 1).map((e): AlbumItem => e ? { ...e, by: nameOf(g, e.by) } : { kind: 'drawing', id: null, by: '' });
    const after = t.chains[chain][entry + 1] ?? t.chains[chain + 1]?.[0];
    v.album = { chain, entry, chains: t.order.length, starter: nameOf(g, t.order[chain]), items, end: albumEnd(t),
      next: after?.kind === 'drawing' && after.id ? after.id : undefined };
  }
}

function guessing(g: Game, v: View, online: ReadonlySet<string>, pid?: string) {
  const dg = g.dg!;
  v.round = dg.round;
  v.rounds = g.settings.rounds;
  v.drawer = dg.drawer;
  if (g.phase === 'pick' && pid === dg.drawer) v.offer = dg.offer;
  if (g.phase === 'guess' || g.phase === 'reveal') {
    v.ink = inkId(g);
    v.feed = dg.feed;
    v.got = dg.got.map((x) => x.pid);
    const knows = g.phase === 'reveal' || (!!pid && (pid === dg.drawer || v.got.includes(pid)));
    if (knows) v.word = dg.word;
    else v.shape = shape(dg.word, dg.hints.slice(0, dg.shown));
    if (pid && dg.close[pid]) v.close = dg.close[pid];
    v.guessing = !!pid && canGuess(g, pid);
    v.guessers = guessers(g, online).length;
  }
  if (g.phase === 'reveal') v.points = dg.points;
}

/** `online`: the phones online now (by default everyone, as in tests). */
export function view(g: Game, now: number, pid?: string, online?: ReadonlySet<string>): View {
  const on = online ?? new Set(g.players.map((p) => p.pid));
  const here = new Set(present(g, on).map((p) => p.pid));
  const v: View = {
    mode: g.settings.mode, phase: g.phase, at: g.at, left: left(g, now), total: g.total, paused: g.frozen !== null,
    players: g.phase === 'scores' || g.phase === 'over' ? standings(g).filter((p) => !g.kicked.includes(p.pid) || p.score > 0) : active(g),
    packs: g.settings.packs,
  };
  if (g.tel) telephone(g, v, here, pid);
  if (g.dg) guessing(g, v, on, pid);
  return v;
}

/** The drawings a view shows (or will show next), for a phone to ask for. */
export function artIds(v: View): string[] {
  const ids = [v.task?.art, v.album?.next, v.ink, ...v.album?.items.map((x) => x.kind === 'drawing' ? x.id : null) ?? []];
  return ids.filter((x): x is string => !!x);
}
