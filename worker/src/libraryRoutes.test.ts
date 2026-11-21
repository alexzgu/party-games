// The community library through the worker's fetch handler: fake env, the Library object on an
// in-memory SQLite database, passes from the fake magic words. No network, no real secret.
import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from './index';
import { LIBRARY } from './library';
import { untilTomorrow } from './limits';
import { SITE, fakeCtx, fakeEnv, fakeLibrary, fakeSql } from './testing';
import { EXPORT_PAGE } from './libraryObject';
import type { Env } from './env';

const W = 'https://jerkbox-wizard.test';
let ip = 0;

function call(env: Env, path: string, init: RequestInit & { pass?: string } = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has('origin')) headers.set('origin', SITE);
  if (!headers.get('origin')) headers.delete('origin'); // origin '' stands for a tool with no Origin
  if (init.pass) headers.set('authorization', `Bearer ${init.pass}`);
  headers.set('cf-connecting-ip', `203.0.113.${ip}`);
  return worker.fetch(new Request(W + path, { ...init, headers }), env, fakeCtx());
}
const body = async <T = Record<string, unknown>>(r: Response | Promise<Response>) => (await (await r).json()) as T;

/** A fresh pass, each from its own address so the daily redemption cap never bites. */
async function passFor(env: Env): Promise<string> {
  ip++;
  const res = await call(env, '/redeem', { method: 'POST', body: JSON.stringify({ phrase: 'test phrase one' }) });
  expect(res.status).toBe(200);
  return (await body<{ token: string }>(res)).token;
}

const PACK = { game: 'dial', name: 'Road Trip', blurb: 'Snacks, maps and 100% fights', localId: 'my-road-trip', items: [{ left: 'Bad snack', right: 'Good snack' }] };
const publish = (env: Env, pass: string, over: Record<string, unknown> = {}) =>
  call(env, '/library/packs', { method: 'POST', pass, body: JSON.stringify({ ...PACK, ...over }) });
type Listed = { packs: { id: string; name: string; stars: number; count: number; starred?: boolean }[]; more: boolean };
const list = (env: Env, query = '', pass?: string) => body<Listed>(call(env, `/library/packs${query}`, { pass }));
const names = async (env: Env, query = '') => (await list(env, query)).packs.map((p) => p.name);

afterEach(() => vi.restoreAllMocks());

describe('library', () => {
  it('publishes with a pass, updates the same pack from the same pass, and lists for anyone', async () => {
    const env = fakeEnv();
    expect((await publish(env, '')).status).toBe(401);
    const pass = await passFor(env);
    const first = await body<{ id: string; created: boolean }>(publish(env, pass));
    expect(first).toEqual({ id: expect.stringMatching(/^[\w-]{12}$/), created: true });
    const again = await body(publish(env, pass, { name: 'Road Trip 2', items: [...PACK.items, { left: 'Short drive', right: 'Long drive' }] }));
    expect(again).toEqual({ id: first.id, created: false });
    // Another pass with the same phone id is another entry.
    expect((await body(publish(env, await passFor(env)))).created).toBe(true);
    const all = await list(env);
    expect(all.packs.map((p) => [p.name, p.count])).toEqual([['Road Trip', 1], ['Road Trip 2', 2]]);
    const one = await body<{ pack: Record<string, unknown> }>(call(env, `/library/packs/${first.id}`));
    expect(one.pack).toMatchObject({ id: first.id, game: 'dial', name: 'Road Trip 2', count: 2, stars: 0, items: [PACK.items[0], { left: 'Short drive', right: 'Long drive' }], extra: {} });
    expect(one.pack).not.toHaveProperty('owner');
    expect((await call(env, '/library/packs/AAAAAAAAAAAA')).status).toBe(404);
  });

  it('refuses a pack it cannot take, with 400, and an oversized body with 413', async () => {
    const env = fakeEnv();
    const pass = await passFor(env);
    const bad = await publish(env, pass, { game: 'salad' });
    expect(bad.status).toBe(400);
    expect((await body<{ error: { type: string } }>(bad)).error.type).toBe('invalid_request_error');
    expect((await publish(env, pass, { items: Array.from({ length: 401 }, (_, i) => ({ left: `a${i}`, right: `b${i}` })) })).status).toBe(400);
    expect((await publish(env, pass, { blurb: 'x'.repeat(80_000) })).status).toBe(413);
  });

  it('searches names and blurbs only, any case, with % and _ as plain characters; filters by game; pages by 30', async () => {
    const env = fakeEnv();
    const pass = await passFor(env);
    await publish(env, pass);
    await publish(env, pass, { localId: 'b', name: 'Office Party', blurb: 'Printer_jams', items: [{ left: 'Road', right: 'Trip' }] });
    await publish(env, pass, { localId: 'c', game: 'quick', name: 'Quick Road', blurb: '', items: ['things in a car'] });
    expect(await names(env, '?q=ROAD')).toEqual(['Quick Road', 'Road Trip']);
    expect(await names(env, '?game=dial&q=road')).toEqual(['Road Trip']);
    expect(await names(env, '?q=100%25')).toEqual(['Road Trip']);
    expect(await names(env, '?q=r_jams')).toEqual(['Office Party']);
    expect(await names(env, '?q=%25')).toEqual(['Road Trip']);
    expect(await names(env, '?q=_')).toEqual(['Office Party']);
    expect((await call(env, '/library/packs?sort=best')).status).toBe(400);
    for (let i = 0; i < LIBRARY.pageSize; i++) await publish(env, pass, { localId: `p${i}`, name: `Pack ${i}` });
    const page1 = await list(env, '?game=dial');
    const page2 = await list(env, '?game=dial&page=2');
    expect([page1.packs.length, page1.more, page2.packs.length, page2.more]).toEqual([30, true, 2, false]);
  });

  it('stars once per pass, lists the most stars first, then newest, and marks what the pass starred', async () => {
    const env = fakeEnv();
    const [a, b] = [await passFor(env), await passFor(env)];
    let t = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => (t += 1000));
    const old = await body<{ id: string }>(publish(env, a, { localId: 'old', name: 'Old' }));
    const mid = await body<{ id: string }>(publish(env, a, { localId: 'mid', name: 'Mid' }));
    await publish(env, a, { localId: 'new', name: 'New' });
    expect(await names(env)).toEqual(['New', 'Mid', 'Old']);
    const star = (id: string, pass: string, method = 'POST') => call(env, `/library/packs/${id}/star`, { method, pass });
    expect((await star(old.id, '')).status).toBe(401);
    expect(await body(star(old.id, a))).toEqual({ stars: 1, starred: true });
    expect(await body(star(old.id, a))).toEqual({ stars: 1, starred: true });
    expect(await body(star(old.id, b))).toEqual({ stars: 2, starred: true });
    expect(await body(star(mid.id, b))).toEqual({ stars: 1, starred: true });
    expect(await names(env)).toEqual(['Old', 'Mid', 'New']);
    expect(await names(env, '?sort=new')).toEqual(['New', 'Mid', 'Old']);
    expect((await list(env, '', a)).packs.map((p) => p.starred)).toEqual([true, false, false]);
    expect((await list(env)).packs[0]).not.toHaveProperty('starred');
    expect(await body(star(old.id, a, 'DELETE'))).toEqual({ stars: 1, starred: false });
    expect(await body(star(old.id, a, 'DELETE'))).toEqual({ stars: 1, starred: false });
    expect((await star('AAAAAAAAAAAA', a)).status).toBe(404);
  });

  it(`takes ${LIBRARY.publishesPerSessionPerDay} publishes per pass and ${LIBRARY.publishesPerDay} in all per UTC day`, async () => {
    const env = fakeEnv();
    const pass = await passFor(env);
    let now = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    for (let i = 0; i < LIBRARY.publishesPerSessionPerDay; i++) expect((await publish(env, pass)).status).toBe(200);
    const refused = await publish(env, pass);
    expect([refused.status, refused.headers.get('x-wizard-reason'), refused.headers.get('access-control-allow-origin')]).toEqual([429, 'library', SITE]);
    expect(Number(refused.headers.get('retry-after'))).toBe(Math.ceil(untilTomorrow(now)));
    now += untilTomorrow(now) * 1000 + 1000;
    expect((await publish(env, pass)).status).toBe(200);

    const everyone = fakeEnv();
    const saved = LIBRARY.publishesPerDay;
    LIBRARY.publishesPerDay = 3;
    try {
      for (let i = 0; i < 3; i++) expect((await publish(everyone, await passFor(everyone))).status).toBe(200);
      const full = await publish(everyone, await passFor(everyone));
      expect([full.status, full.headers.get('x-wizard-reason')]).toEqual([429, 'library']);
    } finally {
      LIBRARY.publishesPerDay = saved;
    }
  });

  it('hides a pack only with the owner secret, and never without one set', async () => {
    const pass = await passFor(fakeEnv());
    for (const secret of [undefined, '']) {
      const env = fakeEnv({ LIBRARY_ADMIN: secret });
      const { id } = await body<{ id: string }>(publish(env, pass));
      for (const auth of ['', 'Bearer ', 'Bearer undefined', 'Bearer x']) {
        expect((await call(env, `/library/packs/${id}/hide`, { method: 'POST', headers: { authorization: auth } })).status).toBe(403);
      }
    }
    const env = fakeEnv({ LIBRARY_ADMIN: 'fake-admin-secret-for-tests' });
    const { id } = await body<{ id: string }>(publish(env, pass));
    const hide = (auth: string, hidden?: boolean) =>
      call(env, `/library/packs/${id}/hide`, { method: 'POST', headers: { authorization: auth }, body: hidden === undefined ? undefined : JSON.stringify({ hidden }) });
    expect((await hide('Bearer fake-admin-secret-for-test', true)).status).toBe(403);
    // Only an explicit {"hidden": true|false} changes anything; a long body is refused unread.
    expect((await hide('Bearer fake-admin-secret-for-tests')).status).toBe(400);
    const long = await call(env, `/library/packs/${id}/hide`, { method: 'POST', headers: { authorization: 'Bearer fake-admin-secret-for-tests' }, body: JSON.stringify({ hidden: true, pad: 'x'.repeat(300) }) });
    expect(long.status).toBe(413);
    expect(await names(env)).toEqual(['Road Trip']);
    expect((await hide('Bearer fake-admin-secret-for-tests', true)).status).toBe(200);
    expect(await names(env)).toEqual([]);
    expect((await call(env, `/library/packs/${id}`)).status).toBe(404);
    expect((await body<{ packs: unknown[] }>(call(env, '/library/export'))).packs).toEqual([]);
    // An update from its owner leaves it hidden.
    await publish(env, pass, { name: 'Back again?' });
    expect(await names(env)).toEqual([]);
    expect((await hide('Bearer fake-admin-secret-for-tests', false)).status).toBe(200);
    expect(await names(env)).toEqual(['Back again?']);
  });

  it(`exports every pack that is not hidden, without owners, ${EXPORT_PAGE} a page by a cursor`, async () => {
    const env = fakeEnv();
    const pass = await passFor(env);
    let t = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => (t += 1000));
    await publish(env, pass, { game: 'forehead', items: ['Shrek'], extra: { emoji: '📺' } });
    for (let i = 0; i < EXPORT_PAGE; i++) await publish(env, pass, { localId: `p${i}`, name: `Pack ${i}` });
    type Page = { packs: Record<string, unknown>[]; next: string | null };
    const first = await body<Page>(call(env, '/library/export', { headers: { origin: '' } }));
    expect(first.packs).toHaveLength(EXPORT_PAGE);
    expect(first.packs[0]).toMatchObject({ game: 'forehead', items: ['Shrek'], extra: { emoji: '📺' } });
    expect(Object.keys(first.packs[0]).sort()).toEqual(['blurb', 'count', 'created', 'extra', 'game', 'id', 'items', 'name', 'stars', 'updated']);
    expect(first.next).toMatch(/^\d+:[\w-]{12}$/);
    // A pack published meanwhile comes after the cursor, so nothing is skipped or repeated.
    await publish(env, pass, { localId: 'late', name: 'Late' });
    const second = await body<Page>(call(env, `/library/export?after=${first.next}`));
    expect(second.packs.map((p) => p.name)).toEqual([`Pack ${EXPORT_PAGE - 1}`, 'Late']);
    expect(second.next).toBeNull();
    expect((await call(env, '/library/export?after=nope')).status).toBe(400);
  });

  it('stores the username sent with a pack and returns it in the list, the preview and the export', async () => {
    const env = fakeEnv();
    const pass = await passFor(env);
    const { id } = await body<{ id: string }>(publish(env, pass, { username: '  Sneaky   Otter ' }));
    await publish(env, pass, { localId: 'old-app', name: 'Old App' }); // an app from before usernames
    await publish(env, pass, { localId: 'bad', name: 'Bad Name', username: 'x'.repeat(25) });
    type Row = Record<string, unknown>;
    const rows = (await body<{ packs: Row[] }>(call(env, '/library/packs?sort=new'))).packs;
    expect(Object.fromEntries(rows.map((p) => [p.name, p.username]))).toEqual({ 'Bad Name': undefined, 'Old App': undefined, 'Road Trip': 'Sneaky Otter' });
    expect(rows.filter((p) => Object.hasOwn(p, 'username'))).toHaveLength(1);
    expect((await body<{ pack: Row }>(call(env, `/library/packs/${id}`))).pack.username).toBe('Sneaky Otter');
    const exported = (await body<{ packs: Row[] }>(call(env, '/library/export'))).packs;
    expect(exported.map((p) => p.username).sort()).toEqual(['Sneaky Otter', undefined, undefined]);
    // Search stays names and descriptions only.
    expect(await names(env, '?q=otter')).toEqual([]);
    // An update carries the username it is sent with.
    await publish(env, pass, { username: 'Jolly Moose' });
    expect((await body<{ pack: Row }>(call(env, `/library/packs/${id}`))).pack.username).toBe('Jolly Moose');
  });

  it('adds the username column to a library stored before usernames, keeping its packs', async () => {
    const sql = fakeSql();
    sql.exec(`CREATE TABLE packs (
      id TEXT PRIMARY KEY, game TEXT NOT NULL, name TEXT NOT NULL, blurb TEXT NOT NULL,
      count INTEGER NOT NULL, items TEXT NOT NULL, extra TEXT NOT NULL DEFAULT '{}', search TEXT NOT NULL,
      created INTEGER NOT NULL, updated INTEGER NOT NULL, stars INTEGER NOT NULL DEFAULT 0,
      hidden INTEGER NOT NULL DEFAULT 0, owner TEXT NOT NULL, local_id TEXT NOT NULL)`);
    sql.exec(`INSERT INTO packs (id, game, name, blurb, count, items, search, created, updated, owner, local_id)
      VALUES ('AAAAAAAAAAAA', 'dial', 'Older', '', 1, '[{"left":"A","right":"B"}]', 'older
', 1, 1, 'someone', 'x')`);
    const env = fakeEnv({ LIBRARY: fakeLibrary(sql) });
    fakeLibrary(sql); // the object waking again finds the column there
    await publish(env, await passFor(env), { username: 'Jolly Moose' });
    const rows = (await body<{ packs: Record<string, unknown>[] }>(call(env, '/library/packs?sort=new'))).packs;
    expect(Object.fromEntries(rows.map((p) => [p.name, p.username]))).toEqual({ 'Road Trip': 'Jolly Moose', Older: undefined });
  });

  it('writes nothing for a vote that changes nothing', async () => {
    const sql = fakeSql();
    const writes: string[] = [];
    const counting = { exec: <T>(q: string, ...b: (string | number | null)[]) => { if (!/^\s*SELECT/i.test(q)) writes.push(q); return sql.exec<T>(q, ...b); } };
    const env = fakeEnv({ LIBRARY: fakeLibrary(counting) });
    const pass = await passFor(env);
    const { id } = await body<{ id: string }>(publish(env, pass));
    const star = (method: string) => body(call(env, `/library/packs/${id}/star`, { method, pass }));
    expect(await star('POST')).toEqual({ stars: 1, starred: true });
    const before = writes.length;
    expect(await star('POST')).toEqual({ stars: 1, starred: true });
    expect(await star('DELETE')).toEqual({ stars: 0, starred: false });
    expect(await star('DELETE')).toEqual({ stars: 0, starred: false });
    expect(writes.length).toBe(before + 2); // the DELETE and the count, once
  });

  it(`searches only the first ${LIBRARY.searchScan} packs of the order`, async () => {
    const env = fakeEnv();
    const pass = await passFor(env);
    let t = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => (t += 1000));
    for (const n of ['Road A', 'Road B', 'Road C']) await publish(env, pass, { localId: n, name: n });
    const saved = LIBRARY.searchScan;
    LIBRARY.searchScan = 2;
    try {
      expect(await names(env, '?sort=new&q=road')).toEqual(['Road C', 'Road B']);
    } finally {
      LIBRARY.searchScan = saved;
    }
  });

  it('answers preflights for its methods, refuses other sites and wrong methods', async () => {
    const env = fakeEnv();
    const pre = await call(env, '/library/packs/AAAAAAAAAAAA/star', { method: 'OPTIONS', headers: { 'access-control-request-method': 'DELETE', 'access-control-request-headers': 'authorization' } });
    expect([pre.status, pre.headers.get('access-control-allow-methods'), pre.headers.get('access-control-allow-headers')]).toEqual([204, 'GET, POST, DELETE, OPTIONS', 'authorization']);
    expect((await call(env, '/library/packs', { headers: { origin: 'https://evil.example' } })).status).toBe(403);
    expect((await call(env, '/library/export', { method: 'POST' })).status).toBe(405);
    expect((await call(env, '/library/packs/not-an-id')).status).toBe(404);
    expect((await call(env, '/library/nothing')).status).toBe(404);
    const listed = await call(env, '/library/packs');
    expect([listed.status, listed.headers.get('access-control-allow-origin')]).toEqual([200, SITE]);
  });
});
