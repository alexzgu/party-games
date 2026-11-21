// The one Durable Object (named "global") that keeps the guess and allowance counters. Cloudflare
// runs one request at a time through it and holds other events while storage is read and
// written, so each reserve-then-store below is atomic.
import type { DurableObjectNamespaceLike, DurableObjectStateLike } from './env';
import {
  emptyGuesses, refundBudget, refundGuess, takeBudget, takeGuess, takeRedeem, utcDay,
  type BudgetState, type GuessState, type RedeemState, type Scope,
} from './limits';

export type LimitOp =
  /** `address` and `network` are labels from address.ts. */
  | { op: 'guess'; address: string; network: string }
  /** The guess taken at `at` (`fresh` as the guess reply said) was right: give it back and count a redemption instead. */
  | { op: 'redeemed'; address: string; network: string; at: number; fresh?: boolean }
  | { op: 'spend'; session: string }
  /** Give back a reservation made on UTC day `day`. */
  | { op: 'unspend'; session: string; day: string };

/** `at` and `fresh` answer a guess (for `redeemed`), `day` a spend (for `unspend`). */
export type LimitReply = { ok: true; at?: number; fresh?: boolean; day?: string } | { ok: false; retryAfter: number; scope: Scope };

const refused = (r: { retryAfter: number; scope: Scope }): LimitReply => ({ ok: false, retryAfter: r.retryAfter, scope: r.scope });

export class Limits {
  constructor(private readonly ctx: DurableObjectStateLike) {}

  async fetch(request: Request): Promise<Response> {
    const op = (await request.json()) as LimitOp;
    return Response.json(await this.apply(op, Date.now()));
  }

  /**
   * Stores `next` only when it differs from what was read: a refusal or a refund with nothing
   * to give back writes nothing, so a flood of refused requests costs no storage writes.
   */
  private async keep<T>(key: string, before: T | undefined, next: T): Promise<void> {
    if (before !== undefined && JSON.stringify(before) === JSON.stringify(next)) return;
    await this.ctx.storage.put(key, next);
  }

  private async apply(op: LimitOp, now: number): Promise<LimitReply> {
    const storage = this.ctx.storage;
    if (op.op === 'guess' || op.op === 'redeemed') {
      // A state stored before the fresh-address fields existed is filled in by takeGuess and refundGuess.
      const stored = await storage.get<Partial<GuessState>>('guesses');
      const state = stored ?? emptyGuesses();
      if (op.op === 'guess') {
        const r = takeGuess(state, op.address, now, op.network);
        if (!r.ok) return refused(r);
        await storage.put('guesses', r.state);
        return { ok: true, at: now, fresh: r.fresh };
      }
      await this.keep('guesses', stored, refundGuess(state, op.address, op.at, { network: op.network, fresh: op.fresh === true }));
      const r = takeRedeem(await storage.get<RedeemState>('redeems'), op.address, now);
      if (!r.ok) return refused(r);
      await storage.put('redeems', r.state);
      return { ok: true };
    }
    const state = await storage.get<BudgetState>('budget');
    if (op.op === 'unspend') {
      await this.keep('budget', state, refundBudget(state, op.session, op.day, now));
      return { ok: true };
    }
    const r = takeBudget(state, op.session, now);
    if (!r.ok) return refused(r);
    await storage.put('budget', r.state);
    return { ok: true, day: utcDay(now) };
  }
}

/** Sends one operation to the global Limits object. */
export async function limit(ns: DurableObjectNamespaceLike, op: LimitOp): Promise<LimitReply> {
  const stub = ns.get(ns.idFromName('global'));
  const res = await stub.fetch('https://limits.internal/', { method: 'POST', body: JSON.stringify(op) });
  return (await res.json()) as LimitReply;
}
