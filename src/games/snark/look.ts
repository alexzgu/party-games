// Snark Tank's own formatting; the shared helpers live in src/lib/room/look.ts.
import { joinLink as roomLink } from '../../lib/room/look';

export { initial, ordinal, playerColor, secs } from '../../lib/room/look';

export const roundName = (round: number, rounds: number) => (round >= rounds ? 'Final round' : `Round ${round}`);

/** The address phones open to join this room, carrying a non-default broker with it. */
export const joinLink = (code: string, broker: string) => roomLink('snark', code, broker);
