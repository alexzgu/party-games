import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KeyRing, ends, newKey, nextStep, proofOf, type Claim, type Held, type Step } from './seats';
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
      open: true, destroyed: false, disconnected: false, destroy: () => {}, reconnect: () => {},
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
const settle = (p: Phone) => until(() => p.types().at(-1) !== 'prove');

interface Phone { got: { t: string; [k: string]: unknown }[]; conn: End; key?: string; asleep?: boolean; say(m: object): void; types(): string[] }
/** A phone's page: says hello and answers the handshake as the app does (`modern`), with the key it has. */
function phone(link: HostLink, pid: string, name: string, key?: string, modern = true, secure: { near?: Sdp; far?: Sdp } = {}): Phone {
  const [near, far] = [end(), end()];
  near.other = far;
  far.other = near;
  near.peerConnection = secure.near;
  far.peerConnection = secure.far;
  const p: Phone = { got: [], conn: near, key, say: (m) => near.send(m), types: () => p.got.map((m) => m.t) };
  near.on('data', (raw) => {
    const m = raw as Phone['got'][number];
    if (m.t === 'ping') return p.asleep ? undefined : near.send({ t: 'pong' });
    p.got.push(m);
    if (m.t === 'enrol') { p.key = newKey(); near.send({ t: 'key', key: p.key }); }
    if (m.t === 'prove') {
      const { here, there } = ends(near.peerConnection);
      void proofOf(p.key, { room: m.room as string, nonce: m.nonce as string, host: there, phone: here }).then((mac) => near.send({ t: 'proof', mac }));
    }
  });
  (link as unknown as { accept(c: unknown): void }).accept(far);
  p.say({ t: 'hello', pid, name, ...(modern ? { keys: 1 } : {}) });
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
});

it('decides each step from the proof, the key on record and the host', () => {
  const c = (x: Partial<Claim> = {}): Claim => ({ modern: true, proof: 'none', approved: false, ...x });
  const s = (x: Partial<Held> = {}): Held => ({ keyed: false, fresh: false, online: false, ...x });
  const refused = { refuse: expect.any(String) };
  const cases: [Claim, Held, unknown][] = [
    [c(), s({ fresh: true }), 'enrol'],
    [c(), s(), 'ask'],
    [c({ approved: true }), s(), 'enrol'],
    [c({ modern: false }), s({ fresh: true }), 'ask'],
    [c({ modern: false, approved: true }), s(), 'admit'],
    [c({ modern: false, approved: true }), s({ keyed: true }), refused],
    [c(), s({ keyed: true, online: true }), 'prove'],
    [c({ proof: 'right' }), s({ keyed: true, online: true }), 'admit'],
    [c({ proof: 'wrong' }), s({ keyed: true }), 'ask'],
    [c({ proof: 'wrong', approved: true }), s({ keyed: true }), 'enrol'],
    [c({ proof: 'wrong', approved: true }), s({ keyed: true, online: true }), refused],
  ];
  for (const [claim, held, step] of cases) expect(nextStep(claim, held), JSON.stringify([claim, held])).toEqual(step as Step);
});

it('a phone keeps one key per room, in memory when storage is blocked, and proves it without showing it', async () => {
  const [a, b] = [newKey(), newKey()];
  const ring = new KeyRing('snark');
  const key = ring.make(a);
  expect(new KeyRing('snark').get(a)).toBe(key);
  expect(ring.get(b)).toBeUndefined();
  expect(ring.make(a)).not.toBe(key);
  vi.stubGlobal('localStorage', undefined);
  const held = ring.make(b);
  expect(ring.get(b)).toBe(held);
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
    expect(host.link.asks).toMatchObject([{ name: 'Old', fresh: true }]);
    host.link.answer(host.link.asks[0], true);
    expect(old.types()).toEqual(['wait', 'welcome', 'view']);
    const redial = phone(host.link, 'p5', 'Old', undefined, false);
    expect(redial.types()).toEqual(['wait']);
    redial.conn.close();
    expect(host.link.asks).toEqual([]);
    close(host);
  });
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

  it('and its Yes both outlast the phone\'s sleep', async () => {
    const { host } = await room();
    const asleep = await ask(host);
    const asked = host.link.asks[0];
    asleep.asleep = true;
    await vi.advanceTimersByTimeAsync(6000);
    const awake = await ask(host);
    expect(asleep.conn.open).toBe(false);
    expect(host.link.asks).toEqual([asked]);
    // Yes, but the phone is gone again before it hears.
    awake.conn.other!.send = () => {};
    host.link.answer(asked, true);
    awake.conn.close();
    const third = await ask(host);
    expect(third.types()).toEqual(['prove', 'enrol', 'welcome', 'view']);
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
    expect(sent).toMatchObject([{ t: 'hello', keys: 1 }, { t: 'proof', mac: expect.stringMatching(/^[0-9a-f]{64}$/) }]);
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
