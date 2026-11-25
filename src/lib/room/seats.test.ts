import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ASK_HOST, KeyRing, OLD_PAGE, OPEN_MS, SIGNS, drawSign, ends, newKey, nextStep, proofOf, signAt, type Claim, type Step } from './seats';
import { LINK_TIMEOUT } from './net';
import type { HostLink } from './host-link.svelte';
import type { PhoneLink, BaseView } from './phone-link.svelte';

// A broker in memory: a host's peer under its id, and phones' peers that connect to it.
type Handlers = Record<string, (x?: unknown) => void>;
const net = vi.hoisted(() => ({ hosts: new Map<string, (conn: unknown) => void>() }));
vi.mock('./net', async (original) => ({
  ...(await original<typeof import('./net')>()),
  makePeer: (id: string | null) => {
    const on: Handlers = {};
    const peer = {
      on_: on, open: true, destroyed: false, disconnected: false, destroy: () => { peer.destroyed = true; }, reconnect: () => {},
      on: (e: string, f: Handlers[string]) => {
        on[e] = f;
        if (id && e === 'connection') net.hosts.set(id, f);
        if (!id && e === 'open') queueMicrotask(() => f());
      },
      connect: (to: string) => {
        const [near, far] = [end(), end()];
        near.other = far;
        far.other = near;
        net.hosts.get(to)!(far);
        queueMicrotask(() => near.on_.open?.());
        return near;
      },
    };
    return peer;
  },
}));

// Web Locks as a browser keeps them: one holder per name, until it lets go or its tab is gone.
const locks = vi.hoisted(() => ({ held: new Set<string>() }));
const fakeLocks = {
  request: async (name: string, _opts: unknown, grant: (lock: object | null) => unknown) => {
    if (locks.held.has(name)) return grant(null);
    locks.held.add(name);
    await grant({ name });
    locks.held.delete(name);
  },
};

interface End { open: boolean; peerConnection?: Sdp; on_: Handlers; other?: End; on(e: string, f: Handlers[string]): void; send(m: unknown): void; close(): void }
interface Sdp { currentLocalDescription: { sdp: string }; currentRemoteDescription: { sdp: string } }
const sdp = (...prints: string[]) => ({ sdp: ['v=0', ...prints.map((p) => `a=fingerprint:sha-256 ${p}`), ''].join('\r\n') });
/** One end of a connection: what one side sends, the other hears; either can close both. */
function end(): End {
  const me: End = {
    open: true, on_: {},
    on: (e, f) => { me.on_[e] = f; },
    send: (m) => { if (me.other?.open) me.other.on_.data?.(JSON.parse(JSON.stringify(m))); },
    close: () => {
      if (!me.open) return;
      me.open = false;
      me.on_.close?.();
      me.other?.close();
    },
  };
  return me;
}

const realTimeout = setTimeout;
/** Waits for what happens off this thread (HMACs); no pretend time passes. */
const until = (what: () => boolean, tries = 200): Promise<void> =>
  new Promise((done) => { realTimeout(() => { done(what() || !tries ? undefined : until(what, tries - 1)); }, 5); });
/** Until the phone's proof has been answered. */
const settle = (p: Phone) => until(() => (p.got.length > 0 && p.types().at(-1) !== 'prove') || !p.conn.open);

interface Phone { got: { t: string; [k: string]: unknown }[]; conn: End; key?: string; say(m: object): void; types(): string[] }
/** A phone's page: says hello and answers the handshake as the app does (`modern`), with the key it has. */
function phone(link: HostLink, pid: string, name: string, key?: string, modern = true, opts: { near?: Sdp; far?: Sdp; mute?: boolean } = {}): Phone {
  const [near, far] = [end(), end()];
  near.other = far;
  far.other = near;
  near.peerConnection = opts.near;
  far.peerConnection = opts.far;
  const p: Phone = { got: [], conn: near, key, say: (m) => near.send(m), types: () => p.got.map((m) => m.t) };
  near.on('data', (raw) => {
    const m = raw as Phone['got'][number];
    if (m.t === 'ping') return near.send({ t: 'pong' });
    p.got.push(m);
    if (opts.mute) return;
    if (m.t === 'enrol') { p.key = newKey(); near.send({ t: 'key', key: p.key }); }
    if (m.t === 'prove') {
      const { here, there } = ends(near.peerConnection);
      void proofOf(p.key, { room: m.room as string, nonce: m.nonce as string, host: there, phone: here }).then((mac) => near.send({ t: 'proof', macs: mac ? [newKey(), mac] : [] }));
    }
  });
  (link as unknown as { accept(c: unknown): void }).accept(far);
  p.say({ t: 'hello', pid, name, ...(modern ? { keys: 1 } : {}) });
  return p;
}
const why = (p: Phone) => p.got.find((m) => m.t === 'reject')?.why;
/** Turned away with "ask the host". */
const sentAway = (p: Phone) => p.got.at(-1)?.t === 'reject' && p.got.at(-1)?.ask === 1 && why(p) === ASK_HOST;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k),
  });
  vi.stubGlobal('navigator', { locks: fakeLocks });
  locks.held.clear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('decides each step from the proof, the key on record and the host', () => {
  const c = (x: Partial<Claim> = {}): Claim => ({ proof: 'none', approved: false, ...x });
  const cases: [Claim, { keyed: boolean; fresh: boolean; checks?: boolean }, Step][] = [
    [c(), { keyed: false, fresh: true }, 'enrol'],
    [c(), { keyed: false, fresh: false }, 'recover'],
    [c(), { keyed: true, fresh: true }, 'prove'],
    [c(), { keyed: true, fresh: false }, 'prove'],
    [c({ proof: 'right' }), { keyed: true, fresh: false }, 'admit'],
    [c({ proof: 'wrong' }), { keyed: true, fresh: false }, 'recover'],
    [c({ approved: true, proof: 'wrong' }), { keyed: true, fresh: false }, 'enrol'],
    // A host that cannot check proofs (plain http): seated by the game's rules alone.
    [c(), { keyed: true, fresh: false, checks: false }, 'admit'],
    [c(), { keyed: false, fresh: false, checks: false }, 'admit'],
    [c(), { keyed: false, fresh: true, checks: false }, 'admit'],
  ];
  for (const [claim, held, step] of cases) expect(nextStep(claim, { checks: true, ...held }), JSON.stringify([claim, held])).toBe(step);
});

it('a phone keeps a room\'s two newest keys, in memory when storage is blocked, and proves one without showing it', async () => {
  const [a, b] = [newKey(), newKey()];
  const ring = new KeyRing('snark');
  const key = ring.make(a);
  expect(new KeyRing('snark').get(a)).toEqual([key]);
  expect(ring.get(b)).toEqual([]);
  // An enrolment that came to nothing: the key before still works.
  const newer = ring.make(a);
  expect(newer).not.toBe(key);
  for (let i = 0; i < 30; i++) ring.make(newKey());
  expect(ring.get(a)).toEqual([key, newer]);
  expect(ring.get(a)).not.toContain(ring.make(a));
  expect(ring.get(a)).toHaveLength(2);
  vi.stubGlobal('localStorage', undefined);
  const held = ring.make(b);
  expect(ring.get(b)).toEqual([held]);
  const c = { room: b, nonce: a, host: 'h', phone: 'p' };
  expect(await proofOf(held, c)).toMatch(/^[0-9a-f]{64}$/);
  expect(await proofOf(undefined, c)).toBe('');
});

it('has at least 40 signs, each a different picture and word, and draws any but the last', () => {
  expect(SIGNS.length).toBeGreaterThanOrEqual(40);
  for (const k of ['emoji', 'word'] as const) expect(new Set(SIGNS.map((x) => x[k].toLowerCase())).size).toBe(SIGNS.length);
  const seen = new Set<number>();
  for (let n = 0, last = -1; n < 2000; n++) {
    const i = drawSign(last);
    expect([Number.isInteger(i), i >= 0 && i < SIGNS.length, i !== last]).toEqual([true, true, true]);
    seen.add((last = i));
  }
  expect(seen.size).toBe(SIGNS.length);
  expect([signAt(0), signAt(SIGNS.length), signAt('1'), signAt(0.5)]).toEqual([SIGNS[0], null, null, null]);
});

const GAMES = {
  snark: () => import('../../games/snark/host.svelte'),
  salad: () => import('../../games/salad/host.svelte'),
  brawl: () => import('../../games/brawl/host.svelte'),
  sketch: () => import('../../games/sketch/host.svelte'),
  hand: () => import('../../games/hand/host.svelte'),
  fish: () => import('../../games/fish/host.svelte'),
  trivia: () => import('../../games/trivia/host.svelte'),
};
interface Host { link: HostLink; game: { phase: string; code: string; id?: string } | null; open(): Promise<void>; kick(pid: string): void; rematch(): void; addBot(): string | null; start(): void }
/** Another tab with this page, opened now (the tabs before it still open). */
async function tab(game: keyof typeof GAMES): Promise<Host> {
  vi.resetModules();
  const { host } = await GAMES[game]() as unknown as { host: Host };
  await host.open();
  return host;
}
/** The host screen, freshly loaded (again: a reload, with what it saved; the tab before is gone). */
async function load(game: keyof typeof GAMES): Promise<Host> {
  locks.held.clear();
  return tab(game);
}
/** The sign a phone was sent (its place in SIGNS). */
const signOf = (p: Phone) => p.got.find((m) => m.t === 'sign')?.i as number | undefined;
const close = (h: Host) => { const x = h as unknown as { end?(): void; close?(): void }; (x.end ?? x.close)!.call(h); };
/** What the host keeps about phones that have no seat yet. */
const book = (h: Host) => (h.link as unknown as { book: { key(pid: string): string | undefined } }).book;
const pending = (h: Host) => (h.link as unknown as { desk: { calls: Map<unknown, unknown> } }).desk.calls.size;

describe.each(Object.keys(GAMES) as (keyof typeof GAMES)[])('%s seats', (game) => {
  it('open to the key, over a stale connection, mid-round and after a reload; shut to anyone else, who leaves nothing behind', async () => {
    let host = await load(game);
    const sam = phone(host.link, 'p1', 'Sam');
    expect(sam.types()).toEqual(['enrol', 'welcome', 'view']);
    expect(localStorage.getItem(`hr:${game}:host`)).not.toContain(sam.key);

    // No key, or another one: told to ask the host; an old page: to refresh it. Nothing kept, nothing asked, and the seat stays Sam's.
    for (const key of [undefined, newKey()]) {
      const thief = phone(host.link, 'p1', 'Sam', key);
      await settle(thief);
      expect(thief.types()).toEqual(['prove', 'reject']);
      expect(sentAway(thief)).toBe(true);
    }
    expect(why(phone(host.link, 'p1', 'Sam', undefined, false))).toBe(OLD_PAGE);
    expect([sam.conn.open, pending(host), host.link.recovery]).toEqual([true, 0, null]);

    // The key: in at once, though the old connection still looks alive; a second hello on it does nothing.
    const again = phone(host.link, 'p1', 'Sam', sam.key);
    await settle(again);
    expect(again.types()).toEqual(['prove', 'welcome', 'view']);
    expect(sam.got.at(-1)).toEqual({ t: 'replaced' }); // told so (by a proof: no move), then closed once that is out
    await vi.advanceTimersByTimeAsync(1500);
    expect(sam.conn.open).toBe(false);
    again.say({ t: 'hello', pid: 'p2', name: 'Zed', keys: 1 });
    expect(again.types()).toHaveLength(3);

    // Mid-round: the same, with no word to the host.
    while (host.game!.phase === 'lobby' && host.addBot() === null) host.start();
    expect(host.game!.phase).not.toBe('lobby');
    again.conn.close();
    const mid = phone(host.link, 'p1', 'Sam', sam.key);
    await settle(mid);
    expect(mid.types()).toEqual(['prove', 'welcome', 'view']);
    expect(host.link.recovery).toBeNull();

    host = await load(game);
    const back = phone(host.link, 'p1', 'Sam', sam.key);
    await settle(back);
    expect(back.types()).toEqual(['prove', 'welcome', 'view']);
    close(host);
    expect(localStorage.getItem(`hr:${game}:seats`)).toBeNull();
  });

  it('move to a new phone only through the seat the host opens, and its one Yes, with a new key', async () => {
    const host = await load(game);
    const sam = phone(host.link, 'p1', 'Sam');
    sam.conn.close();
    host.link.recoverSeat('p1', 'Sam');
    expect(host.link.recovery).toEqual({ pid: 'p1', name: 'Sam', sign: null, note: '' });
    const no = phone(host.link, 'p8', 'sam');
    await settle(no);
    expect([no.types(), host.link.recovery?.sign]).toEqual([['sign'], SIGNS[signOf(no)!]]);
    host.link.answer(false);
    expect([no.types(), why(no), host.link.recovery]).toEqual([['sign', 'reject'], 'The host said no. If you are new to this room, join again.', null]);

    host.link.recoverSeat('p1', 'Sam');
    const fresh = phone(host.link, 'p9', 'Ann'); // whatever name it typed
    await settle(fresh);
    await vi.advanceTimersByTimeAsync(20_000); // the hello deadline waits for the host
    expect(fresh.types()).toEqual(['sign']);
    expect(signOf(fresh)).not.toBe(signOf(no)); // each request its own sign
    host.link.answer(true);
    expect(fresh.got.slice(1)).toMatchObject([{ t: 'enrol' }, { t: 'welcome', pid: 'p1' }, { t: 'view' }]);
    expect(JSON.stringify(host.game)).not.toContain('Ann');
    expect(host.link.recovery).toBeNull();
    // The new key is the seat's only key.
    const late = phone(host.link, 'p1', 'Sam', sam.key);
    await settle(late);
    expect(sentAway(late)).toBe(true);
    fresh.conn.close();
    const moved = phone(host.link, 'p1', 'Sam', fresh.key);
    await settle(moved);
    expect(moved.types()).toEqual(['prove', 'welcome', 'view']);
    close(host);
  });

  it('stay shut to the removed, through Play again and a reload; a leaver may return', async () => {
    let host = await load(game);
    const sam = phone(host.link, 'p1', 'Sam');
    const dan = phone(host.link, 'p2', 'Dan');
    const eve = phone(host.link, 'p3', 'Eve');
    const heard = vi.spyOn((host.link as unknown as { hooks: { message(): void } }).hooks, 'message');
    host.kick('p3');
    expect(why(eve)).toMatch(/removed/);
    eve.say({ t: 'vote' });
    expect(heard).not.toHaveBeenCalled();
    host.link.recoverSeat('p3', 'Eve');
    expect(host.link.recovery).toBeNull();
    dan.say({ t: 'leave' });
    const kept = JSON.stringify(host.game).includes('"p2"');
    expect(book(host).key('p2') !== undefined).toBe(kept); // a row the game drops takes its key with it
    const dan2 = phone(host.link, 'p2', 'Dan', dan.key);
    await settle(dan2);
    expect(dan2.types()).toEqual([kept ? 'prove' : 'enrol', 'welcome', 'view']);

    host.game = { ...host.game!, phase: 'over' };
    host.rematch();
    expect(host.game.phase).toBe('lobby');
    host = await load(game);
    for (const key of [eve.key, undefined]) expect(why(phone(host.link, 'p3', 'Zed', key))).toMatch(/removed/);
    const sam2 = phone(host.link, 'p1', 'Sam', sam.key);
    await settle(sam2);
    expect(sam2.types()).toEqual(['prove', 'welcome', 'view']);
    close(host);
  });

  it('belong to the one tab that owns the saved room: a second tab opens nothing and writes nothing', async () => {
    const first = await load(game);
    phone(first.link, 'p1', 'Sam');
    const saved = [localStorage.getItem(`hr:${game}:host`), localStorage.getItem(`hr:${game}:seats`)];
    const second = await tab(game);
    expect([second.game, second.link.elsewhere, (second.link as unknown as { peer: unknown }).peer]).toEqual([null, true, null]);
    expect([localStorage.getItem(`hr:${game}:host`), localStorage.getItem(`hr:${game}:seats`)]).toEqual(saved);
    // Once the first tab closes its room, the next tab may open one.
    close(first);
    const third = await tab(game);
    expect([third.game, third.link.elsewhere]).toEqual([expect.anything(), false]);
    close(third);
  });

  it('never trust another room\'s record: a forgotten tab\'s game, or one saved without its room, needs the host', async () => {
    vi.stubGlobal('navigator', {}); // a browser without Web Locks: every tab opens the saved room
    const forgotten = await tab(game); // room A, left open in a second tab
    const sam = phone(forgotten.link, 'p1', 'Sam');
    phone(forgotten.link, 'p2', 'Dan');
    close(await tab(game));
    const other = await tab(game); // room B, where a guest enrols Sam's id
    const guest = phone(other.link, 'p1', 'Guest');
    expect(guest.types()).toContain('welcome');
    expect(forgotten.addBot()).toBeNull(); // the forgotten tab writes its game

    let host = await tab(game);
    expect(host.game).not.toHaveProperty('room');
    expect(JSON.stringify(host.game)).toContain('Sam');
    for (const key of [guest.key, sam.key]) expect(sentAway(phone(host.link, 'p1', 'Sam', key))).toBe(true);
    host.link.recoverSeat('p1', 'Sam');
    const back = phone(host.link, 'p1', 'Sam', sam.key);
    host.link.answer(true);
    expect(back.types()).toEqual(['sign', 'enrol', 'welcome', 'view']);

    const saved = JSON.parse(localStorage.getItem(`hr:${game}:host`)!) as { room?: string };
    expect(saved.room).toBe(host.link.room);
    localStorage.setItem(`hr:${game}:host`, JSON.stringify({ ...saved, room: undefined }));
    host = await tab(game);
    expect(sentAway(phone(host.link, 'p1', 'Sam', back.key))).toBe(true);
    close(host);
  });

  it('are never shared by two lobbies: one that moves to another code is a room of its own', async () => {
    const host = await load(game); // an empty lobby whose code another screen holds
    const [room, code] = [host.link.room, host.game!.code];
    (host.link as unknown as { peer: { on_: Handlers } }).peer.on_.error({ type: 'unavailable-id' });
    expect(host.game!.code).not.toBe(code);
    expect(host.link.room).not.toBe(room);
    expect(JSON.parse(localStorage.getItem(`hr:${game}:host`)!)).toMatchObject({ code: host.game!.code, room: host.link.room });
    expect(JSON.parse(localStorage.getItem(`hr:${game}:seats`)!)).toEqual({ room: host.link.room, keys: [], kicked: [] });
    close(host);
  });

  it('without Web Locks, trust no saved seat record: two tabs on one room never share a key', async () => {
    vi.stubGlobal('navigator', {});
    const first = await tab(game);
    const second = await tab(game); // the same saved room in a second tab
    expect(second.link.room).toBe(first.link.room); // the room's id as saved; its keys are what is not trusted
    const sam = phone(first.link, 'p1', 'Sam');
    phone(first.link, 'p2', 'Eve');
    first.kick('p2');
    await vi.advanceTimersByTimeAsync(1000);
    const guest = phone(second.link, 'p1', 'Guest'); // a fresh seat there, with the guest's key
    expect(guest.types()).toContain('welcome');
    expect(first.addBot()).toBeNull(); // the first tab saves its game last
    const host = await tab(game);
    expect(JSON.stringify(host.game)).toContain('Sam');
    expect(why(phone(host.link, 'p2', 'Eve'))).toMatch(/removed/); // who was removed is still trusted
    for (const key of [guest.key, sam.key]) expect(sentAway(phone(host.link, 'p1', 'Sam', key))).toBe(true);
    host.link.recoverSeat('p1', 'Sam');
    expect(phone(host.link, 'p1', 'Sam', sam.key).types()).toEqual(['sign']);
    close(host);
  });

  it('open to a new phone, whatever name it typed, while the old one is still here; on Yes the old one is told and cut off', async () => {
    const host = await load(game);
    const sam = phone(host.link, 'p1', 'Sam');
    const dan = phone(host.link, 'p2', 'Dan');
    phone(host.link, 'p3', 'Eve');
    host.kick('p3');
    host.link.recoverSeat('p1', 'Sam');
    expect(why(phone(host.link, 'p3', 'Sam'))).toMatch(/removed/); // not by another name either
    // A phone with a seat of its own keeps it, by its key, whatever name it typed; the seat stays open.
    dan.conn.close();
    const dan2 = phone(host.link, 'p2', 'Sam', dan.key);
    await settle(dan2);
    expect([dan2.types(), dan2.got.find((m) => m.t === 'welcome')?.pid]).toEqual([['prove', 'welcome', 'view'], 'p2']);
    const nokey = phone(host.link, 'p2', 'Sam'); // without the key, it is not the one asked about either
    await settle(nokey);
    expect(sentAway(nokey)).toBe(true);
    expect(host.link.recovery).toMatchObject({ pid: 'p1', sign: null, note: '' });
    const fresh = phone(host.link, 'p9', 'Zed');
    await settle(fresh);
    expect([fresh.types(), host.link.recovery?.sign]).toEqual([['sign'], SIGNS[signOf(fresh)!]]);
    host.link.answer(true);
    expect(fresh.types()).toEqual(['sign', 'enrol', 'welcome', 'view']);
    expect(fresh.got.find((m) => m.t === 'welcome')?.pid).toBe('p1');
    expect([sam.got.at(-1), book(host).key('p1')]).toEqual([{ t: 'replaced', moved: 1 }, fresh.key]);
    // Nobody else gets in by that name meanwhile: with no seat open, the game's own rules apply.
    expect(phone(host.link, 'p8', 'Sam').types()).toEqual(['reject']);
    close(host);
  });

  it('with the record missing, and old pages, need the host; bots come back by themselves', async () => {
    let host = await load(game);
    const sam = phone(host.link, 'p1', 'Sam');
    expect(host.addBot()).toBeNull();
    localStorage.removeItem(`hr:${game}:seats`);
    host = await load(game);
    expect(host.link.pids()).toEqual([expect.stringMatching(/^bot-/)]);
    expect(sentAway(phone(host.link, 'p1', 'Sam', sam.key))).toBe(true);
    host.link.recoverSeat('p1', 'Sam');
    const back = phone(host.link, 'p1', 'Sam', sam.key);
    host.link.answer(true);
    expect(back.types()).toEqual(['sign', 'enrol', 'welcome', 'view']);

    // An old page is told to refresh on its first join as on any other, so it never holds a seat
    // without a key, and the host is never asked about a phone that could not show a sign.
    const old = phone(host.link, 'p5', 'Old', undefined, false);
    expect([old.types(), why(old), JSON.stringify(host.game).includes('"p5"')]).toEqual([['reject'], OLD_PAGE, false]);
    back.conn.close();
    host.link.recoverSeat('p1', 'Sam');
    for (const pid of ['p1', 'p6']) expect(why(phone(host.link, pid, 'Sam', undefined, false))).toBe(OLD_PAGE);
    expect(host.link.recovery).toMatchObject({ pid: 'p1', sign: null });
    // Refreshed: a current page, a new id and no key, like any new phone.
    const refreshed = phone(host.link, 'p6', 'Sam');
    await settle(refreshed);
    host.link.answer(true);
    expect(refreshed.types()).toEqual(['sign', 'enrol', 'welcome', 'view']);
    expect(refreshed.got.find((m) => m.t === 'welcome')?.pid).toBe('p1');
    close(host);
  });
});

describe.each(Object.keys(GAMES) as (keyof typeof GAMES)[])('%s names', (game) => {
  const taken = /in use|already called/;
  it('that look like one in use are refused, also one held by a player who left and may come back by key', async () => {
    const host = await load(game);
    const sam = phone(host.link, 'p1', 'Sam Lee');
    for (const [i, name] of ['sam lee', 'Sam  Lee', ' SAM\tLEE ', 'Sam\u200B Lee', 'Ｓam Lee'].entries()) {
      expect(why(phone(host.link, `n${i}`, name)), name).toMatch(taken);
    }
    while (host.game!.phase === 'lobby' && host.addBot() === null) host.start();
    expect(host.game!.phase).not.toBe('lobby');
    sam.say({ t: 'leave' });
    expect(why(phone(host.link, 'p8', 'Sam  Lee'))).toMatch(taken);
    const back = phone(host.link, 'p1', 'Sam Lee', sam.key);
    await settle(back);
    expect(back.types()).toEqual(['prove', 'welcome', 'view']);
    close(host);
  });

  it('do not matter to an old page: it is told to refresh before the game\'s rules, also with its name in use or the room full', async () => {
    const host = await load(game);
    phone(host.link, 'p1', 'Sam');
    expect(why(phone(host.link, 'p2', 'Sam', undefined, false))).toBe(OLD_PAGE);
    for (let n = 0; n < 20 && host.addBot() === null; n++);
    expect(why(phone(host.link, 'p3', 'Zed'))).toMatch(/full/);
    expect(why(phone(host.link, 'p4', 'Zed', undefined, false))).toBe(OLD_PAGE);
    close(host);
  });
});

it('Sketchy: a player who left comes back after Play again only under a name nobody else holds then', async () => {
  const host = await load('sketch');
  const sam = phone(host.link, 'p1', 'Sam');
  while (host.game!.phase === 'lobby' && host.addBot() === null) host.start();
  sam.say({ t: 'leave' });
  host.rematch(); // leaves out who had left: the name is free again
  phone(host.link, 'p2', 'Sam');
  const back = phone(host.link, 'p1', ' sam', sam.key);
  expect(why(back)).toMatch(/in use/);
  const renamed = phone(host.link, 'p1', 'Sam B', sam.key);
  await settle(renamed);
  expect(renamed.types()).toEqual(['prove', 'welcome', 'view']);
  close(host);
});

it('turns away ids the games could not keep records by', async () => {
  const host = await load('snark');
  for (const pid of ['', '__proto__', 'constructor', 'toString', 'a b', '~house', 'x'.repeat(65)]) {
    const p = phone(host.link, pid, 'Sam');
    expect(p.types().filter((t) => t !== 'reject'), pid).toEqual([]);
  }
  expect((host.game as unknown as { players: unknown[] }).players).toEqual([]);
  close(host);
});

it('a proof counts only on the connection it was made for: one passed along by a guest in between is wrong', async () => {
  const host = await load('hand');
  const sam = phone(host.link, 'p1', 'Sam');
  const far = { currentLocalDescription: sdp('HOST'), currentRemoteDescription: sdp('SAM') };
  const straight = phone(host.link, 'p1', 'Sam', sam.key, true, { near: { currentLocalDescription: sdp('SAM'), currentRemoteDescription: sdp('HOST') }, far });
  await settle(straight);
  expect(straight.types()).toContain('welcome');
  // Sam's phone is linked to a guest, the guest to the host; the second try hides the guest's certificate behind the host's.
  for (const seen of [sdp('GUEST'), sdp('HOST', 'GUEST')]) {
    const relayed = phone(host.link, 'p1', 'Sam', sam.key, true, {
      near: { currentLocalDescription: sdp('SAM'), currentRemoteDescription: seen },
      far: { currentLocalDescription: sdp('HOST'), currentRemoteDescription: sdp(...(seen.sdp.includes('HOST') ? ['SAM', 'GUEST'] : ['GUEST'])) },
    });
    await settle(relayed);
    expect(relayed.types()).toEqual(['prove', 'reject']);
  }
  expect(straight.conn.open).toBe(true);
  close(host);
});

it('a claim still being checked ends when the room moves to another code', async () => {
  const host = await load('snark');
  phone(host.link, 'p1', 'Sam').say({ t: 'leave' }); // the lobby is empty again, so it may move; Sam keeps his row and key
  const slow = phone(host.link, 'p6', 'Slow', undefined, true, { mute: true });
  host.link.recoverSeat('p1', 'Sam');
  const asker = phone(host.link, 'p1', 'Sam');
  await settle(asker);
  expect(host.link.recovery?.sign).toBeTruthy();
  (host.link as unknown as { peer: { on_: Handlers } }).peer.on_.error({ type: 'unavailable-id' });
  expect([host.link.recovery, pending(host)]).toEqual([null, 0]);
  host.link.answer(true);
  slow.say({ t: 'key', key: newKey() });
  expect([asker.types(), slow.types()]).toEqual([['prove', 'sign'], ['enrol']]);
  expect(host.link.pids()).toEqual([]);
  close(host);
});

it('challenges a phone with its key however many others wait for a seat', async () => {
  const host = await load('hand');
  const sam = phone(host.link, 'p1', 'Sam');
  for (let i = 0; i < 40; i++) phone(host.link, `q${i}`, `N${i}`, undefined, true, { mute: true });
  expect(pending(host)).toBe(40);
  const back = phone(host.link, 'p1', 'Sam', sam.key);
  await settle(back);
  expect(back.types()).toEqual(['prove', 'welcome', 'view']);
  close(host);
});

it('on plain http (no Web Locks, no crypto.subtle) seats every phone by the game\'s rules, asking nobody for a proof', async () => {
  const real = globalThis.crypto;
  vi.stubGlobal('crypto', { getRandomValues: <T extends ArrayBufferView>(a: T) => real.getRandomValues(a as never) as T });
  vi.stubGlobal('navigator', {});
  const host = await tab('hand');
  const sam = phone(host.link, 'p1', 'Sam');
  expect(sam.types()).toEqual(['welcome', 'view']);
  sam.conn.close();
  const back = phone(host.link, 'p1', 'Sam');
  expect(back.types()).toEqual(['welcome', 'view']);
  expect(phone(host.link, 'p2', 'Old', undefined, false).types()).toEqual(['welcome', 'view']);
  expect(book(host).key('p1')).toBeUndefined();
  close(host);
});

it('on plain http, New phone changes nothing: a typed name gets no online player\'s seat, and a new phone is a new player', async () => {
  const real = globalThis.crypto;
  vi.stubGlobal('crypto', { getRandomValues: <T extends ArrayBufferView>(a: T) => real.getRandomValues(a as never) as T });
  vi.stubGlobal('navigator', {});
  const host = await tab('hand');
  const sam = phone(host.link, 'p1', 'Sam');
  host.link.recoverSeat('p1', 'Sam');
  const guest = phone(host.link, 'p9', 'Sam');
  expect([guest.types(), why(guest)]).toEqual([['reject'], expect.stringMatching(/in use/)]);
  expect([sam.conn.open, host.link.pids(), host.link.recovery?.sign]).toEqual([true, ['p1'], null]);
  // A new phone by another name is just a new player there: nobody is asked about it.
  expect(phone(host.link, 'p7', 'Ann').types()).toEqual(['welcome', 'view']);
  expect(host.link.recovery).toMatchObject({ pid: 'p1', sign: null });
  close(host);
});

it('a proof still being checked when its player leaves is judged on the seat as it is then', async () => {
  const host = await load('hand'); // its lobby drops a leaver's row, and with it the key
  const sam = phone(host.link, 'p1', 'Sam');
  const twin = phone(host.link, 'p1', 'Sam', sam.key);
  sam.say({ t: 'leave' });
  await settle(twin);
  expect(twin.types()).toEqual(['prove', 'enrol', 'welcome', 'view']); // a new seat, with a new key
  expect(book(host).key('p1')).toBe(twin.key);
  close(host);
});

it('two phones enrolling one new seat: the first key in takes it, the other is sent to the host', async () => {
  const host = await load('hand');
  const slow = phone(host.link, 'p1', 'Sam', undefined, true, { mute: true });
  expect(slow.types()).toEqual(['enrol']);
  const quick = phone(host.link, 'p1', 'Sam');
  expect(quick.types()).toEqual(['enrol', 'welcome', 'view']);
  slow.say({ t: 'key', key: newKey() });
  expect(slow.types()).toEqual(['enrol', 'prove']); // the seat has a key now: its proof is wanted
  slow.say({ t: 'proof', macs: [] });
  await until(() => slow.types().includes('reject'));
  expect(sentAway(slow)).toBe(true);
  expect(book(host).key('p1')).toBe(quick.key);
  close(host);
});

it('a new room never keeps the record of one before it', async () => {
  const host = await load('hand');
  phone(host.link, 'p1', 'Sam');
  const keep = localStorage.getItem('hr:hand:seats')!;
  close(host);
  localStorage.setItem('hr:hand:seats', keep); // left behind
  const real = localStorage.setItem;
  localStorage.setItem = (k, v) => { if (k.endsWith(':seats')) throw new Error('full'); real(k, v); };
  await load('hand');
  expect(localStorage.getItem('hr:hand:seats')).toBeNull();
  const again = await load('hand');
  expect((again.link as unknown as { book: { key(pid: string): unknown } }).book.key('p1')).toBeUndefined();
  close(again);
});

describe('a seat opened for a new phone', () => {
  const room = async () => {
    const host = await load('hand');
    const sam = phone(host.link, 'p1', 'Sam');
    sam.conn.close();
    host.link.recoverSeat('p1', 'Sam');
    return { host, sam };
  };
  const ask = async (host: Host, pid = 'p9') => {
    const p = phone(host.link, pid, 'Sam');
    await settle(p);
    return p;
  };

  it('is never asked for by the name typed in a hello that came before it opened', async () => {
    const host = await load('hand');
    phone(host.link, 'p1', 'Sam').conn.close();
    const early = phone(host.link, 'p9', 'Sam', undefined, true, { mute: true });
    expect(early.types()).toEqual(['prove']); // the game matched it to Sam's seat by name
    host.link.recoverSeat('p1', 'Sam');
    early.say({ t: 'proof', macs: [] });
    await until(() => early.types().includes('reject'));
    expect([sentAway(early), host.link.recovery]).toEqual([true, expect.objectContaining({ pid: 'p1', sign: null })]);
    close(host);
  });

  it('goes to nobody when two phones ask for it, and closes', async () => {
    const { host, sam } = await room();
    const first = await ask(host);
    const second = await ask(host, 'p7');
    expect([why(first), why(second)]).toEqual([expect.stringMatching(/Another phone/), expect.stringMatching(/Another phone/)]);
    expect(host.link.recovery).toMatchObject({ sign: null, note: expect.stringMatching(/^Two phones asked for Sam’s seat/) });
    host.link.answer(true);
    expect(sentAway(await ask(host))).toBe(true);
    // The owner's key still works all along.
    const back = phone(host.link, 'p1', 'Sam', sam.key);
    await settle(back);
    expect(back.types()).toContain('welcome');
    host.link.stopRecovery();
    expect(host.link.recovery).toBeNull();
    close(host);
  });

  it('is for one connection: a Yes it did not live to use is gone, and so is the seat', async () => {
    const { host, sam } = await room();
    const first = await ask(host);
    first.conn.close();
    expect(host.link.recovery).toMatchObject({ sign: null, note: expect.stringMatching(/went away/) });
    expect(pending(host)).toBe(0);

    // A Yes, then the connection drops before its key comes: no key changes, nobody is seated.
    host.link.recoverSeat('p1', 'Sam');
    const slow = phone(host.link, 'p9', 'Sam', undefined, true, { mute: true });
    await until(() => slow.types().includes('sign'));
    host.link.answer(true);
    expect(slow.types()).toEqual(['sign', 'enrol']);
    slow.conn.close();
    expect([host.link.pids(), pending(host), host.link.recovery]).toEqual([[], 0, null]);
    const back = phone(host.link, 'p1', 'Sam', sam.key);
    await settle(back);
    expect(back.types()).toContain('welcome');
    close(host);
  });

  it('ends a Yes not yet used when the seat is opened again: its late key changes nothing', async () => {
    const { host, sam } = await room();
    const first = phone(host.link, 'p9', 'Sam', undefined, true, { mute: true });
    await until(() => first.types().includes('sign'));
    host.link.answer(true);
    expect(first.types()).toEqual(['sign', 'enrol']); // approved, its key not here yet
    host.link.recoverSeat('p1', 'Sam');
    expect(why(first)).toBe('The host said no. If you are new to this room, join again.');
    const second = await ask(host, 'p8');
    host.link.answer(true);
    expect(second.types()).toEqual(['sign', 'enrol', 'welcome', 'view']);
    first.say({ t: 'key', key: newKey() });
    expect(book(host).key('p1')).toBe(second.key);
    expect(first.types()).not.toContain('welcome');
    for (const [key, welcomed] of [[sam.key, false], [second.key, true]] as const) {
      const p = phone(host.link, 'p1', 'Sam', key);
      await settle(p);
      expect(p.types().includes('welcome')).toBe(welcomed);
    }
    close(host);
  });

  it('sends each asker alone a sign of its own, never the last request\'s, and closes after its minute', async () => {
    const { host } = await room();
    host.link.stopRecovery();
    const dan = phone(host.link, 'p2', 'Dan');
    const quiet = phone(host.link, 'p3', 'Eve', undefined, true, { mute: true });
    host.link.recoverSeat('p1', 'Sam');
    let last: number | undefined;
    for (let n = 0; n < 30; n++) {
      const asker = await ask(host, `q${n}`);
      expect(asker.types()).toEqual(['sign']);
      expect(signOf(asker)).not.toBe(last);
      expect(host.link.recovery?.sign).toEqual(SIGNS[signOf(asker)!]);
      last = signOf(asker);
      host.link.answer(false);
      host.link.recoverSeat('p1', 'Sam');
    }
    expect([dan.types(), quiet.types()]).toEqual([['enrol', 'welcome', 'view'], ['enrol']]);
    const later = await ask(host, 'p7');
    expect(later.types()).toEqual(['sign']);
    await vi.advanceTimersByTimeAsync(OPEN_MS - 500);
    expect(host.link.recovery?.sign).toBeTruthy();
    await vi.advanceTimersByTimeAsync(1000);
    expect(why(later)).toBe('The host did not answer. Try again.');
    close(host);
  });

  it('lets a phone with the key in meanwhile, and closes after a minute', async () => {
    const { host, sam } = await room();
    const first = await ask(host);
    const back = phone(host.link, 'p1', 'Sam', sam.key);
    await settle(back);
    expect(back.types()).toContain('welcome');
    expect([first.conn.open, !!host.link.recovery?.sign]).toEqual([true, true]);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(why(first)).toBe('The host did not answer. Try again.');
    expect(host.link.recovery?.note).toMatch(/in time/);
    close(host);
  });
});

describe('the app\'s phone', () => {
  const join = async (host: Host) => {
    const { PhoneLink } = await import('./phone-link.svelte');
    const p: PhoneLink<{ t: string }, BaseView> = new PhoneLink('snark', { keep: () => false });
    p.join(host.game!.code, 'Sam');
    await until(() => p.link === 'live');
    return p;
  };

  it('enrols, and after a drop proves its key, storage or none; never in a URL or its saved player', async () => {
    const host = await load('snark');
    vi.stubGlobal('localStorage', undefined);
    const p = await join(host);
    expect(p.link).toBe('live');
    const conn = () => (p as unknown as { conn: End }).conn;
    const sent: unknown[] = [];
    conn().close();
    expect(p.link).toBe('lost');
    const peer = (p as unknown as { peer: { connect(to: string): End } }).peer;
    const connect = peer.connect;
    peer.connect = (to) => {
      const c = connect(to);
      const send = c.send;
      c.send = (m) => { sent.push(m); send(m); };
      return c;
    };
    await vi.advanceTimersByTimeAsync(1000);
    await until(() => p.link === 'live');
    expect(p.link).toBe('live');
    expect(sent).toMatchObject([{ t: 'hello', keys: 1 }, { t: 'proof', macs: [expect.stringMatching(/^[0-9a-f]{64}$/)] }]);
    // The other end asks for keys: it gets one, and the seat's own key still proves.
    const room = (host.link as unknown as { book: { room: string } }).book.room;
    for (let i = 0; i < 3; i++) (p as unknown as { receive(m: object): void }).receive({ t: 'enrol', room });
    expect(sent.filter((m) => (m as { t: string }).t === 'key')).toHaveLength(1);
    conn().close();
    await vi.advanceTimersByTimeAsync(1000);
    await until(() => p.link === 'live');
    expect(p.link).toBe('live');
    expect(host.link.recovery).toBeNull();
    close(host);
  });

  it('shows its sign and is sent away in its own words, whatever the other end says', async () => {
    const host = await load('snark');
    const owner = phone(host.link, 'p1', 'Sam');
    owner.conn.close();
    const { PhoneLink } = await import('./phone-link.svelte');
    const p = new PhoneLink<{ t: string }, BaseView>('snark', { keep: () => false });
    p.join(host.game!.code, 'Sam');
    await until(() => p.link === 'stopped');
    expect(p.stopped).toBe(ASK_HOST);

    host.link.recoverSeat('p1', 'Sam');
    p.join(host.game!.code, 'Sam');
    await until(() => !!host.link.recovery?.sign);
    expect([p.sign, p.trouble]).toEqual([host.link.recovery!.sign, '']); // the picture the host's question shows
    const shown = p.sign;
    const inner = p as unknown as { receive(m: object): void };
    for (const i of [SIGNS.length, -1, 1.5, '0', '__proto__', null, undefined]) inner.receive({ t: 'sign', i, why: 'Type your key here.' });
    expect([p.sign, p.trouble, p.stopped]).toEqual([shown, '', '']);
    host.link.answer(true);
    await until(() => p.link === 'live');
    expect([p.link, p.sign, p.trouble]).toEqual(['live', null, '']);
    inner.receive({ t: 'reject', why: 'Your seat moved: type your key at evil.example.', ask: 1 });
    expect(p.stopped).toBe(ASK_HOST);
    close(host);
  });

  it('shows its sign until a refusal, Cancel or the link going, however long the host takes', async () => {
    const host = await load('snark');
    phone(host.link, 'p1', 'Sam').conn.close();
    const { PhoneLink } = await import('./phone-link.svelte');
    const p = new PhoneLink<{ t: string }, BaseView>('snark', { keep: () => false });
    const asks = async () => {
      host.link.recoverSeat('p1', 'Sam');
      p.join(host.game!.code, 'Sam');
      await until(() => !!p.sign);
    };
    await asks();
    await vi.advanceTimersByTimeAsync(50_000);
    expect(p.sign).toBe(host.link.recovery!.sign); // still asked about
    host.link.stopRecovery(); // Close on the host: a refusal
    await until(() => p.link === 'stopped');
    expect(p.sign).toBeNull();
    await asks();
    p.leave(); // Cancel
    expect(p.sign).toBeNull();
    await vi.advanceTimersByTimeAsync(500); // its goodbye out, the link closes
    expect([p.sign, host.link.recovery?.note]).toEqual([null, expect.stringMatching(/went away/)]);
    await asks();
    const far = (p as unknown as { conn: End }).conn.other!;
    far.send = () => {}; // the link goes dead one way: nothing more arrives, not even its close
    far.close = () => {};
    await vi.advanceTimersByTimeAsync(LINK_TIMEOUT + 2000);
    expect([p.sign, p.link]).toEqual([null, 'joining']);
    close(host);
  });

  it('an earlier asker that never heard its refusal shows a sign the next question does not', async () => {
    const host = await load('snark');
    phone(host.link, 'p1', 'Sam').conn.close();
    const { PhoneLink } = await import('./phone-link.svelte');
    const p = new PhoneLink<{ t: string }, BaseView>('snark', { keep: () => false });
    host.link.recoverSeat('p1', 'Sam');
    p.join(host.game!.code, 'Sam');
    await until(() => !!p.sign);
    const far = (p as unknown as { conn: End }).conn.other!;
    far.send = () => {};
    far.close = () => {};
    host.link.recoverSeat('p1', 'Sam'); // refuses the old asker; the phone never hears it
    const guest = phone(host.link, 'p9', 'Sam');
    await settle(guest);
    expect(guest.types()).toEqual(['sign']); // no rest: the seat opens at once
    expect(p.sign).not.toBeNull();
    expect(host.link.recovery!.sign).toEqual(SIGNS[signOf(guest)!]);
    expect(host.link.recovery!.sign).not.toEqual(p.sign);
    close(host);
  });

  it('in two tabs: the one replaced stops, keeps the room, and takes it back only when asked', async () => {
    const host = await load('snark');
    const first = await join(host);
    const { PhoneLink, ELSEWHERE, loadMe } = await import('./phone-link.svelte');
    const second = new PhoneLink<{ t: string }, BaseView>('snark', { keep: () => false }); // the tab, duplicated
    second.rejoin();
    await until(() => second.link === 'live' && first.link === 'stopped');
    await vi.advanceTimersByTimeAsync(60_000);
    expect([first.link, first.elsewhere, first.stopped, second.link]).toEqual(['stopped', true, ELSEWHERE, 'live']);
    expect(loadMe('snark')).toMatchObject({ code: host.game!.code, joined: true }); // what both tabs rejoin with
    first.here();
    await until(() => first.link === 'live' && second.link === 'stopped');
    await vi.advanceTimersByTimeAsync(60_000);
    expect([first.link, second.link, second.elsewhere]).toEqual(['live', 'stopped', true]);
    close(host);
  });

  it('whose seat the host gave to a new phone stops with the reason, no way back that cannot work, and nothing saved changed', async () => {
    const host = await load('snark');
    const sam = await join(host);
    const { MOVED } = await import('./phone-link.svelte');
    const saved = [localStorage.getItem('hr:snark:me'), localStorage.getItem('hr:snark:keys')];
    host.link.recoverSeat(sam.me!.pid, 'Sam');
    const fresh = phone(host.link, 'p9', 'Sam'); // another phone, with storage of its own
    await settle(fresh);
    host.link.answer(true);
    expect(fresh.types()).toContain('welcome');
    await until(() => sam.link === 'stopped');
    await vi.advanceTimersByTimeAsync(60_000);
    expect([sam.link, sam.stopped, sam.elsewhere]).toEqual(['stopped', MOVED, false]);
    expect([localStorage.getItem('hr:snark:me'), localStorage.getItem('hr:snark:keys')]).toEqual(saved);
    expect(host.link.pids()).toEqual([sam.me!.pid]); // the new phone's seat, untouched
    close(host);
  });

  it('that redialled pays no heed to its old connection being told it was replaced', async () => {
    const host = await load('snark');
    const p = await join(host);
    const old = (p as unknown as { conn: End }).conn;
    const heard: string[] = [];
    const data = old.on_.data!;
    old.on_.data = (m) => { heard.push((m as { t: string }).t); data(m); };
    old.close = () => {}; // half dead: the page lets go of it, yet the host's words on it still arrive
    (p as unknown as { lose(c: unknown): void }).lose(old);
    expect(p.link).toBe('lost');
    await vi.advanceTimersByTimeAsync(1000);
    await until(() => p.link === 'live');
    expect([heard.at(-1), p.link, p.elsewhere, p.stopped]).toEqual(['replaced', 'live', false, '']);
    close(host);
  });

  it('reads no view it cannot: a malformed one changes nothing and throws nothing', async () => {
    const { phone: snark } = await import('../../games/snark/player.svelte');
    const { phone: salad } = await import('../../games/salad/player.svelte');
    snark.send({ t: 'answer', r: 1, i: 0, text: 'Hi' } as never);
    salad.send({ t: 'word', serial: 1, frame: 0, slot: 0, value: 'a' } as never);
    const bad: unknown[] = [{ left: null, paused: false, serial: 1, acknowledged: [], draft: { index: 0, values: [null], choices: [7] } },
      { left: null, paused: false, screen: { k: 'write' } }, { left: null, paused: false, screen: { k: 'write', tasks: [null] } },
      null, 7, 'x', [], {}, { left: 'soon', paused: false }, { left: null, paused: false },
      { left: null, paused: false, serial: 1, acknowledged: 'x', draft: null }];
    for (const link of [snark, salad]) {
      const inner = link as unknown as { receive(m: object): void; outbox: unknown[] };
      for (const v of bad) expect(() => inner.receive({ t: 'view', v }), JSON.stringify(v)).not.toThrow();
      expect([link.view, inner.outbox.length]).toEqual([null, 1]);
    }
  });

  it('uses an id in one room only: kept after leaving or a refusal, new in any other', async () => {
    const host = await load('snark');
    const p = await join(host);
    const pid = p.me!.pid;
    p.join(host.game!.code, 'Samuel');
    expect(p.me!.pid).toBe(pid);
    p.leave();
    const { PhoneLink } = await import('./phone-link.svelte');
    const reloaded = new PhoneLink<{ t: string }, BaseView>('snark', { keep: () => false });
    reloaded.join(host.game!.code, 'Sam');
    expect(reloaded.me!.pid).toBe(pid);
    reloaded.leave();
    net.hosts.set('jerkbox-snark-ZZZZ', () => {});
    reloaded.join('ZZZZ', 'Sam');
    expect(reloaded.me!.pid).not.toBe(pid);
    reloaded.leave();
    close(host);
  });

  it('joins a host that knows no keys as before', async () => {
    const host = await load('snark');
    const id = [...net.hosts.keys()].at(-1)!;
    net.hosts.set(id, (c) => {
      const conn = c as End;
      conn.on('data', (m) => { if ((m as { t: string }).t === 'hello') conn.send({ t: 'welcome', pid: 'p1' }); });
    });
    expect((await join(host)).link).toBe('live');
    close(host);
  });
});

describe('Sketchy drawings', () => {
  it('from before rooms go to the game saved then, once, and never to a game with a room id', async () => {
    const d = [{ c: 0, w: 1, p: [0, 0] }];
    const bare = JSON.stringify({ 'old/1/0': d });
    let host = await load('sketch');
    const saved = JSON.parse(localStorage.getItem('hr:sketch:host')!) as object;
    localStorage.setItem('hr:sketch:art', bare);
    host = await load('sketch'); // a game with its room id: not its drawings
    const art = (h: Host) => (h as unknown as { art: object }).art;
    expect(art(host)).toEqual({});
    localStorage.setItem('hr:sketch:host', JSON.stringify({ ...saved, room: undefined }));
    localStorage.setItem('hr:sketch:art', bare);
    host = await load('sketch'); // saved before rooms: its drawings, kept under its new room id
    expect(art(host)).toEqual(JSON.parse(bare));
    expect(JSON.parse(localStorage.getItem('hr:sketch:drawings')!)).toEqual({ room: host.link.room, art: JSON.parse(bare) });
    expect(localStorage.getItem('hr:sketch:art')).toBeNull(); // the game names its room now: the old record goes
    host = await load('sketch');
    expect(art(host)).toEqual(JSON.parse(bare));
    close(host);
  });

  it('from before rooms are filed under the room before the game names it: a failed write leaves both as they were', async () => {
    const bare = JSON.stringify({ 'old/1/0': [{ c: 0, w: 1, p: [0, 0] }] });
    let host = await load('sketch');
    const saved = JSON.parse(localStorage.getItem('hr:sketch:host')!) as object;
    close(host);
    localStorage.setItem('hr:sketch:host', JSON.stringify({ ...saved, room: undefined }));
    localStorage.setItem('hr:sketch:art', bare);
    const real = localStorage.setItem;
    let refuse = 1;
    localStorage.setItem = (k, v) => { if (k === 'hr:sketch:drawings' && refuse-- > 0) throw new Error('full'); real(k, v); };
    host = await load('sketch');
    const art = (h: Host) => (h as unknown as { art: object }).art;
    expect(art(host)).toEqual(JSON.parse(bare)); // on screen all the same
    expect((JSON.parse(localStorage.getItem('hr:sketch:host')!) as { room?: string }).room ?? '').toBe(''); // names no room
    expect(localStorage.getItem('hr:sketch:art')).toBe(bare);
    expect(host.addBot()).toBeNull(); // a later save of the game still names no room
    expect((JSON.parse(localStorage.getItem('hr:sketch:host')!) as { room?: string }).room ?? '').toBe(''); // names no room
    host = await load('sketch'); // tried again, and this time stored
    expect(art(host)).toEqual(JSON.parse(bare));
    const filed = JSON.parse(localStorage.getItem('hr:sketch:drawings')!) as { room: string };
    expect([filed.room, (JSON.parse(localStorage.getItem('hr:sketch:host')!) as { room: string }).room]).toEqual([host.link.room, host.link.room]);
    expect(localStorage.getItem('hr:sketch:art')).toBeNull();
    close(host);
  });

  it('from before rooms stay readable until the game naming their room is stored', async () => {
    const bare = JSON.stringify({ 'old/1/0': [{ c: 0, w: 1, p: [0, 0] }] });
    let host = await load('sketch');
    const saved = JSON.parse(localStorage.getItem('hr:sketch:host')!) as object;
    close(host);
    const old = JSON.stringify({ ...saved, room: undefined });
    localStorage.setItem('hr:sketch:host', old);
    localStorage.setItem('hr:sketch:art', bare);
    const real = localStorage.setItem;
    let refuse = 1;
    localStorage.setItem = (k, v) => { if (k === 'hr:sketch:host' && refuse-- > 0) throw new Error('full'); real(k, v); };
    host = await load('sketch'); // the drawings are filed under the room; the game's write fails
    expect(localStorage.getItem('hr:sketch:host')).toBe(old);
    host = await load('sketch');
    const art = (h: Host) => (h as unknown as { art: object }).art;
    expect(art(host)).toEqual(JSON.parse(bare));
    expect(localStorage.getItem('hr:sketch:art')).toBeNull(); // stored this time: the old record goes
    host = await load('sketch');
    expect(art(host)).toEqual(JSON.parse(bare));
    close(host);
  });

  it('survive two tabs without Web Locks: both keep the room\'s id, so the drawings stay filed under it', async () => {
    vi.stubGlobal('navigator', {});
    const first = await tab('sketch');
    const d = { 'x/1/0': [{ c: 0, w: 1, p: [0, 0] }] };
    const inner = first as unknown as { art: object; saveArt(): void };
    inner.art = d;
    inner.saveArt();
    await tab('sketch'); // the same saved game, opened again
    expect(first.addBot()).toBeNull(); // the first tab saves its game, not its drawings
    const host = await tab('sketch');
    expect((host as unknown as { art: object }).art).toEqual(d);
    close(host);
  });

  it('are read only in the room that saved them; a room that moves gets a new game id', async () => {
    const store = await import('../../games/sketch/store');
    const d = [{ c: 0, w: 1, p: [0, 0] }] as never;
    store.saveArt({ 'g/1/0': d }, 'roomA');
    expect(store.loadArt('roomA')).toEqual({ 'g/1/0': d });
    expect([store.loadArt('roomB'), store.loadArt('')]).toEqual([{}, {}]);

    const host = await load('sketch');
    const [id, room] = [host.game!.id, host.link.room];
    (host.link as unknown as { peer: { on_: Handlers } }).peer.on_.error({ type: 'unavailable-id' });
    expect([host.game!.id, host.link.room].some((x, i) => x === [id, room][i])).toBe(false);
    const art = host as unknown as { art: Record<string, unknown>; saveArt(): void };
    art.art = { 'x/1/0': d };
    art.saveArt();
    expect(store.loadArt(room)).toEqual({});
    expect(store.loadArt(host.link.room)).toEqual({ 'x/1/0': d });
    close(host);
  });
});
