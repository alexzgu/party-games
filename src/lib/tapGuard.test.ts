import { describe, expect, it } from 'vitest';
import { TAP_GUARD_MS, tapGuard } from './tapGuard';

describe('tap guard', () => {
  it('ignores taps until the guard time has passed since the control appeared', () => {
    let t = 1000;
    const ready = tapGuard(TAP_GUARD_MS, () => t);
    t += 399;
    expect(ready()).toBe(false);
    t += 1;
    expect(ready()).toBe(true);
  });

  it('lets every tap through with no guard', () => {
    expect(tapGuard(0, () => 5)()).toBe(true);
  });
});
