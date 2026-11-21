// The magic-words pass a request carries, checked the same way for the wizard and the library:
// signature, expiry, and that the phrase behind it is still accepted.
import { toBase64url, utf8, type Keys } from './crypto';
import type { Env } from './env';
import { errorResponse } from './http';
import { currentPhraseIds } from './phrase';
import { tokenFrom, verifyToken, type Session, type Verdict } from './token';

type Problem = Exclude<Verdict, { ok: true }>['reason'];
const SESSION_PROBLEM: Record<Problem, string> = {
  malformed: 'This phone has no valid wizard pass. Say the magic words again.',
  signature: 'This phone has no valid wizard pass. Say the magic words again.',
  expired: 'The wizard pass has expired. Say the magic words again.',
  revoked: 'Those magic words no longer work.',
};

/**
 * `x-wizard-reason` tells the app which words to use: on 401 `expired`, `revoked` or `invalid`;
 * on 429 `guesses`, `redeems`, `phone`, `party` or `library`; on 500 `server`.
 */
export const REASON = 'x-wizard-reason';
const reasonFor = (p: Problem) => (p === 'expired' || p === 'revoked' ? p : 'invalid');

/** The request's session, or the 401 to answer with. */
export async function checkPass(request: Request, env: Env, keys: Keys, cors: Record<string, string>): Promise<{ ok: true; session: Session } | { ok: false; response: Response }> {
  const pids = await currentPhraseIds(keys, env.PARTY_PHRASES);
  const verdict = await verifyToken(keys.session, tokenFrom(request.headers), Date.now(), pids);
  if (verdict.ok) return verdict;
  return { ok: false, response: errorResponse(401, 'authentication_error', SESSION_PROBLEM[verdict.reason], { ...cors, [REASON]: reasonFor(verdict.reason) }) };
}

/** A one-way label for a session, so the library never stores a session id itself. */
export async function sessionLabel(sid: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', utf8('jerkbox-wizard library v1 ' + sid)));
  return toBase64url(digest.slice(0, 16));
}
