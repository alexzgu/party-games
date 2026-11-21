// CORS for the site's own origins and Anthropic-shaped JSON errors, so the SDK on the phone
// reads our status codes the way it reads the API's.

/** The origins in the ALLOWED_ORIGINS var. */
export function parseOrigins(list: string | undefined): string[] {
  return (list ?? '').split(',').map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean);
}

export function originAllowed(origin: string | null, allowed: string[]): boolean {
  return origin !== null && allowed.includes(origin);
}

/** Headers the phone's code may read on our replies (the SDK reads these to decide on retries). */
const EXPOSED = 'retry-after, x-should-retry, request-id, x-wizard-reason';

/** CORS headers for a reply to `origin`; none at all when it is not allowed. */
export function corsHeaders(origin: string | null, allowed: string[]): Record<string, string> {
  if (!originAllowed(origin, allowed)) return { Vary: 'Origin' };
  return { 'Access-Control-Allow-Origin': origin as string, 'Access-Control-Expose-Headers': EXPOSED, Vary: 'Origin' };
}

/**
 * The answer to a browser's preflight: 204 for an allowed origin (its asked-for headers and
 * `methods` allowed), else 403.
 */
export function preflight(request: Request, allowed: string[], methods = 'POST, OPTIONS'): Response {
  const origin = request.headers.get('origin');
  if (!originAllowed(origin, allowed)) return new Response(null, { status: 403, headers: { Vary: 'Origin' } });
  const asked = request.headers.get('access-control-request-headers') ?? '';
  // Only header names (letters, digits, dashes) separated by commas are echoed back.
  const headers = /^[A-Za-z0-9-]+(\s*,\s*[A-Za-z0-9-]+)*$/.test(asked.trim()) ? asked.trim() : 'content-type';
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin as string,
      'Access-Control-Allow-Methods': methods,
      'Access-Control-Allow-Headers': headers,
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin, Access-Control-Request-Headers',
    },
  });
}

export type ErrorType = 'invalid_request_error' | 'authentication_error' | 'permission_error' | 'not_found_error' | 'request_too_large' | 'rate_limit_error' | 'api_error';

/** `{type: 'error', error: {type, message}}` like the Anthropic API. */
export function errorResponse(status: number, type: ErrorType, message: string, headers: Record<string, string> = {}): Response {
  return Response.json({ type: 'error', error: { type, message } }, { status, headers });
}

/** A 429 the SDK will not retry, with Retry-After in whole seconds. */
export function limitResponse(message: string, retryAfter: number, headers: Record<string, string> = {}): Response {
  return errorResponse(429, 'rate_limit_error', message, { ...headers, 'Retry-After': String(Math.max(1, Math.ceil(retryAfter))), 'x-should-retry': 'false' });
}
