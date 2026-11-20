// Session tokens: base64url(JSON payload) + "." + base64url(HMAC-SHA256 of the first part).
// The phone keeps one in place of an API key and sends it with every wizard request.
import { fromBase64url, toBase64url, utf8 } from './crypto';

/** How long a session lasts after the magic words are said. */
export const SESSION_DAYS = 30;
const MAX_TOKEN_LENGTH = 512;

export interface Session {
  /** Random session id: the per-session daily allowance is counted against it. */
  sid: string;
  /** Id of the phrase that opened it (see `phraseId`). */
  pid: string;
  /** Issued and expiry times, seconds since 1970. */
  iat: number;
  exp: number;
}

export function newSession(pid: string, nowMs: number): Session {
  const iat = Math.floor(nowMs / 1000);
  return { sid: toBase64url(crypto.getRandomValues(new Uint8Array(9))), pid, iat, exp: iat + SESSION_DAYS * 86400 };
}

export async function signToken(key: CryptoKey, session: Session): Promise<string> {
  const body = toBase64url(utf8(JSON.stringify(session)));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, utf8(body)));
  return `${body}.${toBase64url(sig)}`;
}

export type Verdict = { ok: true; session: Session } | { ok: false; reason: 'malformed' | 'signature' | 'expired' | 'revoked' };

/** Checks the signature, the expiry and that the phrase behind the session is still accepted. */
export async function verifyToken(key: CryptoKey, token: string, nowMs: number, phraseIds: Set<string>): Promise<Verdict> {
  if (token.length > MAX_TOKEN_LENGTH) return { ok: false, reason: 'malformed' };
  const [body, sigText, extra] = token.split('.');
  const sig = fromBase64url(sigText ?? '');
  if (!body || !sig || extra !== undefined) return { ok: false, reason: 'malformed' };
  if (!(await crypto.subtle.verify('HMAC', key, sig, utf8(body)))) return { ok: false, reason: 'signature' };
  const session = parseSession(body);
  if (!session) return { ok: false, reason: 'malformed' };
  const now = nowMs / 1000;
  if (session.exp <= now || session.iat > now + 300) return { ok: false, reason: 'expired' };
  if (!phraseIds.has(session.pid)) return { ok: false, reason: 'revoked' };
  return { ok: true, session };
}

function parseSession(body: string): Session | null {
  const bytes = fromBase64url(body);
  if (!bytes) return null;
  try {
    const s = JSON.parse(new TextDecoder().decode(bytes));
    const ok = typeof s?.sid === 'string' && typeof s.pid === 'string' && Number.isFinite(s.iat) && Number.isFinite(s.exp);
    return ok ? { sid: s.sid, pid: s.pid, iat: s.iat, exp: s.exp } : null;
  } catch {
    return null;
  }
}

/** The token a request carries: the SDK sends `Authorization: Bearer <token>`; `x-api-key` also works. */
export function tokenFrom(headers: Headers): string {
  const auth = headers.get('authorization') ?? '';
  const bearer = /^Bearer\s+(\S+)$/i.exec(auth);
  return (bearer?.[1] ?? headers.get('x-api-key') ?? '').trim();
}
