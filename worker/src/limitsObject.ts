// The one Durable Object (named "global") that keeps the guess and allowance counters. Cloudflare
// runs one request at a time through it and holds other events while storage is read and
// written, so each reserve-then-store below is atomic.
import type { DurableObjectNamespaceLike, DurableObjectStateLike } from './env';
import {
  emptyGuesses, refundBudget, refundGuess, takeBudget, takeGuess, takeRedeem, utcDay,
  type BudgetState, type GuessState, type RedeemState, type Scope,
} from './limits';

export type LimitOp =
  | { op: 'guess'; address: string }
  /** The guess taken at `at` was right: give it back and count a redemption instead. */
  | { op: 'redeemed'; address: string; at: number }
  | { op: 'spend'; session: string }
  /** Give back a reservation made on UTC day `day`. */
  | { op: 'unspend'; session: string; day: string };

/** `at` answers a guess (for `redeemed`), `day` a spend (for `unspend`). */
export type LimitReply = { ok: true; at?: number; day?: string } | { ok: false; retryAfter: number; scope: Scope };

export class Limits {
  constructor(private readonly ctx: DurableObjectStateLike) {}

  async fetch(request: Request): Promise<Response> {
    const op = (await request.json()) as LimitOp;
    return Response.json(await this.apply(op, Date.now()));
  }

  private async apply(op: LimitOp, now: number): Promise<LimitReply> {
    const storage = this.ctx.storage;
    if (op.op === 'guess' || op.op === 'redeemed') {
      const state = (await storage.get<GuessState>('guesses')) ?? emptyGuesses();
      if (op.op === 'guess') {
        const r = takeGuess(state, op.address, now);
        await storage.put('guesses', r.state);
        return r.ok ? { ok: true, at: now } : { ok: false, retryAfter: r.retryAfter, scope: r.scope };
      }
      await storage.put('guesses', refundGuess(state, op.address, op.at));
      const r = takeRedeem(await storage.get<RedeemState>('redeems'), op.address, now);
      await storage.put('redeems', r.state);
      return r.ok ? { ok: true } : { ok: false, retryAfter: r.retryAfter, scope: r.scope };
    }
    const state = await storage.get<BudgetState>('budget');
    if (op.op === 'unspend') {
      await storage.put('budget', refundBudget(state, op.session, op.day, now));
      return { ok: true };
    }
    const r = takeBudget(state, op.session, now);
    await storage.put('budget', r.state);
    return r.ok ? { ok: true, day: utcDay(now) } : { ok: false, retryAfter: r.retryAfter, scope: r.scope };
  }
}

/** Sends one operation to the global Limits object. */
export async function limit(ns: DurableObjectNamespaceLike, op: LimitOp): Promise<LimitReply> {
  const stub = ns.get(ns.idFromName('global'));
  const res = await stub.fetch('https://limits.internal/', { method: 'POST', body: JSON.stringify(op) });
  return (await res.json()) as LimitReply;
}
