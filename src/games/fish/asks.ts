// The one ask a phone may still need to send again after a reconnect: its latest, while its turn is
// in play and until the host refuses it (lib/room/latest.ts).
import { LatestMove } from '../../lib/room/latest';
import type { ToHost } from './protocol';

export class LatestAsk extends LatestMove<ToHost> {}
