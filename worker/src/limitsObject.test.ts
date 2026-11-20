// The Durable Object end of a refund: it carries the day it was reserved on, so a refund
// arriving after UTC midnight leaves the new day's counts alone.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Limits, type LimitOp, type LimitReply } from './limitsObject';

afterEach(() => vi.restoreAllMocks());

describe('Limits object', () => {
  it("binds a refund to its reservation's day", async () => {
    const data = new Map<string, unknown>();
    const obj = new Limits({ storage: { get: async <T>(k: string) => data.get(k) as T | undefined, put: async <T>(k: string, v: T) => void data.set(k, v) } });
    const run = async (op: LimitOp, at: number) => {
      vi.spyOn(Date, 'now').mockReturnValue(at);
      return (await (await obj.fetch(new Request('https://limits.internal/', { method: 'POST', body: JSON.stringify(op) }))).json()) as LimitReply;
    };
    const midnight = Date.UTC(2026, 10, 21);
    const late = await run({ op: 'spend', session: 's' }, midnight - 1000);
    expect(late).toEqual({ ok: true, day: '2026-11-20' });
    expect(await run({ op: 'spend', session: 's' }, midnight + 1000)).toEqual({ ok: true, day: '2026-11-21' });
    await run({ op: 'unspend', session: 's', day: late.ok ? late.day! : '' }, midnight + 2000);
    expect(data.get('budget')).toEqual({ day: '2026-11-21', total: 1, bySession: { s: 1 } });
  });
});
