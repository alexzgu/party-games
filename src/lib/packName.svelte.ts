// The name of a pack Fizzwick is making, on the review screen of every game: it starts as the
// request's first few words, takes the name Fizzwick suggests, and once the player types in it,
// nothing ever replaces it ("More" and "Try again" included).
import { cleanName, NAME_MAX, nameFrom } from './wizardAsk';

export class PackName {
  value = $state('');
  #typed = false;
  #suggested = false;

  /** Whether the next run should ask Fizzwick for a name: the player has not typed one and he has not given a good one. */
  get wanted(): boolean {
    return !this.#typed && !this.#suggested;
  }

  /** A run starts: a name nobody has set yet shows the request's first few words (or `empty`). */
  begin(request: string, empty: string): void {
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
    this.value = value;
    this.#typed = true;
  }

  /** Back to the request: a name the player typed stays; anything else goes. */
  reset(): void {
    if (this.#typed) return;
    this.#suggested = false;
    this.value = '';
  }

  /** The name to save under: what is in the field, else the request's first words, else `empty`. */
  saved(request: string, empty: string): string {
    return this.value.trim().slice(0, NAME_MAX) || nameFrom(request, empty);
  }
}
