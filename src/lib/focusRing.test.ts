import { expect, it } from 'vitest';
import { wrapTo } from './focusRing';

it('wraps Tab at both ends of a popup and leaves the steps between to the browser', () => {
  const all = ['x', 'a', 'b'];
  expect([wrapTo(all, 'b', false), wrapTo(all, 'x', true)]).toEqual(['x', 'b']);
  expect([wrapTo(all, 'x', false), wrapTo(all, 'a', true), wrapTo(all, 'a', false)]).toEqual([null, null, null]);
  // On the popup itself (a tap on its text): Shift+Tab goes to the last control.
  expect([wrapTo(all, null, true), wrapTo([], null, false)]).toEqual(['b', null]);
});
