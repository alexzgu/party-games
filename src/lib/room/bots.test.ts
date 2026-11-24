import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HostLink, type HostHooks } from './host-link.svelte';
import { newKey } from './seats';
import { Bot, Bots, botName, slow, quick, type Brain, type Seat } from './bots';

// A tiny room with the usual join rules: a known id keeps its seat; a name already in use is
// refused while its owner is online, and takes over that seat when they are not; at most three seats.
function room(players = new Map<string, string>()) {
  const heard: [string, unknown][] = [];
  const hooks: HostHooks = {
    hello: (pid, name, online) => {
      if (players.has(pid)) return { pid, name: players.get(pid)!, fresh: false, then: () => {} };
      const same = [...players].find(([, n]) => n === name)?.[0];
      if (same) return online.has(same) ? { error: 'That name is already in use.' } : { pid: same, name, fresh: false, then: () => {} };
      if (players.size >= 3) return { error: 'This room is full.' };
      const then = () => {
        players.set(pid, name);
        link.send(pid, { t: 'view', v: { left: null, paused: false, n: players.size } });
      };
      return { pid, name, fresh: true, then };
    },
    message: (pid, raw) => heard.push([pid, raw]),
    left: (pid) => players.delete(pid),
    known: (pid) => players.has(pid),
    vacant: () => false,
    move: () => {},
  };
  const link = new HostLink('test', hooks);
  return { link, players, heard };
}

/** A phone's link as the host sees it: what the host wrote to it (a new seat's key is made at once, as a phone does). */
function phone(link: HostLink) {
  const handlers: Record<string, (x: unknown) => void> = {};
  const wrote: unknown[] = [];
  const conn = { open: true, on: (e: string, f: (x: unknown) => void) => { handlers[e] = f; }, send: (m: { t: string }) => { if (m.t === 'enrol') handlers.data({ t: 'key', key: newKey() }); else wrote.push(m); }, close: () => {} };
  (link as unknown as { accept(c: unknown): void }).accept(conn);
  return { say: (m: object) => handlers.data({ keys: 1, ...m }), wrote };
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('local seats', () => {
  it('join through the game, count as online and get the view a phone would', async () => {
    const { link } = room();
    const got: unknown[] = [];
    const res = link.seat('b1', 'Ada', { deliver: (m) => got.push(m) });
    expect(res).toEqual({ pid: 'b1' });
    expect(link.online.has('b1')).toBe(true);
    expect(link.pids()).toEqual(['b1']);
    await vi.advanceTimersByTimeAsync(0);
    expect(got).toEqual([{ t: 'welcome', pid: 'b1' }, { t: 'view', v: { left: null, paused: false, n: 1 } }]);
  });

  it('are refused by the same rules as a phone, and never take someone else\'s seat', () => {
    const { link } = room(new Map([['p1', 'Sam']]));
    expect(link.seat('b0', 'Sam', { deliver: () => {} })).toEqual({ error: 'That name is already in use. Pick another name.' });
    link.seat('b1', 'Ada', { deliver: () => {} });
    expect(link.seat('b2', 'Ada', { deliver: () => {} })).toEqual({ error: 'That name is already in use.' });
    link.seat('b3', 'Cog', { deliver: () => {} });
    expect(link.seat('b4', 'Dot', { deliver: () => {} })).toEqual({ error: 'This room is full.' });
    expect(link.pids()).toEqual(['b1', 'b3']);
  });

  it('send messages as JSON, read by the game like a phone; leave and removal drop them', async () => {
    const { link, heard, players } = room();
    const got: unknown[] = [];
    link.seat('b1', 'Ada', { deliver: (m) => got.push(m) });
    link.act('b1', { t: 'vote', side: 1, skip: undefined });
    link.act('nobody', { t: 'vote' });
    expect(heard).toEqual([['b1', { t: 'vote', side: 1 }]]);
    link.remove('b1', 'Out');
    expect(link.online.has('b1')).toBe(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(got.at(-1)).toEqual({ t: 'reject', why: 'Out' });
    link.seat('b2', 'Bix', { deliver: () => {} });
    link.act('b2', { t: 'leave' });
    expect(players.has('b2')).toBe(false);
    expect(link.pids()).toEqual([]);
  });

  it('turn away a phone that would take a bot\'s seat or wear the bot mark', () => {
    const { link, players } = room();
    link.seat('bot-1', '🤖 Ada', { deliver: () => {} });
    const a = phone(link);
    a.say({ t: 'hello', pid: 'bot-1', name: 'Sam' });
    expect(a.wrote).toEqual([{ t: 'reject', why: 'That name is already in use. Pick another name.' }]);
    const d = phone(link);
    d.say({ t: 'hello', pid: 'bot-9', name: 'Sam' });
    expect(d.wrote).toEqual([{ t: 'reject', why: 'That name is already in use. Pick another name.' }]);
    const b = phone(link);
    b.say({ t: 'hello', pid: 'p2', name: '🤖️ ' });
    expect(b.wrote).toEqual([{ t: 'reject', why: 'Pick a name without 🤖 (it marks bots).' }]);
    const c = phone(link);
    c.say({ t: 'hello', pid: 'p3', name: '🤖️ Ada' });
    expect(c.wrote[0]).toEqual({ t: 'welcome', pid: 'p3' });
    expect(players.get('p3')).toBe('Ada');
  });
});

// A brain that votes once, after its think time, on any view that asks for a vote.
type V = { left: number | null; paused: boolean; ask?: number };
const voter = (): Brain<V> => ({
  decide: ({ view, rand, left }) => view.ask === undefined ? null : { key: `vote:${view.ask}`, wait: quick(rand, left), act: () => [{ t: 'vote', at: view.ask }] },
});

describe('bots', () => {
  it('think before acting, never while paused, and act once per job', async () => {
    const sent: object[] = [];
    const bot = new Bot<V>('b1', 'Ada', voter(), (m) => sent.push(m), () => {});
    bot.deliver({ t: 'view', v: { left: 10000, paused: true, ask: 1 } });
    await vi.advanceTimersByTimeAsync(5000);
    expect(sent).toEqual([]);
    bot.deliver({ t: 'view', v: { left: 10000, paused: false, ask: 1 } });
    await vi.advanceTimersByTimeAsync(900);
    expect(sent).toEqual([]);
    await vi.advanceTimersByTimeAsync(3200);
    expect(sent).toEqual([{ t: 'vote', at: 1 }]);
    bot.deliver({ t: 'view', v: { left: 6000, paused: false, ask: 1 } });
    await vi.advanceTimersByTimeAsync(5000);
    expect(sent).toHaveLength(1);
    bot.stop();
  });

  it('pick, vote, write and draw within the time left, never instantly', () => {
    for (let i = 0; i < 200; i++) {
      const r = () => (i % 10) / 10;
      const left = 1200 + i * 500;
      for (const w of [slow(r, left), quick(r, left)]) {
        expect(w).toBeGreaterThanOrEqual(300);
        expect(w).toBeLessThan(left);
      }
    }
    expect(slow(() => 0.5, null)).toBeGreaterThanOrEqual(3000);
  });

  it('take new names in the room', () => {
    expect(botName([])).toBe('🤖 Ada');
    expect(botName(['🤖 ada', 'Sam'])).toBe('🤖 Bix');
  });

  it('are seated again from the game\'s own players when the room reopens; one refused leaves the game', () => {
    const a = room();
    const seats = (r: ReturnType<typeof room>): Seat[] => [...r.players].map(([pid, name]) => ({ pid, name }));
    const bots = new Bots<V>(a.link, voter, () => seats(a), () => {});
    expect(bots.add()).toBeNull();
    expect(bots.add()).toBeNull();
    expect([...a.players.values()]).toEqual(['🤖 Ada', '🤖 Bix']);

    // The host screen reloads: a new link, the saved game's players, a phone among them that wears
    // the robot (it joined before names lost it): its seat stays the phone's.
    const b = room(new Map([...a.players, ['p1', '🤖 Sam']]));
    const lost: string[] = [];
    const again = new Bots<V>(b.link, voter, () => [...seats(b), { pid: 'bot-gone', name: '🤖 Cog', out: true }, { pid: 'bot-x', name: '🤖 Dot' }], (pid) => lost.push(pid));
    again.open();
    expect(new Set(b.link.pids())).toEqual(new Set(a.players.keys()));
    // Removed bots stay out; a bot the room refuses (here: full) is taken out of the game.
    expect(lost).toEqual(['bot-x']);
    b.link.close();
    again.close();
  });
});
