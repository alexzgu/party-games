import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KeyRing, askText, commitOf, ends, newKey, nextStep, numberOf, proofOf, type Claim, type Held, type Step } from './seats';
import type { HostLink } from './host-link.svelte';
import type { PhoneLink, BaseView } from './phone-link.svelte';

// A broker in memory: a host's peer under its id, and phones' peers that connect to it.
type Handlers = Record<string, (x?: unknown) => void>;
const net = vi.hoisted(() => ({ hosts: new Map<string, (conn: unknown) => void>(), secure: false }));
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
        if (net.secure) {
          near.peerConnection = { currentLocalDescription: sdp('SAM'), currentRemoteDescription: sdp('HOST') };
          far.peerConnection = { currentLocalDescription: sdp('HOST'), currentRemoteDescription: sdp('SAM') };
        }
        net.hosts.get(to)!(far);
        queueMicrotask(() => near.on_.open?.());
        return near;
      },
    };
    return peer;
  },
}));

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

interface Phone { /** Its value for the number. */ value: string; got: { t: string; [k: string]: unknown }[]; conn: End; key?: string; asleep?: boolean; say(m: object): void; types(): string[] }
/** A phone's page: says hello and answers the handshake as the app does (`modern`), with the key it has. */
function phone(link: HostLink, pid: string, name: string, key?: string, modern = true, opts: { near?: Sdp; far?: Sdp; mute?: boolean; reveal?: string | null } = {}): Phone {
  const [near, far] = [end(), end()];
  near.other = far;
  far.other = near;
  near.peerConnection = opts.near;
  far.peerConnection = opts.far;
  const p: Phone = { value: newKey(), got: [], conn: near, key, say: (m) => near.send(m), types: () => p.got.map((m) => m.t) };
  near.on('data', (raw) => {
    const m = raw as Phone['got'][number];
    if (m.t === 'ping') return p.asleep ? undefined : near.send({ t: 'pong' });
    p.got.push(m);
    if (opts.mute) return;
    if (m.t === 'wait' && m.value && opts.reveal !== null) near.send({ t: 'reveal', value: opts.reveal ?? p.value });
    if (m.t === 'enrol') { p.key = newKey(); near.send({ t: 'key', key: p.key }); }
    if (m.t === 'prove') {
      const { here, there } = ends(near.peerConnection);
      void proofOf(p.key, { room: m.room as string, nonce: m.nonce as string, host: there, phone: here }).then((mac) => near.send({ t: 'proof', macs: mac ? [newKey(), mac] : [] }));
    }
  });
  (link as unknown as { accept(c: unknown): void }).accept(far);
  const hello = { t: 'hello', pid, name, ...(modern ? { keys: 1 } : {}) };
  if (opts.near && modern) void commitOf(p.value).then((commit) => p.say({ ...hello, commit }));
  else p.say(hello);
  return p;
}
const why = (p: Phone) => p.got.find((m) => m.t === 'reject')?.why;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k),
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  net.secure = false;
});

it('decides each step from the proof, the key on record and the host', () => {
  const c = (x: Partial<Claim> = {}): Claim => ({ modern: true, proof: 'none', approved: false, ...x });
  const s = (x: Partial<Held> = {}): Held => ({ keyed: false, fresh: false, online: false, live: false, ...x });
  const refused = { refuse: expect.any(String) };
  const cases: [Claim, Held, unknown][] = [
    [c(), s({ fresh: true }), 'enrol'],
    [c(), s(), 'ask'],
    [c({ approved: true }), s(), 'enrol'],
    [c({ modern: false }), s({ fresh: true }), 'ask'],
    [c({ modern: false, approved: true }), s(), 'admit'],
    [c({ modern: false, approved: true }), s({ keyed: true }), refused],
    [c(), s({ online: true, live: true }), 'retry'],
    [c(), s({ online: true }), 'ask'],
    [c(), s({ keyed: true, online: true, live: true }), 'prove'],
    [c({ proof: 'right' }), s({ keyed: true, online: true, live: true }), 'admit'],
    [c({ proof: 'wrong' }), s({ keyed: true }), 'ask'],
    [c({ proof: 'wrong', approved: true }), s({ keyed: true }), 'enrol'],
    [c({ proof: 'wrong', approved: true }), s({ keyed: true, online: true }), refused],
  ];
  for (const [claim, held, step] of cases) expect(nextStep(claim, held), JSON.stringify([claim, held])).toEqual(step as Step);
});

it('a phone keeps a room\'s two newest keys, in memory when storage is blocked, and proves one without showing it', async () => {
  const [a, b] = [newKey(), newKey()];
  const ring = new KeyRing('snark');
  const key = ring.make(a);
  expect(new KeyRing('snark').get(a)).toEqual([key]);
  expect(ring.get(b)).toEqual([]);
  // An enrolment that came to nothing, or a fake host's: the key before still works.
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

const GAMES = {
  snark: () => import('../../games/snark/host.svelte'),
  salad: () => import('../../games/salad/host.svelte'),
  brawl: () => import('../../games/brawl/host.svelte'),
  sketch: () => import('../../games/sketch/host.svelte'),
  hand: () => import('../../games/hand/host.svelte'),
};
interface Host { link: HostLink; game: { phase: string; code: string } | null; open(): void; kick(pid: string): void; rematch(): void; addBot(): string | null }
/** The host screen, freshly loaded (again: a reload, with what it saved). */
async function load(game: keyof typeof GAMES): Promise<Host> {
  vi.resetModules();
  const { host } = await GAMES[game]() as unknown as { host: Host };
  host.open();
  return host;
}
const close = (h: Host) => { const x = h as unknown as { end?(): void; close?(): void }; (x.end ?? x.close)!.call(h); };

describe.each(Object.keys(GAMES) as (keyof typeof GAMES)[])('%s seats', (game) => {
  it('open to the key, over a stale connection and a reload; shut to anyone else', async () => {
    let host = await load(game);
    const sam = phone(host.link, 'p1', 'Sam');
    expect(sam.types()).toEqual(['enrol', 'welcome', 'view']);
    expect(localStorage.getItem(`hr:${game}:host`)).not.toContain(sam.key);

    // No key, or another one: nothing private, and the seat stays Sam's.
    for (const key of [undefined, newKey()]) {
      const thief = phone(host.link, 'p1', 'Sam', key);
      await settle(thief);
      expect(thief.types()).toEqual(['prove', 'reject']);
    }
    expect(sam.conn.open).toBe(true);
    const old = phone(host.link, 'p1', 'Sam', undefined, false);
    expect(why(old)).toBe('Reload this page to rejoin.');
    expect(host.link.asks).toEqual([]);

    // The key: in at once, though the old connection still looks alive; a second hello on it does nothing.
    const again = phone(host.link, 'p1', 'Sam', sam.key);
    await settle(again);
    expect(again.types()).toEqual(['prove', 'welcome', 'view']);
    expect(sam.conn.open).toBe(false);
    again.say({ t: 'hello', pid: 'p2', name: 'Zed', keys: 1 });
    expect(again.types()).toHaveLength(3);

    host = await load(game);
    const back = phone(host.link, 'p1', 'Sam', sam.key);
    await settle(back);
    expect(back.types()).toEqual(['prove', 'welcome', 'view']);
    expect(host.link.asks).toEqual([]);
    close(host);
    expect(localStorage.getItem(`hr:${game}:seats`)).toBeNull();
  });

  it('move to a new phone by name on the host\'s Yes, with a new key', async () => {
    const host = await load(game);
    const sam = phone(host.link, 'p1', 'Sam');
    sam.conn.close();
    const no = phone(host.link, 'p8', 'sam');
    await settle(no);
    host.link.answer(host.link.asks[0], false);
    expect(no.types()).toEqual(['prove', 'wait', 'reject']);

    const fresh = phone(host.link, 'p9', 'sam');
    await settle(fresh);
    expect(host.link.asks).toMatchObject([{ name: 'Sam', fresh: false }]);
    await vi.advanceTimersByTimeAsync(20_000); // the hello deadline waits for the host
    expect(fresh.types()).toEqual(['prove', 'wait']);
    host.link.answer(host.link.asks[0], true);
    expect(fresh.got.slice(2)).toMatchObject([{ t: 'enrol' }, { t: 'welcome', pid: 'p1' }, { t: 'view' }]);
    const late = phone(host.link, 'p1', 'Sam', sam.key);
    await settle(late);
    expect(late.types()).toEqual(['prove', 'reject']);
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
    dan.say({ t: 'leave' });
    const dan2 = phone(host.link, 'p2', 'Dan', dan.key);
    await settle(dan2);
    expect(dan2.types()).toEqual(['prove', 'welcome', 'view']);

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

  it('never trust another room\'s record: a forgotten tab\'s game, or one saved without its room, asks', async () => {
    const tab = await load(game); // room A, left open in a second tab
    const sam = phone(tab.link, 'p1', 'Sam');
    const dan = phone(tab.link, 'p2', 'Dan');
    close(await load(game));
    const other = await load(game); // room B, where a guest enrols Sam's id and Dan's is removed
    const guest = phone(other.link, 'p1', 'Guest');
    phone(other.link, 'p2', 'Nan');
    other.kick('p2');
    expect(tab.addBot()).toBeNull(); // the second tab writes its game

    let host = await load(game);
    expect(host.game).not.toHaveProperty('room');
    expect(JSON.stringify(host.game)).toContain('Sam');
    for (const [pid, name, key] of [['p1', 'Sam', guest.key], ['p2', 'Dan', dan.key]]) {
      const p = phone(host.link, pid!, name!, key);
      expect(p.types()).toEqual(['wait']);
      host.link.answer(host.link.asks[0], true);
      expect(p.types()).toEqual(['wait', 'enrol', 'welcome', 'view']);
      sam.key = pid === 'p1' ? p.key : sam.key;
    }

    const saved = JSON.parse(localStorage.getItem(`hr:${game}:host`)!) as { room?: string };
    expect(saved.room).toBe(host.link.room);
    localStorage.setItem(`hr:${game}:host`, JSON.stringify({ ...saved, room: undefined }));
    host = await load(game);
    expect(phone(host.link, 'p1', 'Sam', sam.key).types()).toEqual(['wait']);
    close(host);
  });

  it('are never shared by two lobbies: one that moves to another code is a room of its own', async () => {
    const tab = await load(game); // room A, an empty lobby
    const second = await load(game); // the same, in a second tab: A's code is taken there
    const [room, code] = [tab.link.room, tab.game!.code];
    expect(second.link.room).toBe(room);
    (second.link as unknown as { peer: { on_: Handlers } }).peer.on_.error({ type: 'unavailable-id' });
    expect(second.game!.code).not.toBe(code);
    expect(second.link.room).not.toBe(room);
    expect(JSON.parse(localStorage.getItem(`hr:${game}:host`)!)).toMatchObject({ code: second.game!.code, room: second.link.room });
    expect(JSON.parse(localStorage.getItem(`hr:${game}:seats`)!)).toEqual({ room: second.link.room, keys: [], kicked: [] });

    // Sam joins A; a guest enrols Sam's id in the other; then A saves its game and reloads.
    phone(tab.link, 'p1', 'Sam');
    await vi.advanceTimersByTimeAsync(1000); // the second tab's new peer
    const guest = phone(second.link, 'p1', 'Guest');
    expect(guest.types()).toContain('welcome');
    expect(tab.addBot()).toBeNull();
    const host = await load(game);
    expect(host.game!.code).toBe(code);
    const thief = phone(host.link, 'p1', 'Sam', guest.key);
    expect(thief.types()).toEqual(['wait']);
    close(host);
  });

  it('with the record missing, and old pages, need the host; bots come back by themselves', async () => {
    let host = await load(game);
    const sam = phone(host.link, 'p1', 'Sam');
    expect(host.addBot()).toBeNull();
    localStorage.removeItem(`hr:${game}:seats`);
    host = await load(game);
    expect(host.link.pids()).toEqual([expect.stringMatching(/^bot-/)]);
    const back = phone(host.link, 'p1', 'Sam', sam.key);
    expect(back.types()).toEqual(['wait']);
    host.link.answer(host.link.asks[0], true);
    expect(back.types()).toEqual(['wait', 'enrol', 'welcome', 'view']);

    const old = phone(host.link, 'p5', 'Old', undefined, false);
    expect(old.types()).toEqual(['wait']);
    expect(askText(host.link.asks[0])).toBe('Let Old join from a phone that shows no number?');
    host.link.answer(host.link.asks[0], true);
    expect(old.types()).toEqual(['wait', 'welcome', 'view']);
    const redial = phone(host.link, 'p5', 'Old', undefined, false);
    expect(redial.types()).toEqual([]); // its other connection is still alive: later, without a word
    expect([redial.conn.open, old.conn.open]).toEqual([false, true]);
    old.conn.close();
    const again = phone(host.link, 'p5', 'Old', undefined, false);
    expect(again.types()).toEqual(['wait']);
    again.conn.close();
    expect(host.link.asks).toEqual([]);
    close(host);
  });
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

it('a claim still being checked ends when its seat is left, or the room moves to another code', async () => {
  const host = await load('hand');
  const sam = phone(host.link, 'p1', 'Sam');
  const twin = phone(host.link, 'p1', 'Sam', sam.key);
  sam.say({ t: 'leave' });
  expect(twin.conn.open).toBe(false);
  await settle(twin);
  expect(host.link.pids()).toEqual([]);

  const old = phone(host.link, 'p5', 'Old', undefined, false);
  const slow = phone(host.link, 'p6', 'Slow', undefined, true, { mute: true });
  const asked = host.link.asks[0];
  (host.link as unknown as { peer: { on_: Handlers } }).peer.on_.error({ type: 'unavailable-id' });
  expect(host.link.asks).toEqual([]);
  host.link.answer(asked, true);
  slow.say({ t: 'key', key: newKey() });
  expect([old.types(), slow.types()]).toEqual([['wait'], ['enrol']]);
  expect(host.link.pids()).toEqual([]);
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

describe('a question to the host', () => {
  const room = async () => {
    const host = await load('hand');
    const sam = phone(host.link, 'p1', 'Sam');
    sam.conn.close();
    return { host, sam };
  };
  const ask = async (host: Host, pid = 'p9') => {
    const p = phone(host.link, pid, 'Sam');
    await settle(p);
    return p;
  };

  it('ends when the owner returns with the key, or after a minute', async () => {
    const { host, sam } = await room();
    const first = await ask(host);
    expect((await ask(host, 'p7')).got.at(-1)).toMatchObject({ t: 'reject' }); // one per seat
    const back = phone(host.link, 'p1', 'Sam', sam.key);
    await settle(back);
    expect(back.types()).toContain('welcome');
    expect(first.conn.open).toBe(false);
    expect(host.link.asks).toEqual([]);
    back.conn.close();
    const second = await ask(host);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(why(second)).toBe('The host did not answer. Try again.');
    close(host);
  });

  const far = (who: string): Sdp => ({ currentLocalDescription: sdp('HOST'), currentRemoteDescription: sdp(who) });
  const near = (who: string): Sdp => ({ currentLocalDescription: sdp('SAM'), currentRemoteDescription: sdp(who) });
  const numbered = (host: Host, opts: { near?: Sdp; far?: Sdp; reveal?: string | null } = {}) =>
    phone(host.link, 'p9', 'Sam', undefined, true, { near: near('HOST'), far: far('SAM'), ...opts });
  const waits = async (p: Phone) => { await until(() => p.types().includes('wait') || !p.conn.open); return p; };
  /** The number the phone works out from what it was sent. */
  const shown = (p: Phone) => {
    const { here, there } = ends(p.conn.peerConnection);
    return numberOf({ hostValue: p.got.at(-1)!.value as string, phoneValue: p.value, host: there, phone: here });
  };

  it('carries the number both ends work out, never sent; a guest in between leaves another on the phone', async () => {
    const { host } = await room();
    const seen: string[] = [];
    // The second phone is Sam's behind a guest who passes every message on, both ways.
    for (const guest of [false, true]) {
      const p = await waits(numbered(host, guest ? { near: near('GUEST'), far: far('GUEST') } : {}));
      expect(p.got.at(-1)).toEqual({ t: 'wait', value: expect.stringMatching(/^[0-9a-f]{32}$/) });
      await until(() => host.link.asks.length > 0);
      const number = await shown(p);
      expect(number).toMatch(/^\d{3} \d{3}$/);
      const text = askText(host.link.asks[0]);
      if (guest) expect(text).not.toContain(number);
      else expect(text).toBe(`Move Sam’s seat to the phone showing ${number}?`);
      seen.push(p.got.at(-1)!.value as string);
      p.say({ t: 'reveal', value: newKey() }); // once each
      await until(() => !p.conn.open, 10);
      expect(askText(host.link.asks[0])).toBe(text);
      host.link.answer(host.link.asks[0], true);
      expect(p.types()).toContain('welcome');
      p.conn.close();
    }
    expect(seen[0]).not.toBe(seen[1]);
    const e = { hostValue: 'h', phoneValue: 'p', host: 'H', phone: 'P' };
    const all = [e, { ...e, hostValue: 'x' }, { ...e, phoneValue: 'x' }, { ...e, host: 'x' }, { ...e, phone: 'x' }];
    expect(new Set(await Promise.all(all.map(numberOf))).size).toBe(5);
    close(host);
  });

  it('never comes from a phone that shows another value than its hello promised, or none; and its seat rests', async () => {
    const { host } = await room();
    const other = await waits(numbered(host, { reveal: newKey() }));
    await until(() => !other.conn.open);
    expect([other.conn.open, host.link.asks]).toEqual([false, []]);
    const soon = numbered(host);
    await until(() => !soon.conn.open);
    expect([soon.types(), soon.conn.open]).toEqual([['prove'], false]);

    await vi.advanceTimersByTimeAsync(5000);
    const silent = await waits(numbered(host, { reveal: null }));
    expect(silent.types()).toEqual(['prove', 'wait']);
    const old = phone(host.link, 'p5', 'Old', undefined, false);
    expect(host.link.asks).toMatchObject([{ name: 'Old', code: null }]);
    old.conn.close();
    await vi.advanceTimersByTimeAsync(10_000);
    expect([silent.conn.open, host.link.asks]).toEqual([false, []]);

    await vi.advanceTimersByTimeAsync(5000);
    await waits(numbered(host));
    await until(() => host.link.asks.length > 0);
    expect(host.link.asks).toHaveLength(1);
    close(host);
  });

  it('is for that connection alone, and so is its Yes', async () => {
    const { host } = await room();
    const first = await ask(host);
    const asked = host.link.asks[0];
    expect(askText(asked)).toBe('Move Sam’s seat to a phone that shows no number?'); // no certificates here

    // The same claim again: turned back while the first connection lives, a new question once it sleeps.
    const copy = await ask(host);
    expect([copy.types(), copy.conn.open, host.link.asks]).toEqual([['prove'], false, [asked]]);
    first.asleep = true;
    await vi.advanceTimersByTimeAsync(6000);
    const second = await ask(host);
    expect(first.conn.open).toBe(false);
    expect(host.link.asks).toHaveLength(1);
    expect(host.link.asks[0].id).not.toBe(asked.id);
    host.link.answer(asked, true);
    expect(second.types()).toEqual(['prove', 'wait']);

    // A Yes the phone did not live to hear is spent: whoever says the same next is asked about.
    second.conn.other!.send = () => {};
    host.link.answer(host.link.asks[0], true);
    const thief = await ask(host, 'p6');
    expect(why(thief)).toMatch(/Another phone/);
    second.conn.close();
    const third = await ask(host);
    expect(third.types()).toEqual(['prove', 'wait']);
    close(host);
  });

  it('a new seat being enrolled is kept for that phone', async () => {
    const host = await load('hand');
    const slow = phone(host.link, 'p1', 'Sam', undefined, true, { mute: true });
    expect(slow.types()).toEqual(['enrol']);
    expect(why(phone(host.link, 'p1', 'Sam', undefined, false))).toMatch(/Another phone/);
    slow.say({ t: 'key', key: newKey() });
    expect(slow.types()).toContain('welcome');
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
    expect(host.link.asks).toEqual([]);
    close(host);
  });

  it('waits with its own words, and the number the host screen shows in a place no host text goes', async () => {
    const host = await load('snark');
    const owner = phone(host.link, 'p1', 'Sam');
    owner.conn.close();
    net.secure = true;
    const { PhoneLink } = await import('./phone-link.svelte');
    const p = new PhoneLink<{ t: string }, BaseView>('snark', { keep: () => false });
    const sent: { t: string; commit?: string; value?: string }[] = [];
    const inner = p as unknown as { write(m: object): void; receive(m: object): void };
    const write = inner.write.bind(p);
    inner.write = (m) => { sent.push(JSON.parse(JSON.stringify(m)) as { t: string }); write(m); };
    p.join(host.game!.code, 'Sam');
    await until(() => !!p.number && host.link.asks.length > 0);
    expect(p.trouble).toBe('Waiting for a Yes on the host screen.');
    expect(askText(host.link.asks[0])).toBe(`Move Sam’s seat to the phone showing ${p.number}?`);
    expect(sent.map((m) => m.t)).toEqual(['hello', 'proof', 'reveal']);
    expect(sent[0].commit).toBe(await commitOf(sent[2].value!));
    expect(JSON.stringify(sent)).not.toContain(p.number);

    // Told to wait again, with any words: nothing more is sent, nothing changes.
    const number = p.number;
    inner.receive({ t: 'wait', value: newKey(), why: 'Your number is 111 111.' });
    await until(() => p.number !== number, 10);
    expect([p.number, p.trouble, sent.length]).toEqual([number, 'Waiting for a Yes on the host screen.', 3]);

    host.link.answer(host.link.asks[0], true);
    await until(() => p.link === 'live');
    expect([p.link, p.number, p.trouble]).toEqual(['live', '', '']);
    // Back with its key: a new promise, nothing else more.
    sent.length = 0;
    (p as unknown as { conn: End }).conn.close();
    await vi.advanceTimersByTimeAsync(1000);
    await until(() => p.link === 'live');
    expect(sent.map((m) => m.t)).toEqual(['hello', 'proof']);
    expect(sent[0].commit).toMatch(/^[0-9a-f]{64}$/);

    // A fake host's refusal: its text is the reason it stopped, never the number.
    inner.receive({ t: 'wait', value: newKey() });
    await until(() => !!p.number);
    expect(p.number).not.toBe('');
    inner.receive({ t: 'reject', why: 'Your number is 111 111.' });
    await until(() => !!p.number, 10);
    expect([p.number, p.stopped]).toEqual(['', 'Your number is 111 111.']);
    close(host);
  });

  it('shows no number, and promises none, where there is nothing to work it out from', async () => {
    const host = await load('snark');
    const p = await join(host);
    (p as unknown as { receive(m: object): void }).receive({ t: 'wait', value: newKey() });
    await until(() => !!p.number, 10);
    expect([p.number, p.trouble]).toEqual(['', 'Waiting for a Yes on the host screen.']);
    vi.stubGlobal('crypto', { getRandomValues: (x: Uint8Array) => x });
    expect([await commitOf('a'), await numberOf({ hostValue: 'a', phoneValue: 'b', host: 'H', phone: 'P' })]).toEqual(['', null]);
    close(host);
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
