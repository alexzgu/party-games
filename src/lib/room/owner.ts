// One tab on a device owns a game's saved room (its game save and seat record, both kept under the
// game's name) at a time, whatever broker each tab uses: the first host screen to ask holds a Web
// Lock until it closes the room or the tab goes. Without working Web Locks no tab can be sure it
// is the only one, so it may host but trusts no saved seat record.

/** 'mine': this tab owns the room. 'taken': another tab does. 'unlocked': no Web Locks here. */
export type Owner = 'mine' | 'taken' | 'unlocked';

interface Hold { owner: Promise<Owner>; release: () => void }
const holds = new Map<string, Hold>();

/** Who owns the game's saved room: asked once, then kept until `release`. */
export function own(game: string): Promise<Owner> {
  // One lock per game, not per room id: every room of a game is saved under the same name, so a
  // second tab that started a room of its own would still overwrite the first tab's.
  let hold = holds.get(game);
  if (!hold) {
    hold = claim(`jerkbox-${game}-room`);
    holds.set(game, hold);
    const mine = hold;
    void mine.owner.then((o) => { if (o === 'taken' && holds.get(game) === mine) holds.delete(game); }); // asked again next time
  }
  return hold.owner;
}

/** The room is closed: another tab may take the game's save from now on. */
export function release(game: string): void {
  holds.get(game)?.release();
  holds.delete(game);
}

function claim(name: string): Hold {
  const locks = globalThis.navigator?.locks;
  let gone = false;
  const hold: Hold = { owner: Promise.resolve('unlocked'), release: () => { gone = true; } };
  if (typeof locks?.request !== 'function') return hold;
  hold.owner = new Promise<Owner>((answer) => {
    locks.request(name, { ifAvailable: true }, (lock) => {
      answer(lock ? 'mine' : 'taken');
      return lock && !gone ? new Promise<void>((done) => { hold.release = done; }) : undefined;
    }).catch(() => answer('unlocked'));
  });
  return hold;
}

/** What a host screen shows when another tab has the game's room. */
export const ELSEWHERE = 'This game is open in another tab on this device. Play there, or close the room there and come back.';
