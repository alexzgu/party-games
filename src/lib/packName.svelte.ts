// The name of a pack on a make page's review screen, in every game: for Fizzwick's packs it starts
// as the request's first few words, takes the name he suggests, and once the player types in it,
// nothing replaces it while that pack is on screen ("More" and "Try again" included). A typed name
// belongs to the pack it was typed for: a run started in another way (paste, by hand, wizard) or
// with other words is a new pack, and starts afresh. A typed name is never replaced: while Fizzwick
// rewrites the pack the field is read-only, and putting an earlier name back (a failed or stopped
// change, Undo) happens only when the player has not typed since that name was on screen.
import { cleanName, cleanRequest, NAME_MAX, nameFrom } from './wizardAsk';

export interface NameSnapshot { value: string; typed: boolean; suggested: boolean; for: string | null; typings: number }

export class PackName {
  value = $state('');
  /** Read-only while Fizzwick rewrites the pack ("Ask for changes"). */
  locked = $state(false);
  #typed = false;
  /** How many times the player has typed in the field. */
  #typings = 0;
  #suggested = false;
  /** The way and the request of the pack on screen ("wizard\u0000pastries"). */
  #for: string | null = null;

  /** Whether the next run should ask Fizzwick for a name: the player has not typed one and he has not given a good one. */
  get wanted(): boolean {
    return !this.#typed && !this.#suggested;
  }

  /**
   * A run starts (`mode`: how the pack is made, e.g. "wizard" or "paste"). A pack made another way
   * or from other words forgets the name typed or suggested before. A name nobody has set yet
   * shows the request's first few words, else `empty` ("" leaves the field to its placeholder).
   */
  begin(mode: string, request: string, empty: string): void {
    const pack = `${mode}\u0000${cleanRequest(request)}`;
    if (pack !== this.#for) {
      this.#for = pack;
      this.#typed = false;
      this.#suggested = false;
    }
    if (this.wanted) this.value = nameFrom(request, empty);
  }

  /** Fizzwick's suggestion: taken only when it is a good name and the player has not typed one. */
  suggest(raw: string): void {
    const n = cleanName(raw);
    if (this.#typed || !n) return;
    this.value = n;
    this.#suggested = true;
  }

  /** The player typed in the field. */
  type(value: string): void {
    if (this.locked) return;
    this.value = value;
    this.#typed = true;
    this.#typings++;
  }

  /** Makes the field read-only (`on`) or editable again. */
  hold(on: boolean): void {
    this.locked = on;
  }

  /** Back to the request: a name the player typed stays (for this same pack); anything else goes. */
  reset(): void {
    if (this.#typed) return;
    this.#suggested = false;
    this.value = '';
  }

  /** A change is asked for: a name the player has not typed is asked of Fizzwick again (the old one may no longer fit). */
  askAgain(): void {
    if (!this.#typed) this.#suggested = false;
  }

  /** Everything about the name, to put back on Undo or when a change fails. */
  snapshot(): NameSnapshot {
    return { value: this.value, typed: this.#typed, suggested: this.#suggested, for: this.#for, typings: this.#typings };
  }

  /** Puts `s` back, unless the player has typed since it was taken: the field then stays theirs. */
  restore(s: NameSnapshot): void {
    if (s.typings !== this.#typings) return;
    this.value = s.value;
    this.#typed = s.typed;
    this.#suggested = s.suggested;
    this.#for = s.for;
  }

  /** The name to save under: what is in the field, else the request's first words, else `empty`. */
  saved(request: string, empty: string): string {
    return this.value.trim().slice(0, NAME_MAX) || nameFrom(request, empty);
  }
}
