// Test doubles for the app, like worker/src/testing.ts for the server. Only tests import this file.

/**
 * A server-sent-events body like the Messages API streams, with `text` cut into small deltas, so a
 * test runs the real SDK stream and line splitting without a key or the network; `stop` is the
 * reply's stop reason ("max_tokens" for one cut off by the token limit).
 */
export function fakeStream(text: string, stop = 'end_turn'): Response {
  const ev = (type: string, data: object) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
  const deltas = text.match(/[\s\S]{1,7}/g) ?? [];
  const body = [
    ev('message_start', { message: { id: 'msg_test', type: 'message', role: 'assistant', model: 'test', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } }),
    ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } }),
    ...deltas.map((d) => ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: d } })),
    ev('content_block_stop', { index: 0 }),
    ev('message_delta', { delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: 50 } }),
    ev('message_stop', {}),
  ];
  const enc = new TextEncoder();
  const stream = new ReadableStream({ start(c) { for (const chunk of body) c.enqueue(enc.encode(chunk)); c.close(); } });
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

/**
 * A reply that sends `text` and then, before it ends: waits until the request is stopped
 * (`'hang'`), or breaks off as a lost connection does (`'break'`).
 */
export function unfinishedStream(text: string, how: 'hang' | 'break', signal?: AbortSignal | null): Response {
  const head = fakeStream(text).body!.getReader();
  const body = new ReadableStream<Uint8Array>({
    async pull(c) {
      const { value, done } = await head.read();
      if (done || new TextDecoder().decode(value).includes('content_block_stop')) {
        if (how === 'hang') await new Promise((resolve) => (signal?.aborted ? resolve(null) : signal?.addEventListener('abort', resolve)));
        c.error(how === 'hang' ? new DOMException('The request was stopped.', 'AbortError') : new TypeError('network connection lost'));
        return;
      }
      c.enqueue(value);
    },
  });
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

/** One answer of `fakeReplies`: a whole reply's text, an HTTP error status, or a reply made from the request. */
export type FakeReply = string | number | ((init: RequestInit) => Response);

/**
 * Stubs `fetch` with `stub` (vi.stubGlobal) to answer requests in turn; returns each request's body
 * and signal as they come.
 */
export function fakeReplies(stub: (name: string, fn: unknown) => void, ...answers: FakeReply[]): { bodies: { messages: { role: string; content: string }[] }[]; signals: (AbortSignal | null | undefined)[] } {
  const seen = { bodies: [] as { messages: { role: string; content: string }[] }[], signals: [] as (AbortSignal | null | undefined)[] };
  stub('fetch', async (_u: unknown, init: RequestInit = {}) => {
    seen.bodies.push(JSON.parse(String(init.body)));
    seen.signals.push(init.signal);
    const a = answers.shift() ?? '';
    if (typeof a === 'number') return new Response('{}', { status: a, headers: { 'content-type': 'application/json' } });
    return typeof a === 'function' ? a(init) : fakeStream(a);
  });
  return seen;
}
