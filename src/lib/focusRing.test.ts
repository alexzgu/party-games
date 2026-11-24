import { expect, it } from 'vitest';
import { wrapTo } from './focusRing';

it('wraps Tab at both ends of a popup and leaves the steps between to the browser', () => {
  const all = ['x', 'a', 'b'];
  expect([wrapTo(all, 'b', false), wrapTo(all, 'x', true)]).toEqual(['x', 'b']);
  expect([wrapTo(all, 'x', false), wrapTo(all, 'a', true), wrapTo(all, 'a', false)]).toEqual([null, null, null]);
  // Not on a control (the popup's text, a control that went, something behind): its first, or with Shift its last.
  expect([wrapTo(all, null, false), wrapTo(all, null, true), wrapTo([], null, false)]).toEqual(['x', 'b', null]);
});
