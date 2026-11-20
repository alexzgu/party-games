// What a wizard request may contain: exactly what src/lib/claude.ts sends on the magic-words
// route, nothing else. Models and the token cap come from src/lib/wizard.ts, the app's own list.
// No betas and no `fallbacks`: a fallback could run a model the server did not choose, billed
// on top of the first, against one reservation. So one request here is one model run.
import { EFFORTS, SERVER_MAX_TOKENS } from '../../src/lib/wizard';

export const MAX_BODY_BYTES = 64 * 1024;
export const MAX_MESSAGES = 8;
export const MODELS: readonly string[] = EFFORTS.map((e) => e.id);
const EFFORT_LEVELS = ['low', 'medium', 'high'];
const FIELDS = new Set(['model', 'max_tokens', 'system', 'messages', 'stream', 'output_config']);

export type Checked<T> = { ok: true; value: T } | { ok: false; message: string };

const fail = (message: string): { ok: false; message: string } => ({ ok: false, message });
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const onlyKeys = (o: Record<string, unknown>, keys: string[]) => Object.keys(o).every((k) => keys.includes(k));

/** A string, or a list of plain text blocks ({type: 'text', text}). */
function isText(v: unknown): boolean {
  if (typeof v === 'string') return true;
  return Array.isArray(v) && v.every((b) => isObject(b) && onlyKeys(b, ['type', 'text']) && b.type === 'text' && typeof b.text === 'string');
}

/** The parsed body when it is a request the app could have sent, else what is wrong with it. */
export function checkMessageBody(raw: string): Checked<Record<string, unknown>> {
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail('The request body is not JSON.');
  }
  if (!isObject(body)) return fail('The request body must be an object.');
  const extra = Object.keys(body).filter((k) => !FIELDS.has(k));
  if (extra.length) return fail(`Not allowed here: ${extra.slice(0, 3).join(', ')}.`);
  if (typeof body.model !== 'string' || !MODELS.includes(body.model)) return fail('That model is not available here.');
  const max = body.max_tokens;
  if (typeof max !== 'number' || !Number.isInteger(max) || max < 1 || max > SERVER_MAX_TOKENS) return fail(`max_tokens must be 1 to ${SERVER_MAX_TOKENS}.`);
  if (body.stream !== true) return fail('Only streamed requests are allowed here.');
  if (body.system !== undefined && !isText(body.system)) return fail('system must be text.');
  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > MAX_MESSAGES) return fail(`messages must hold 1 to ${MAX_MESSAGES} items.`);
  const goodMessage = (m: unknown) => isObject(m) && onlyKeys(m, ['role', 'content']) && (m.role === 'user' || m.role === 'assistant') && isText(m.content);
  if (!messages.every(goodMessage)) return fail('Each message must be a user or assistant message of plain text.');
  const oc = body.output_config;
  if (oc !== undefined && !(isObject(oc) && onlyKeys(oc, ['effort']) && EFFORT_LEVELS.includes(oc.effort as string))) return fail('output_config may only set effort.');
  return { ok: true, value: body };
}

/** The app sends no anthropic-beta header on this route, so any beta is refused. */
export function checkBetas(header: string | null): Checked<''> {
  const asked = (header ?? '').split(',').map((b) => b.trim()).filter(Boolean);
  return asked.length ? fail(`Betas are not allowed here: ${asked[0].slice(0, 60)}.`) : { ok: true, value: '' };
}

/** The anthropic-version header to forward. */
export function apiVersion(header: string | null): string {
  return header && /^\d{4}-\d{2}-\d{2}$/.test(header) ? header : '2023-06-01';
}

/** The body as text, or null when it is longer than `limit` bytes (stops reading at the limit). */
export async function readLimited(request: Request, limit: number): Promise<string | null> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > limit) return null;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.byteLength;
  }
  return new TextDecoder().decode(all);
}
