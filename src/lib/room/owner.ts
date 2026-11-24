// One tab on a device owns a game's saved room (its game save and seat record, both kept under the
// game's name) at a time, whatever broker each tab uses: the first host screen to ask holds a Web
// Lock until it closes the room or the tab goes. A browser without Web Locks lets every tab own it.

interface Hold { owned: Promise<boolean>; release: () => void }
const holds = new Map<string, Hold>();

/** Whether this tab owns the game's saved room: asked once, then kept until `release`. */
export function own(game: string): Promise<boolean> {
  // One lock per game, not per room id: every room of a game is saved under the same name, so a
  // second tab that started a room of its own would still overwrite the first tab's.
  let hold = holds.get(game);
  if (!hold) {
    hold = claim(`jerkbox-${game}-room`);
    holds.set(game, hold);
    const mine = hold;
    void mine.owned.then((yes) => { if (!yes && holds.get(game) === mine) holds.delete(game); }); // asked again next time
  }
  return hold.owned;
}

/** The room is closed: another tab may take the game's save from now on. */
export function release(game: string): void {
  holds.get(game)?.release();
  holds.delete(game);
}

function claim(name: string): Hold {
  const locks = globalThis.navigator?.locks;
  let gone = false;
  const hold: Hold = { owned: Promise.resolve(true), release: () => { gone = true; } };
  if (!locks) return hold;
  hold.owned = new Promise<boolean>((answer) => {
    locks.request(name, { ifAvailable: true }, (lock) => {
      answer(!!lock);
      return lock && !gone ? new Promise<void>((done) => { hold.release = done; }) : undefined;
    }).catch(() => answer(false));
  });
  return hold;
}

/** What a host screen shows when another tab has the game's room. */
export const ELSEWHERE = 'This game is open in another tab on this device. Play there, or close the room there and come back.';
