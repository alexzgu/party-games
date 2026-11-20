import { describe, expect, it } from 'vitest';
import { EFFORTS, SERVER_MAX_TOKENS } from '../../src/lib/wizard';
import { apiVersion, checkBetas, checkMessageBody, MAX_BODY_BYTES, MODELS, readLimited } from './validate';

/** What src/lib/claude.ts sends on the magic-words route (the SDK adds stream: true). */
const APP_BODY = {
  model: 'claude-haiku-5-5', max_tokens: 4000, output_config: { effort: 'low' },
  system: 'You write party game items.', messages: [{ role: 'user', content: 'test prompt' }], stream: true,
};
const check = (over: Record<string, unknown>) => checkMessageBody(JSON.stringify({ ...APP_BODY, ...over }));

describe('wizard request checks', () => {
  it("allows exactly the app's models", () => {
    expect(MODELS).toEqual(EFFORTS.map((e) => e.id));
  });
  it('accepts what the app sends', () => {
    expect(checkMessageBody(JSON.stringify(APP_BODY))).toEqual({ ok: true, value: APP_BODY });
    expect(check({ system: [{ type: 'text', text: 'x' }], messages: [{ role: 'user', content: [{ type: 'text', text: 'y' }] }] }).ok).toBe(true);
  });
  it('refuses another model, tools and unknown fields', () => {
    expect(check({ model: 'claude-some-other-model' }).ok).toBe(false);
    expect(check({ tools: [{ name: 't', input_schema: {} }] }).ok).toBe(false);
    expect(check({ tool_choice: { type: 'auto' } }).ok).toBe(false);
    expect(check({ mcp_servers: [] }).ok).toBe(false);
    expect(check({ container: 'c' }).ok).toBe(false);
    expect(check({ metadata: {} }).ok).toBe(false);
  });
  it('caps max_tokens and needs streaming', () => {
    expect(check({ max_tokens: SERVER_MAX_TOKENS }).ok).toBe(true);
    expect(check({ max_tokens: SERVER_MAX_TOKENS + 1 }).ok).toBe(false);
    expect(check({ max_tokens: 0 }).ok).toBe(false);
    expect(check({ max_tokens: 10.5 }).ok).toBe(false);
    expect(check({ stream: false }).ok).toBe(false);
  });
  it('takes only plain text messages', () => {
    expect(check({ messages: [] }).ok).toBe(false);
    expect(check({ messages: [{ role: 'user', content: [{ type: 'image', source: {} }] }] }).ok).toBe(false);
    expect(check({ messages: [{ role: 'user', content: [{ type: 'text', text: 'x', cache_control: {} }] }] }).ok).toBe(false);
    expect(check({ messages: [{ role: 'system', content: 'x' }] }).ok).toBe(false);
    expect(check({ system: [{ type: 'document' }] }).ok).toBe(false);
    expect(check({ output_config: { effort: 'low', format: {} } }).ok).toBe(false);
    expect(check({ fallbacks: ['claude-some-other-model'] }).ok).toBe(false);
    expect(check({ fallbacks: 'default' }).ok).toBe(false); // one reservation is one model run
    expect(checkMessageBody('not json').ok).toBe(false);
    expect(checkMessageBody('[1]').ok).toBe(false);
  });
  it('takes no betas, and forwards a well-formed version', () => {
    expect(checkBetas(null)).toEqual({ ok: true, value: '' });
    expect(checkBetas(' ')).toEqual({ ok: true, value: '' });
    expect(checkBetas('server-side-fallback-2026-07-01').ok).toBe(false);
    expect(checkBetas('code-execution-2025-08-25').ok).toBe(false);
    expect(apiVersion('2026-10-21')).toBe('2026-10-21');
    expect(apiVersion('evil\r\nx')).toBe('2023-06-01');
  });
  it('stops reading a body past the size limit', async () => {
    const post = (body: string) => new Request('https://w.test/v1/messages', { method: 'POST', body });
    expect(await readLimited(post('x'.repeat(MAX_BODY_BYTES)), MAX_BODY_BYTES)).toHaveLength(MAX_BODY_BYTES);
    expect(await readLimited(post('x'.repeat(MAX_BODY_BYTES + 1)), MAX_BODY_BYTES)).toBeNull();
  });
});
