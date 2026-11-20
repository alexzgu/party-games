import { render } from 'svelte/server';
import { expect, it } from 'vitest';
import Listen from './Listen.svelte';
import { newGame } from './logic';

it('offers retry in the listen phase while keeping the saved clip length', () => {
  const noop = () => {};
  const game = newGame(['A', 'B'], { target: 10, packIds: [] }, { apple: 1, title: 'Song', artist: 'Artist' });
  const { body } = render(Listen, {
    props: {
      game: { ...game, phase: 'listen', step: 1 }, status: 'error', connection: 'failed',
      onretry: noop, onagain: noop, onlonger: noop, onaward: noop, onnobody: noop, onskip: noop, onleave: noop,
    },
  });
  expect(body).toContain('Can’t reach Apple Music');
  const html = body.replace(/<!--.*?-->/g, '');
  expect(html).toMatch(/<button[^>]*>\s*Retry\s*<\/button>/);
  expect(body).toContain('5 s');
  expect(html).toMatch(/disabled[^>]*>\s*↺ Again/);
});
