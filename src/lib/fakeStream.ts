// For tests only: a server-sent-events body like the Messages API streams, with `text` cut into
// small deltas, so a test runs the real SDK stream and line splitting without a key or the network.
export function fakeStream(text: string): Response {
  const ev = (type: string, data: object) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
  const deltas = text.match(/[\s\S]{1,7}/g) ?? [];
  const body = [
    ev('message_start', { message: { id: 'msg_test', type: 'message', role: 'assistant', model: 'test', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } }),
    ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } }),
    ...deltas.map((d) => ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: d } })),
    ev('content_block_stop', { index: 0 }),
    ev('message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 50 } }),
    ev('message_stop', {}),
  ];
  const enc = new TextEncoder();
  const stream = new ReadableStream({ start(c) { for (const chunk of body) c.enqueue(enc.encode(chunk)); c.close(); } });
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}
