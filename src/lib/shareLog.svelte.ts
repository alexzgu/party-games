// What this phone knows about its packs in the Community library: for each pack the library took,
// a short fingerprint of the version it took (`packPrint` in library.ts) and the id the library
// knows it by (the pack's id then: the same pass, game and id update one entry); and which packs
// are being sent right now. Kept apart from the packs, so no pack save or pack file ever carries
// or drops it; reactive, so a share that lands while an editor is open updates its button.
import { moveOwned } from './communityMarks.svelte';
import { load, save } from './storage';

export interface SharedRecord {
  /** `packPrint` of the version the library took. */
  print: string;
  /** The id the library knows the pack by; it stays when the pack's id on the phone changes. */
  localId: string;
}

const KEY = 'library:sent';
const sent = $state<Record<string, SharedRecord>>(load<Record<string, SharedRecord>>(KEY, {}));
const sending = $state<Record<string, true>>({});

const slot = (game: string, id: string) => `${game}:${id}`;
const keep = () => save(KEY, $state.snapshot(sent));

/** What the library last took of this pack from this phone, if it took it at all. */
export const lastShared = (game: string, id: string): SharedRecord | undefined => sent[slot(game, id)];

export function noteShared(game: string, id: string, record: SharedRecord): void {
  sent[slot(game, id)] = record;
  keep();
}

/** The pack's id on this phone changed (content.ts moves an own pack off a new built-in's id): its record goes with it, and it stays owned in Community. */
export function moveShared(game: string, from: string, to: string): void {
  moveOwned(game, from, to);
  const r = sent[slot(game, from)];
  if (!r) return;
  sent[slot(game, to)] = r;
  delete sent[slot(game, from)];
  keep();
}

/** True while this pack is on its way to the library. */
export const isSending = (game: string, id: string): boolean => sending[slot(game, id)] === true;

export function setSending(game: string, id: string, on: boolean): void {
  if (on) sending[slot(game, id)] = true;
  else delete sending[slot(game, id)];
}
