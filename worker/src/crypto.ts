// Small Web Crypto helpers shared by phrases and sessions. Works in Workers and in Node.

const enc = new TextEncoder();

export function utf8(text: string): Uint8Array<ArrayBuffer> {
  return enc.encode(text);
}

export function toBase64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Bytes from base64url, or null when `text` is not base64url. */
export function fromBase64url(text: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  try {
    const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

export function hmacKey(raw: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function hmac(key: CryptoKey, data: string): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, utf8(data)));
}

/** Compares every byte whatever the first difference, so timing says nothing about where it was. */
export function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export interface Keys {
  /** Signs and checks session tokens. */
  session: CryptoKey;
  /** Turns phrases into digests and phrase ids. */
  phrase: CryptoKey;
}

/**
 * Both keys come from the Anthropic key, so there is no extra secret to manage and a new
 * Anthropic key ends every session at once.
 */
export async function deriveKeys(apiKey: string): Promise<Keys> {
  const master = await hmacKey(utf8(apiKey));
  return {
    session: await hmacKey(await hmac(master, 'jerkbox-wizard session v1')),
    phrase: await hmacKey(await hmac(master, 'jerkbox-wizard phrase v1')),
  };
}

/** A short one-way label for a client address, so storage never holds the address itself. */
export async function addressLabel(address: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', utf8('jerkbox-wizard ip v1 ' + address)));
  return toBase64url(digest.slice(0, 12));
}
