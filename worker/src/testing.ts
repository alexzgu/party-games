// Test doubles: a fake env with an in-memory Limits object. Only tests import this file.
import type { DurableObjectNamespaceLike, Env, ExecutionContextLike } from './env';
import { Limits } from './limitsObject';

/** Obvious fakes: never a real key or phrase. */
export const FAKE_KEY = 'sk-ant-test-not-a-real-key-000000';
export const FAKE_PHRASES = 'test phrase one\ntest phrase two';
export const SITE = 'https://alexzgu.github.io';

export function fakeNamespace(): DurableObjectNamespaceLike {
  const data = new Map<string, unknown>();
  const object = new Limits({
    storage: {
      get: async <T>(k: string) => structuredClone(data.get(k)) as T | undefined,
      put: async <T>(k: string, v: T) => void data.set(k, structuredClone(v)),
    },
  });
  return {
    idFromName: (name: string) => name,
    get: () => ({ fetch: (input: string, init?: RequestInit) => object.fetch(new Request(input, init)) }),
  };
}

export function fakeEnv(over: Partial<Env> = {}): Env {
  return { ANTHROPIC_API_KEY: FAKE_KEY, PARTY_PHRASES: FAKE_PHRASES, ALLOWED_ORIGINS: `${SITE},http://localhost:5173`, LIMITS: fakeNamespace(), ...over };
}

/** A context whose waitUntil work can be awaited with `settle()`. */
export function fakeCtx(): ExecutionContextLike & { settle(): Promise<unknown> } {
  const pending: Promise<unknown>[] = [];
  return { waitUntil: (p) => void pending.push(p), settle: () => Promise.all(pending) };
}

/** A streamed Messages API answer (server-sent events) whose text is `text`. */
export function fakeStream(text: string): Response {
  const ev = (type: string, data: object) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
  const body = [
    ev('message_start', { message: { id: 'msg_test', type: 'message', role: 'assistant', model: 'test', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } }),
    ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } }),
    ...(text.match(/[\s\S]{1,5}/g) ?? []).map((d) => ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: d } })),
    ev('content_block_stop', { index: 0 }),
    ev('message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 5 } }),
    ev('message_stop', {}),
  ].join('');
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream', 'request-id': 'req_test' } });
}
