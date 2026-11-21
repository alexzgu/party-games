import { describe, expect, it } from 'vitest';
import { cleanKept } from './keepScroll';

describe('cleanKept', () => {
  it('keeps each part’s scroll', () => {
    expect(cleanKept({ packs: 340, screen: 0 })).toEqual({ packs: 340, screen: 0 });
  });
  it('drops what a history entry should not hold', () => {
    expect(cleanKept(undefined)).toEqual({});
    expect(cleanKept([3])).toEqual({});
    expect(cleanKept({ packs: '340', screen: -5, other: Number.NaN, ok: 12 })).toEqual({ ok: 12 });
  });
});
