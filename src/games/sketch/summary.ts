import type { Settings } from './core';

export const modeName = (s: Settings) => s.mode === 'telephone' ? 'Telephone' : 'Draw & guess';

/** The settings page's Rules row (the mode's timers), in plain words. */
export const settingsSummary = (s: Settings): string => s.mode === 'telephone'
  ? `${s.writeSecs} s to write · ${s.drawSecs} s to draw`
  : `${s.rounds} ${s.rounds === 1 ? 'round' : 'rounds'} · ${s.guessSecs} s to draw`;
