// "Ask for changes" on one review screen: runs a change (wizardChange.ts) against the list on
// screen, keeps the thread of changes and the lists before them for Undo, and puts everything
// back when a change fails, is refused, is stopped or brings nothing: asking never loses a list.
// The screen hands over its list, its dropped marks and its pack name; nothing else is per game.
import { streamChange, tally, resultLine, type ChangeGame } from './wizardChange';
import type { NameSnapshot, PackName } from './packName.svelte';

/** The review as it stood: the list, its dropped marks (keys) and the pack name. */
interface Review<T> { items: T[]; dropped: Set<string>; name: NameSnapshot | null }

export interface ChangeScreen<T, A> {
  game: ChangeGame<T, A>;
  /** What the player first asked for, and how many. */
  request: () => string;
  asked: () => number;
  /** What a first run avoids, never the list on screen. */
  avoid: () => A[];
  items: () => T[];
  setItems: (items: T[]) => void;
  dropped: () => Set<string>;
  setDropped: (keys: Set<string>) => void;
  /** The pack's name, or null when the items go into a pack that already has one. */
  name: () => PackName | null;
  /** Each new item as it lands (a tick). */
  onItem?: () => void;
  /** A change starts, with this many items on screen (for the share decision: `passedSoFar`). */
  onStart?: (onScreen: number) => void;
}

export const NOTHING_BACK = 'Nothing usable came back, so your list is as it was. Try other words.';

export class WizardChanges<T, A = T> {
  /** Each change applied, oldest first: what the player asked and Fizzwick's result line. */
  thread = $state<{ ask: string; result: string }[]>([]);
  busy = $state(false);
  error = $state('');
  /** What the player is typing in the box, kept here so it outlives the box (hidden while Fizzwick writes). */
  draft = $state('');
  /** The review before each change in the thread, for Undo. */
  #before = $state.raw<Review<T>[]>([]);
  #ctrl: AbortController | null = null;
  #s: ChangeScreen<T, A>;

  constructor(screen: ChangeScreen<T, A>) {
    this.#s = screen;
  }

  get canUndo(): boolean {
    return this.#before.length > 0 && !this.busy;
  }

  #snapshot(): Review<T> {
    const name = this.#s.name();
    return { items: $state.snapshot(this.#s.items()) as T[], dropped: new Set(this.#s.dropped()), name: name ? name.snapshot() : null };
  }

  #restore(r: Review<T>): void {
    this.#s.setItems(r.items);
    this.#s.setDropped(r.dropped);
    if (r.name) this.#s.name()?.restore(r.name);
  }

  /** Asks Fizzwick to change the list; resolves once the list on screen is the new one or the old one again. */
  async ask(text: string): Promise<void> {
    const ask = text.trim();
    if (!ask || this.busy) return;
    const s = this.#s;
    const before = this.#snapshot();
    const keyOf = s.game.keyOf;
    const kept = before.items.filter((t) => !before.dropped.has(keyOf(t)));
    const removed = before.items.filter((t) => before.dropped.has(keyOf(t)));
    s.onStart?.(before.items.length);
    const name = s.name();
    name?.askAgain();
    const named = !!name && name.wanted;
    this.error = '';
    this.busy = true;
    s.setItems([]);
    s.setDropped(new Set());
    const ctrl = (this.#ctrl = new AbortController());
    try {
      const { n, capped } = await streamChange(s.game, {
        request: s.request(), asked: s.asked(), kept, removed, earlier: this.thread.map((e) => e.ask), ask,
        avoid: s.avoid(), named, signal: ctrl.signal,
        onItem: (t) => { s.setItems([...s.items(), t]); s.onItem?.(); },
        onName: named ? (raw) => name!.suggest(raw) : undefined,
      });
      if (ctrl.signal.aborted) return this.#restore(before);
      if (n === 0) {
        this.#restore(before);
        this.error = NOTHING_BACK;
        return;
      }
      this.#before = [...this.#before, before];
      this.thread.push({ ask, result: resultLine(tally(before.items, s.items(), keyOf), capped) });
      if (this.draft.trim() === ask) this.draft = '';
    } catch (e) {
      this.#restore(before);
      this.error = (e as Error).message;
    } finally {
      if (this.#ctrl === ctrl) this.#ctrl = null;
      this.busy = false;
    }
  }

  /** Stops a change: the list before it comes back. */
  stop(): void {
    this.#ctrl?.abort();
  }

  /** Brings back the review as it was before the last change, and takes that change off the thread. */
  undo(): void {
    const r = this.#before.at(-1);
    if (!r || this.busy) return;
    this.#before = this.#before.slice(0, -1);
    this.#restore(r);
    this.thread.pop();
    this.error = '';
  }

  /** More items were added on top ("More"): the lists before are no longer what Undo should bring back. */
  settle(): void {
    this.#before = [];
  }

  /** The review is gone (saved, discarded): start afresh. */
  clear(): void {
    this.stop();
    this.#before = [];
    this.thread = [];
    this.error = '';
    this.draft = '';
  }
}
