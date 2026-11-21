// The one Durable Object (named "library") that keeps every shared pack and star in its SQLite
// storage. Cloudflare runs one request at a time through it, and each request's SQL below runs
// with no await in between, so every check-and-write is atomic (and committed together).
import type { DurableObjectNamespaceLike, SqlStateLike, SqlStorageLike, SqlValue } from './env';
import { LIBRARY, searchText, type LibraryGame, type ListQuery, type PublishPack } from './library';
import { toBase64url } from './crypto';
import { untilTomorrow, utcDay } from './limits';

export type LibraryOp =
  /** `owner` is the publishing pass's session label (pass.ts). */
  | { op: 'publish'; owner: string; pack: PublishPack }
  /** `viewer`, when the request had a valid pass, marks the packs it starred. */
  | { op: 'list'; query: ListQuery; viewer?: string }
  | { op: 'get'; id: string; viewer?: string }
  | { op: 'star'; id: string; who: string; on: boolean }
  /** One page of the export, after `after` (a cursor from the page before). */
  | { op: 'export'; after: ExportCursor | null }
  | { op: 'hide'; id: string; hidden: boolean };

/** A pack as listed: no items, no owner. */
export interface PackSummary {
  id: string;
  game: LibraryGame;
  name: string;
  blurb: string;
  count: number;
  stars: number;
  /** Milliseconds since 1970. */
  created: number;
  updated: number;
  starred?: boolean;
  /** Only for packs shared with one. */
  username?: string;
}

export interface FullPack extends PackSummary {
  items: unknown[];
  extra: Record<string, unknown>;
}

/** Where an export page ends: packs are exported by creation time, then id, which never change. */
export interface ExportCursor { created: number; id: string }

/** Packs per export page: each holds at most 64 KB of items, so a page stays near 1 MB at most. */
export const EXPORT_PAGE = 16;

export type LibraryReply =
  | { ok: true; id: string; created: boolean }
  | { ok: true; packs: PackSummary[]; more: boolean }
  | { ok: true; pack: FullPack }
  | { ok: true; stars: number; starred: boolean }
  | { ok: true }
  | { ok: false; status: 404 }
  | { ok: false; status: 429; scope: 'phone' | 'everyone'; retryAfter: number };

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS packs (
    id TEXT PRIMARY KEY, game TEXT NOT NULL, name TEXT NOT NULL, blurb TEXT NOT NULL,
    count INTEGER NOT NULL, items TEXT NOT NULL, extra TEXT NOT NULL DEFAULT '{}', search TEXT NOT NULL,
    created INTEGER NOT NULL, updated INTEGER NOT NULL, stars INTEGER NOT NULL DEFAULT 0,
    hidden INTEGER NOT NULL DEFAULT 0, owner TEXT NOT NULL, local_id TEXT NOT NULL)`,
  'CREATE UNIQUE INDEX IF NOT EXISTS packs_by_owner ON packs (owner, game, local_id)',
  'CREATE INDEX IF NOT EXISTS packs_by_stars ON packs (game, hidden, stars DESC, updated DESC)',
  'CREATE INDEX IF NOT EXISTS packs_by_new ON packs (game, hidden, updated DESC)',
  'CREATE TABLE IF NOT EXISTS stars (pack_id TEXT NOT NULL, who TEXT NOT NULL, PRIMARY KEY (pack_id, who)) WITHOUT ROWID',
  /** Publishes counted per UTC day: by pass label, and '*' for everyone. */
  'CREATE TABLE IF NOT EXISTS publishes (day TEXT NOT NULL, who TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (day, who)) WITHOUT ROWID',
];

/**
 * Columns added to `packs` after it was first deployed, each added once when missing. NULL in
 * packs from before (an old app's packs too): those have no username.
 */
const ADDED_COLUMNS = [{ name: 'username', type: 'TEXT' }];

/** True when `packs` has the column (`PRAGMA table_info`, which Durable Object SQLite allows). */
function hasColumn(sql: SqlStorageLike, name: string): boolean {
  return sql.exec('PRAGMA table_info(packs)').toArray().some((c) => c.name === name);
}

const SUMMARY = 'id, game, name, blurb, count, stars, created, updated, username';
type Row = Record<string, SqlValue>;
const EVERYONE = '*';

const summary = (r: Row): PackSummary => ({
  id: String(r.id), game: r.game as LibraryGame, name: String(r.name), blurb: String(r.blurb),
  count: Number(r.count), stars: Number(r.stars), created: Number(r.created), updated: Number(r.updated),
  ...(typeof r.username === 'string' && r.username ? { username: r.username } : {}),
});
const full = (r: Row): FullPack => ({ ...summary(r), items: JSON.parse(String(r.items)), extra: JSON.parse(String(r.extra)) });

export class Library {
  private readonly sql: SqlStorageLike;

  constructor(ctx: SqlStateLike) {
    this.sql = ctx.storage.sql;
    for (const s of SCHEMA) this.sql.exec(s);
    for (const c of ADDED_COLUMNS) if (!hasColumn(this.sql, c.name)) this.sql.exec(`ALTER TABLE packs ADD COLUMN ${c.name} ${c.type}`);
  }

  async fetch(request: Request): Promise<Response> {
    const op = (await request.json()) as LibraryOp;
    // The export is written out as text around the stored JSON, never parsed and re-serialised.
    if (op.op === 'export') return new Response(this.exportPage(op.after), { headers: { 'content-type': 'application/json' } });
    return Response.json(this.apply(op, Date.now()));
  }

  private rows(query: string, ...bindings: SqlValue[]): Row[] {
    return this.sql.exec<Row>(query, ...bindings).toArray();
  }

  /**
   * `{"packs": [...], "next": cursor or null}`: the next `EXPORT_PAGE` packs not hidden, each with
   * its stored items and extras spliced in as they are. `next` is "<created>:<id>" of the last.
   */
  private exportPage(after: ExportCursor | null): string {
    const from = after ? 'AND (created > ? OR (created = ? AND id > ?))' : '';
    const args: SqlValue[] = after ? [after.created, after.created, after.id] : [];
    const rows = this.rows(`SELECT ${SUMMARY}, items, extra FROM packs WHERE hidden = 0 ${from} ORDER BY created, id LIMIT ?`, ...args, EXPORT_PAGE + 1);
    const page = rows.slice(0, EXPORT_PAGE);
    const packs = page.map((r) => {
      const head = JSON.stringify(summary(r));
      return `${head.slice(0, -1)},"items":${String(r.items)},"extra":${String(r.extra)}}`;
    });
    const last = page.at(-1);
    const next = rows.length > EXPORT_PAGE && last ? JSON.stringify(`${Number(last.created)}:${String(last.id)}`) : 'null';
    return `{"packs":[${packs.join(',')}],"next":${next}}`;
  }

  private apply(op: Exclude<LibraryOp, { op: 'export' }>, now: number): LibraryReply {
    switch (op.op) {
      case 'publish': return this.publish(op.owner, op.pack, now);
      case 'list': return this.list(op.query, op.viewer);
      case 'get': return this.get(op.id, op.viewer);
      case 'star': return this.star(op.id, op.who, op.on);
      case 'hide': return this.hide(op.id, op.hidden);
    }
  }

  private published(day: string, who: string): number {
    return Number(this.rows('SELECT n FROM publishes WHERE day = ? AND who = ?', day, who)[0]?.n ?? 0);
  }

  private count(day: string, who: string): void {
    this.sql.exec('INSERT INTO publishes (day, who, n) VALUES (?, ?, 1) ON CONFLICT (day, who) DO UPDATE SET n = n + 1', day, who);
  }

  /** Same pass and same phone id: that entry is replaced, username included (hidden stays hidden); else a new one. */
  private publish(owner: string, p: PublishPack, now: number): LibraryReply {
    const day = utcDay(now);
    if (this.published(day, EVERYONE) >= LIBRARY.publishesPerDay) return { ok: false, status: 429, scope: 'everyone', retryAfter: untilTomorrow(now) };
    if (this.published(day, owner) >= LIBRARY.publishesPerSessionPerDay) return { ok: false, status: 429, scope: 'phone', retryAfter: untilTomorrow(now) };
    this.sql.exec('DELETE FROM publishes WHERE day <> ?', day);
    this.count(day, EVERYONE);
    this.count(day, owner);
    const search = `${searchText(p.name)}\n${searchText(p.blurb)}`;
    const items = JSON.stringify(p.items);
    const extra = JSON.stringify(p.extra);
    const username = p.username ?? null;
    const had = this.rows('SELECT id FROM packs WHERE owner = ? AND game = ? AND local_id = ?', owner, p.game, p.localId)[0];
    if (had) {
      this.sql.exec('UPDATE packs SET name = ?, blurb = ?, count = ?, items = ?, extra = ?, search = ?, updated = ?, username = ? WHERE id = ?',
        p.name, p.blurb, p.count, items, extra, search, now, username, String(had.id));
      return { ok: true, id: String(had.id), created: false };
    }
    const id = toBase64url(crypto.getRandomValues(new Uint8Array(9)));
    this.sql.exec('INSERT INTO packs (id, game, name, blurb, count, items, extra, search, created, updated, owner, local_id, username) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id, p.game, p.name, p.blurb, p.count, items, extra, search, now, now, owner, p.localId, username);
    return { ok: true, id, created: true };
  }

  /**
   * Most stars first (newest among equals), or newest first; 30 a page; `more` when another page
   * has some. A search looks through the first `LIBRARY.searchScan` packs of that order only, so
   * no request reads more rows than that (the order itself comes from an index).
   */
  private list(q: ListQuery, viewer?: string): LibraryReply {
    const where = ['hidden = 0'];
    const args: SqlValue[] = [];
    if (q.game) { where.push('game = ?'); args.push(q.game); }
    const order = q.sort === 'new' ? 'updated DESC, id' : 'stars DESC, updated DESC, id';
    const page: SqlValue[] = [LIBRARY.pageSize + 1, (q.page - 1) * LIBRARY.pageSize];
    // instr, not LIKE: the search is plain text, so % and _ are just characters.
    const rows = q.q
      ? this.rows(`SELECT ${SUMMARY} FROM (SELECT ${SUMMARY}, search FROM packs WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ?)
          WHERE instr(search, ?) > 0 ORDER BY ${order} LIMIT ? OFFSET ?`, ...args, LIBRARY.searchScan, q.q, ...page)
      : this.rows(`SELECT ${SUMMARY} FROM packs WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ? OFFSET ?`, ...args, ...page);
    const packs = rows.slice(0, LIBRARY.pageSize).map(summary);
    return { ok: true, packs: this.markStarred(packs, viewer), more: rows.length > LIBRARY.pageSize };
  }

  private markStarred<T extends PackSummary>(packs: T[], viewer?: string): T[] {
    if (!viewer || !packs.length) return packs;
    const mine = new Set(this.rows(`SELECT pack_id FROM stars WHERE who = ? AND pack_id IN (${packs.map(() => '?').join(', ')})`, viewer, ...packs.map((p) => p.id)).map((r) => String(r.pack_id)));
    return packs.map((p) => ({ ...p, starred: mine.has(p.id) }));
  }

  private get(id: string, viewer?: string): LibraryReply {
    const row = this.rows(`SELECT ${SUMMARY}, items, extra FROM packs WHERE id = ? AND hidden = 0`, id)[0];
    return row ? { ok: true, pack: this.markStarred([full(row)], viewer)[0] } : { ok: false, status: 404 };
  }

  /** One star per pass per pack; the count moves by one only when the vote changes. */
  private star(id: string, who: string, on: boolean): LibraryReply {
    const pack = this.rows('SELECT stars FROM packs WHERE id = ? AND hidden = 0', id)[0];
    if (!pack) return { ok: false, status: 404 };
    const had = this.rows('SELECT 1 AS x FROM stars WHERE pack_id = ? AND who = ?', id, who).length > 0;
    // The same vote again writes nothing.
    if (had === on) return { ok: true, stars: Number(pack.stars), starred: on };
    if (on) this.sql.exec('INSERT INTO stars (pack_id, who) VALUES (?, ?)', id, who);
    else this.sql.exec('DELETE FROM stars WHERE pack_id = ? AND who = ?', id, who);
    const stars = Number(pack.stars) + (on ? 1 : -1);
    this.sql.exec('UPDATE packs SET stars = ? WHERE id = ?', stars, id);
    return { ok: true, stars, starred: on };
  }

  private hide(id: string, hidden: boolean): LibraryReply {
    if (!this.rows('SELECT id FROM packs WHERE id = ?', id).length) return { ok: false, status: 404 };
    this.sql.exec('UPDATE packs SET hidden = ? WHERE id = ?', hidden ? 1 : 0, id);
    return { ok: true };
  }
}

/** Sends one operation to the library object. */
export async function libraryOp(ns: DurableObjectNamespaceLike, op: LibraryOp): Promise<LibraryReply> {
  const stub = ns.get(ns.idFromName('library'));
  const res = await stub.fetch('https://library.internal/', { method: 'POST', body: JSON.stringify(op) });
  return (await res.json()) as LibraryReply;
}
