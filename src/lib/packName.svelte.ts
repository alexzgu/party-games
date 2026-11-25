// The name of a pack on a make page's review screen, in every game: for Fizzwick's packs it starts
// as the request's first few words, takes the name he suggests, and once the player types in it,
// nothing replaces it while that pack is on screen ("More" and "Try again" included). A typed name
// belongs to the pack it was typed for: a run started in another way (paste, by hand, wizard) or
// with other words is a new pack, and starts afresh.
import { cleanName, cleanRequest, NAME_MAX, nameFrom } from './wizardAsk';

export class PackName {
  value = $state('');
  #typed = false;
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
    this.value = value;
    this.#typed = true;
  }

  /** Back to the request: a name the player typed stays (for this same pack); anything else goes. */
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
