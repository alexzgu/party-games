// The magic-words route: a friend types the party's magic words; the wizard server (worker/)
// checks them and hands back a session token, which then stands in for an API key. The server
// keeps its own Anthropic key; the phone never sees it, and the words never go in a URL.

/** The wizard server's address (its workers.dev URL, no trailing slash). Empty hides the magic words everywhere. */
export const WIZARD_SERVER = 'https://jerkbox-wizard.jerkbox.workers.dev';

export type Redeemed =
  | { ok: true; token: string }
  | { ok: false; reason: 'wrong' | 'limited' | 'too-often' | 'offline' | 'server' | 'broken'; retryAfter?: number };

/** What the phone says when the wizard server itself failed (it answers 5xx, `x-wizard-reason: server` for a crash). */
export const SERVER_TROUBLE = "Fizzwick's tower is having trouble. Try again in a little while.";

/** Sends the words to the server once; never retried, so a wrong guess counts once. `signal` cancels it. */
export async function redeemPhrase(phrase: string, server = WIZARD_SERVER, signal?: AbortSignal): Promise<Redeemed> {
  let res: Response;
  try {
    res = await fetch(`${server}/redeem`, {
      signal,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phrase }),
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    });
  } catch {
    return { ok: false, reason: 'offline' };
  }
  if (res.status === 401) return { ok: false, reason: 'wrong' };
  if (res.status === 429) {
    // The server's x-wizard-reason says which limit: wrong guesses, or right ones said too often today.
    const reason = res.headers.get('x-wizard-reason') === 'redeems' ? 'too-often' : 'limited';
    return { ok: false, reason, retryAfter: Number(res.headers.get('retry-after')) || undefined };
  }
  if (res.status >= 500) return { ok: false, reason: 'server' };
  if (!res.ok) return { ok: false, reason: 'broken' };
  const token = ((await res.json().catch(() => null)) as { token?: unknown } | null)?.token;
  return typeof token === 'string' && token.length > 0 && token.length <= 512 ? { ok: true, token } : { ok: false, reason: 'broken' };
}

/** A wait in plain words: "a minute", "about 12 minutes", "about 2 hours". */
export function waitWords(seconds: number | undefined): string {
  if (!seconds || seconds <= 60) return 'a minute';
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `about ${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? 'about an hour' : `about ${hours} hours`;
}

/** What the Settings page says after the words were tried. */
export function redeemMessage(r: Redeemed): string {
  if (r.ok) return "Fizzwick heard you. He's yours on this phone.";
  if (r.reason === 'wrong') return "Fizzwick doesn't know those words.";
  if (r.reason === 'limited') return `Too many guesses. Fizzwick will listen again in ${waitWords(r.retryAfter)}.`;
  if (r.reason === 'too-often') return `Fizzwick has heard the magic words from here too often today. Try again in ${waitWords(r.retryAfter)}.`;
  if (r.reason === 'offline') return "Fizzwick couldn't hear you: check the internet and try again.";
  if (r.reason === 'server') return SERVER_TROUBLE;
  return "Fizzwick's door is stuck. Try again later.";
}
