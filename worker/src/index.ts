// The wizard server: a friend's phone trades a party phrase for a session token (POST /redeem),
// then uses the server as its Anthropic base URL (POST /v1/messages). The server checks the
// token and the request, reserves the daily allowance, and forwards the request with its own
// key, streaming the answer back. /library/… is the community pack library (libraryRoutes.ts).
// Nothing here logs a phrase, token, key or body.
import { clientOf } from './address';
import { deriveKeys, type Keys } from './crypto';
import type { Env, ExecutionContextLike } from './env';
import { corsHeaders, errorResponse, limitResponse, originAllowed, parseOrigins, preflight } from './http';
import { library } from './libraryRoutes';
import { limit } from './limitsObject';
import { checkPass, REASON } from './pass';
import { guessesFrom, matchGuesses, MAX_PHRASE_LENGTH } from './phrase';
import { newSession, signToken } from './token';
import { apiVersion, checkBetas, checkMessageBody, MAX_BODY_BYTES, readLimited } from './validate';

export { Limits } from './limitsObject';
export { Library } from './libraryObject';

const ANTHROPIC_MESSAGES = 'https://api.anthropic.com/v1/messages';
const MAX_REDEEM_BYTES = 1024;
type Cors = Record<string, string>;

/**
 * API answers known to cost nothing, so their reservation is given back: a 4xx (the request was
 * refused before it ran) or 529 (overloaded, not run). Anything else, a 5xx or a connection that
 * failed after sending, may have run, so it stays counted.
 */
export const unbilled = (status: number) => (status >= 400 && status < 500) || status === 529;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContextLike): Promise<Response> {
    const cors = corsHeaders(request.headers.get('origin'), parseOrigins(env.ALLOWED_ORIGINS));
    try {
      return await handle(request, env, ctx, cors);
    } catch {
      // Something failed unexpectedly (the counters' Durable Object, say). Answer with the CORS
      // headers, so the phone can read that it was the server and not its connection; no details.
      return errorResponse(500, 'api_error', 'The wizard server hit a problem.', { ...cors, [REASON]: 'server' });
    }
  },
};

async function handle(request: Request, env: Env, ctx: ExecutionContextLike, cors: Cors): Promise<Response> {
  const allowed = parseOrigins(env.ALLOWED_ORIGINS);
  const origin = request.headers.get('origin');
  const path = new URL(request.url).pathname;
  if (path === '/library' || path.startsWith('/library/')) return library(request, env, path, cors);
  if (path !== '/redeem' && path !== '/v1/messages') return errorResponse(404, 'not_found_error', 'Nothing here.', cors);
  if (request.method === 'OPTIONS') return preflight(request, allowed);
  // A browser on another site gets nothing; tools without an Origin still meet every other check.
  if (origin !== null && !originAllowed(origin, allowed)) return errorResponse(403, 'permission_error', 'This site may not use the wizard server.', cors);
  if (request.method !== 'POST') return errorResponse(405, 'invalid_request_error', 'Use POST.', { ...cors, Allow: 'POST, OPTIONS' });
  if (!env.ANTHROPIC_API_KEY) return errorResponse(503, 'api_error', 'The wizard server is not set up yet.', cors);
  const keys = await deriveKeys(env.ANTHROPIC_API_KEY);
  return path === '/redeem' ? redeem(request, env, keys, cors) : messages(request, env, ctx, keys, cors);
}

async function redeem(request: Request, env: Env, keys: Keys, cors: Cors): Promise<Response> {
  const raw = await readLimited(request, MAX_REDEEM_BYTES);
  if (raw === null) return errorResponse(413, 'request_too_large', 'That is far too long for magic words.', cors);
  let phrase: unknown;
  try {
    phrase = JSON.parse(raw)?.phrase;
  } catch {
    /* answered below */
  }
  if (typeof phrase !== 'string' || !phrase.trim() || phrase.length > MAX_PHRASE_LENGTH) {
    return errorResponse(400, 'invalid_request_error', 'Send {"phrase": "<the magic words>"}.', cors);
  }
  // Each word is a guess, and so is the whole phrase; only punctuation is nothing to check or count.
  const guesses = guessesFrom(phrase);
  if (!guesses.length) return errorResponse(401, 'authentication_error', 'Those are not the magic words.', cors);
  const who = await clientOf(request.headers.get('cf-connecting-ip'));
  const slot = await limit(env.LIMITS, { op: 'guess', ...who, count: guesses.length });
  if (!slot.ok) return limitResponse('Too many wrong guesses. Wait, then try again.', slot.retryAfter, { ...cors, [REASON]: 'guesses' });
  // With fewer guesses left than the submission holds, only the first `granted` are checked.
  const granted = slot.granted ?? 1;
  const pid = await matchGuesses(keys, guesses.slice(0, granted), env.PARTY_PHRASES);
  if (!pid) return errorResponse(401, 'authentication_error', 'Those are not the magic words.', cors);
  const counted = await limit(env.LIMITS, { op: 'redeemed', ...who, at: slot.at ?? 0, fresh: slot.fresh === true, count: granted });
  if (!counted.ok) return limitResponse('The magic words were said too often from here today.', counted.retryAfter, { ...cors, [REASON]: 'redeems' });
  const session = newSession(pid, Date.now());
  const token = await signToken(keys.session, session);
  return Response.json({ token, expires: session.exp }, { headers: { ...cors, 'Cache-Control': 'no-store' } });
}

async function messages(request: Request, env: Env, ctx: ExecutionContextLike, keys: Keys, cors: Cors): Promise<Response> {
  const verdict = await checkPass(request, env, keys, cors);
  if (!verdict.ok) return verdict.response;
  const raw = await readLimited(request, MAX_BODY_BYTES);
  if (raw === null) return errorResponse(413, 'request_too_large', `Requests here are limited to ${MAX_BODY_BYTES / 1024} KB.`, cors);
  const body = checkMessageBody(raw);
  if (!body.ok) return errorResponse(400, 'invalid_request_error', body.message, cors);
  const betas = checkBetas(request.headers.get('anthropic-beta'));
  if (!betas.ok) return errorResponse(400, 'invalid_request_error', betas.message, cors);

  const session = verdict.session.sid;
  const slot = await limit(env.LIMITS, { op: 'spend', session });
  if (!slot.ok) {
    const phone = slot.scope === 'session';
    const why = phone ? "This phone has used today's wizard allowance." : "The party's wizard allowance for today is used up.";
    return limitResponse(why, slot.retryAfter, { ...cors, [REASON]: phone ? 'phone' : 'party' });
  }
  const day = slot.day ?? '';
  const giveBack = () => ctx.waitUntil(limit(env.LIMITS, { op: 'unspend', session, day }));

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'anthropic-version': apiVersion(request.headers.get('anthropic-version')),
    'x-api-key': env.ANTHROPIC_API_KEY,
  };
  let upstream: Response;
  try {
    // The re-serialised checked object, so the API reads exactly what was checked.
    // redirect 'manual': the key header never follows a redirect anywhere.
    upstream = await fetch(ANTHROPIC_MESSAGES, { method: 'POST', headers, body: JSON.stringify(body.value), redirect: 'manual' });
  } catch {
    // The request may have reached the API before the connection failed, so the reservation stays.
    return errorResponse(502, 'api_error', 'The wizard server could not reach its crystal ball.', cors);
  }
  if (unbilled(upstream.status)) giveBack();
  // The server's own key failing is the host's problem; a 401 here would wrongly end the phone's session.
  if (upstream.status === 401 || upstream.status === 403) {
    await upstream.body?.cancel();
    return errorResponse(502, 'api_error', "The wizard server's own key was refused. The host needs to check it.", cors);
  }
  if (upstream.status >= 300 && upstream.status < 400) {
    await upstream.body?.cancel();
    return errorResponse(502, 'api_error', 'The crystal ball tried to send the wizard server elsewhere; it did not follow.', cors);
  }
  const out = new Headers(cors);
  for (const h of ['content-type', 'request-id', 'retry-after']) {
    const v = upstream.headers.get(h);
    if (v) out.set(h, v);
  }
  out.set('Cache-Control', 'no-store');
  return new Response(upstream.body, { status: upstream.status, headers: out });
}
