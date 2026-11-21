// The community pack library's routes. Browsing, previewing and the export are open to anyone;
// publishing and starring need a magic-words pass; hiding needs the owner's LIBRARY_ADMIN secret.
//   POST   /library/packs            publish or update a pack (pass)
//   GET    /library/packs?game=&q=&sort=stars|new&page=
//   GET    /library/packs/:id        one pack with its items
//   POST   /library/packs/:id/star   star it (pass); DELETE takes the star back
//   POST   /library/packs/:id/hide   {"hidden": true|false} (LIBRARY_ADMIN)
//   GET    /library/export?after=    every pack not hidden, for backups, a page at a time
import { deriveKeys, sameBytes, utf8 } from './crypto';
import type { Env } from './env';
import { errorResponse, limitResponse, originAllowed, parseOrigins, preflight } from './http';
import { checkList, checkPublish, LIBRARY, PACK_ID } from './library';
import { libraryOp, type ExportCursor, type LibraryOp, type LibraryReply } from './libraryObject';
import { checkPass, REASON, sessionLabel } from './pass';
import { readLimited } from './validate';

type Cors = Record<string, string>;
const METHODS = 'GET, POST, DELETE, OPTIONS';
/** A publish body may carry a little more than the items' 64 KB (name, blurb, keys). */
const MAX_PUBLISH_BYTES = LIBRARY.itemsBytes + 4 * 1024;
const MAX_HIDE_BYTES = 256;

type Route =
  | { kind: 'packs' }
  | { kind: 'pack'; id: string }
  | { kind: 'star'; id: string }
  | { kind: 'hide'; id: string }
  | { kind: 'export' };

function routeOf(path: string): Route | null {
  if (path === '/library/packs') return { kind: 'packs' };
  if (path === '/library/export') return { kind: 'export' };
  const m = /^\/library\/packs\/([^/]+)(?:\/(star|hide))?$/.exec(path);
  if (!m || !PACK_ID.test(m[1])) return null;
  return m[2] === 'star' ? { kind: 'star', id: m[1] } : m[2] === 'hide' ? { kind: 'hide', id: m[1] } : { kind: 'pack', id: m[1] };
}

/** The methods each route answers. */
const ALLOW: Record<Route['kind'], string[]> = { packs: ['GET', 'POST'], pack: ['GET'], star: ['POST', 'DELETE'], hide: ['POST'], export: ['GET'] };

const json = (body: unknown, cors: Cors) => Response.json(body, { headers: { ...cors, 'Cache-Control': 'no-store' } });

export async function library(request: Request, env: Env, path: string, cors: Cors): Promise<Response> {
  const allowed = parseOrigins(env.ALLOWED_ORIGINS);
  const origin = request.headers.get('origin');
  const route = routeOf(path);
  if (!route) return errorResponse(404, 'not_found_error', 'Nothing here.', cors);
  if (request.method === 'OPTIONS') return preflight(request, allowed, METHODS);
  if (origin !== null && !originAllowed(origin, allowed)) return errorResponse(403, 'permission_error', 'This site may not use the wizard server.', cors);
  if (!ALLOW[route.kind].includes(request.method)) {
    return errorResponse(405, 'invalid_request_error', `Use ${ALLOW[route.kind].join(' or ')}.`, { ...cors, Allow: [...ALLOW[route.kind], 'OPTIONS'].join(', ') });
  }
  const ask = (op: LibraryOp) => libraryOp(env.LIBRARY, op);
  switch (route.kind) {
    case 'packs': return request.method === 'POST' ? publish(request, env, cors) : list(request, env, cors);
    case 'pack': return answer(await ask({ op: 'get', id: route.id, viewer: await viewerOf(request, env) }), cors);
    case 'star': return star(request, env, route.id, cors);
    case 'hide': return hide(request, env, route.id, cors);
    case 'export': return exportPage(request, env, cors);
  }
}

/** The session label of a valid pass, or why there is none (a 401, or 503 before the server has a key). */
async function passHolder(request: Request, env: Env, cors: Cors): Promise<{ ok: true; who: string } | { ok: false; response: Response }> {
  if (!env.ANTHROPIC_API_KEY) return { ok: false, response: errorResponse(503, 'api_error', 'The wizard server is not set up yet.', cors) };
  const pass = await checkPass(request, env, await deriveKeys(env.ANTHROPIC_API_KEY), cors);
  return pass.ok ? { ok: true, who: await sessionLabel(pass.session.sid) } : pass;
}

/** On the open routes a pass is optional: a valid one marks the packs it starred, anything else is ignored. */
async function viewerOf(request: Request, env: Env): Promise<string | undefined> {
  if (!request.headers.has('authorization') && !request.headers.has('x-api-key')) return undefined;
  const p = await passHolder(request, env, {});
  return p.ok ? p.who : undefined;
}

function answer(r: LibraryReply, cors: Cors): Response {
  if (r.ok) {
    const { ok: _, ...body } = r;
    return json(body, cors);
  }
  if (r.status === 404) return errorResponse(404, 'not_found_error', 'That pack is not in the library.', cors);
  const why = r.scope === 'phone' ? 'This phone has shared enough packs for today.' : 'The library has taken enough packs for today.';
  return limitResponse(why, r.retryAfter, { ...cors, [REASON]: 'library' });
}

async function publish(request: Request, env: Env, cors: Cors): Promise<Response> {
  const holder = await passHolder(request, env, cors);
  if (!holder.ok) return holder.response;
  const raw = await readLimited(request, MAX_PUBLISH_BYTES);
  if (raw === null) return errorResponse(413, 'request_too_large', `A pack is limited to ${LIBRARY.itemsBytes / 1024} KB.`, cors);
  const pack = checkPublish(raw);
  if (!pack.ok) return errorResponse(400, 'invalid_request_error', pack.message, cors);
  return answer(await libraryOp(env.LIBRARY, { op: 'publish', owner: holder.who, pack: pack.value }), cors);
}

async function list(request: Request, env: Env, cors: Cors): Promise<Response> {
  const query = checkList(new URL(request.url).searchParams);
  if (!query.ok) return errorResponse(400, 'invalid_request_error', query.message, cors);
  return answer(await libraryOp(env.LIBRARY, { op: 'list', query: query.value, viewer: await viewerOf(request, env) }), cors);
}

async function star(request: Request, env: Env, id: string, cors: Cors): Promise<Response> {
  const holder = await passHolder(request, env, cors);
  if (!holder.ok) return holder.response;
  return answer(await libraryOp(env.LIBRARY, { op: 'star', id, who: holder.who, on: request.method === 'POST' }), cors);
}

/** "<created>:<id>" from the page before, or null for the first page. */
function cursorOf(text: string | null): ExportCursor | null | undefined {
  if (!text) return null;
  const m = /^(\d{1,16}):([A-Za-z0-9_-]{12})$/.exec(text);
  return m ? { created: Number(m[1]), id: m[2] } : undefined;
}

/** One export page, passed through as the library object wrote it (never parsed here). */
async function exportPage(request: Request, env: Env, cors: Cors): Promise<Response> {
  const after = cursorOf(new URL(request.url).searchParams.get('after'));
  if (after === undefined) return errorResponse(400, 'invalid_request_error', 'after must be the "next" of the page before.', cors);
  const stub = env.LIBRARY.get(env.LIBRARY.idFromName('library'));
  const res = await stub.fetch('https://library.internal/', { method: 'POST', body: JSON.stringify({ op: 'export', after } satisfies LibraryOp) });
  if (!res.ok) throw new Error('library export failed');
  return new Response(res.body, { headers: { ...cors, 'content-type': 'application/json', 'Cache-Control': 'no-store' } });
}

/** Compares digests, so neither the length nor the first difference shows in the timing. */
async function sameSecret(given: string, secret: string): Promise<boolean> {
  const digest = async (t: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', utf8(t)));
  return sameBytes(await digest(given), await digest(secret));
}

async function hide(request: Request, env: Env, id: string, cors: Cors): Promise<Response> {
  const secret = (env.LIBRARY_ADMIN ?? '').trim();
  const given = /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') ?? '')?.[1] ?? '';
  // Without the secret set, hiding is off: no value, however long, gets in.
  if (!secret || !given || !(await sameSecret(given, secret))) return errorResponse(403, 'permission_error', 'Only the owner may hide packs.', cors);
  const raw = await readLimited(request, MAX_HIDE_BYTES);
  if (raw === null) return errorResponse(413, 'request_too_large', 'Send only {"hidden": true} or {"hidden": false}.', cors);
  // Only an explicit true or false changes anything.
  let hidden: unknown = null;
  try {
    hidden = JSON.parse(raw)?.hidden;
  } catch {
    /* answered below */
  }
  if (typeof hidden !== 'boolean') return errorResponse(400, 'invalid_request_error', 'Send {"hidden": true} or {"hidden": false}.', cors);
  return answer(await libraryOp(env.LIBRARY, { op: 'hide', id, hidden }), cors);
}
