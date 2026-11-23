import { describe, expect, it } from 'vitest';
import { clampInto, isDoubleTap, isTap } from './drag';
import { countdown, pause, reset, running, start, timeLeft, toggle } from './countdown';

describe('dragging a floating box', () => {
  it('keeps the box wholly on screen', () => {
    const size = { w: 100, h: 50 }, area = { w: 375, h: 667 };
    expect(clampInto({ x: -40, y: 900 }, size, area)).toEqual({ x: 8, y: 609 });
    expect(clampInto({ x: 400, y: -5 }, size, area)).toEqual({ x: 267, y: 8 });
    expect(clampInto({ x: 120, y: 300 }, size, area)).toEqual({ x: 120, y: 300 });
  });

  it('tells a tap from a drag', () => {
    expect(isTap({ x: 10, y: 10 }, { x: 14, y: 13 })).toBe(true);
    expect(isTap({ x: 10, y: 10 }, { x: 30, y: 10 })).toBe(false);
  });

  it('tells a double tap: two quick taps on bare spots close together, nothing else', () => {
    const press = (x: number, time: number, bareTap = true) => ({ at: { x, y: 10 }, time, bareTap });
    expect(isDoubleTap(press(10, 0), press(14, 300))).toBe(true);
    expect(isDoubleTap(null, press(10, 0))).toBe(false);
    expect(isDoubleTap(press(10, 0), press(10, 600))).toBe(false);
    expect(isDoubleTap(press(10, 0), press(60, 200))).toBe(false);
    expect(isDoubleTap(press(10, 0, false), press(10, 200))).toBe(false);
    expect(isDoubleTap(press(10, 0), press(10, 200, false))).toBe(false);
  });
});

describe('countdown', () => {
  it('runs, pauses and resumes', () => {
    let c = start(countdown(20_000), 1000);
    expect(timeLeft(c, 6000)).toBe(15_000);
    c = pause(c, 6000);
    expect(timeLeft(c, 60_000)).toBe(15_000);
    c = toggle(c, 70_000);
    expect(running(c, 71_000)).toBe(true);
    expect(timeLeft(c, 71_000)).toBe(14_000);
  });

  it('stops at zero and starts over from full', () => {
    const c = start(countdown(10_000), 0);
    expect(timeLeft(c, 12_000)).toBe(0);
    expect(running(c, 12_000)).toBe(false);
    expect(timeLeft(toggle(c, 12_000), 12_000)).toBe(10_000);
    expect(reset(c, 30_000)).toEqual({ length: 30_000, left: 30_000, since: null });
  });
});
