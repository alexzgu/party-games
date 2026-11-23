// The Community packs this phone skips: one storage key each, by game and Community id, so two
// tabs marking different packs never overwrite each other. (Which packs it has: `ownedIds` in
// library.ts, read from the packs themselves.)
import { load, remove, trySave } from './storage';

const key = (game: string, id: string) => `community:skip:${game}:${id}`;

/** Bumped when a mark may have changed, here or in another tab. */
let changes = $state(0);

/** Read again what another tab may have changed. */
export function rereadMarks(): void { changes++; }

export function isSkipped(game: string, id: string): boolean {
  void changes;
  return load<unknown>(key(game, id), null) === true;
}

/** False when there was no room to store it. */
export function setSkipped(game: string, id: string, on: boolean): boolean {
  const done = on ? trySave(key(game, id), true) : (remove(key(game, id)), true);
  changes++;
  return done;
}
