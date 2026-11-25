// "Ask for changes" on one review screen: runs a change (wizardChange.ts) against what is on
// screen, keeps the thread of changes and the reviews before them for Undo, and puts everything
// back when a change fails, is refused, is stopped or brings nothing: asking never loses a list.
// `Changes` is the mechanism for any screen (`ChangeTarget`); `WizardChanges` fits it to a list
// review, which hands over its list, its dropped marks and its pack name.
import { streamChange, tally, resultLine, type ChangeGame } from './wizardChange';
import type { NameSnapshot, PackName } from './packName.svelte';

/** A pack name a change can ask for again: `PackName`, or a board's own name. */
export interface ChangeName {
  readonly wanted: boolean;
  /** A change starts: a name the player has not typed is wanted again. */
  askAgain(): void;
  suggest(raw: string): void;
}

/** What a screen hands a change; `S` is the whole review as it stands, to put back. */
export interface ChangeTarget<T, A, S> {
  game: () => ChangeGame<T, A>;
  /** What the player first asked for, and how many. */
  request: () => string;
  asked: () => number;
  /** What a first run avoids, never what is on screen. */
  avoid: () => A[];
  /** The pack's name, or null when the items go into a pack that already has one. */
  name: () => ChangeName | null;
  save: () => S;
  /** Puts a saved review back, name included. */
  restore: (s: S) => void;
  /** The items of a saved review the player kept (Fizzwick's list as it stands) and removed. */
  parts: (s: S) => { kept: T[]; removed: T[] };
  /** Empties the screen for the new list; then each new item as it lands; then the items on screen. */
  clear: () => void;
  add: (t: T) => void;
  items: () => T[];
  /** A change starts from this review (for the share decision). */
  onStart?: (s: S) => void;
}

export const NOTHING_BACK = 'Nothing usable came back, so your list is as it was. Try other words.';

export class Changes<T, A, S> {
  /** Each change applied, oldest first: what the player asked and Fizzwick's result line. */
  thread = $state<{ ask: string; result: string }[]>([]);
  busy = $state(false);
  error = $state('');
  /** What the player is typing in the box, kept here so it outlives the box (hidden while Fizzwick writes). */
  draft = $state('');
  /** The review before each change in the thread, for Undo. */
  #before = $state.raw<S[]>([]);
  #ctrl: AbortController | null = null;
  #t: ChangeTarget<T, A, S>;

  constructor(target: ChangeTarget<T, A, S>) {
    this.#t = target;
  }

  get canUndo(): boolean {
    return this.#before.length > 0 && !this.busy;
  }

  /** Asks Fizzwick to change the list; resolves once the screen shows the new list or the old one again. */
  async ask(text: string): Promise<void> {
    const ask = text.trim();
    if (!ask || this.busy) return;
    const t = this.#t;
    const before = t.save();
    const { kept, removed } = t.parts(before);
    const game = t.game();
    t.onStart?.(before);
    const name = t.name();
    name?.askAgain();
    const named = !!name && name.wanted;
    this.error = '';
    this.busy = true;
    t.clear();
    const ctrl = (this.#ctrl = new AbortController());
    try {
      const { n, capped } = await streamChange(game, {
        request: t.request(), asked: t.asked(), kept, removed, earlier: this.thread.map((e) => e.ask), ask,
        avoid: t.avoid(), named, signal: ctrl.signal, onItem: t.add,
        onName: named ? (raw) => name!.suggest(raw) : undefined,
      });
      if (ctrl.signal.aborted) return t.restore(before);
      if (n === 0) {
        t.restore(before);
        this.error = NOTHING_BACK;
        return;
      }
      this.#before = [...this.#before, before];
      this.thread.push({ ask, result: resultLine(tally([...kept, ...removed], t.items(), game.keyOf), capped) });
      if (this.draft.trim() === ask) this.draft = '';
    } catch (e) {
      t.restore(before);
      this.error = (e as Error).message;
    } finally {
      if (this.#ctrl === ctrl) this.#ctrl = null;
      this.busy = false;
    }
  }

  /** Stops a change: the review before it comes back. */
  stop(): void {
    this.#ctrl?.abort();
  }

  /** Brings back the review as it was before the last change, and takes that change off the thread. */
  undo(): void {
    const r = this.#before.at(-1);
    if (r === undefined || this.busy) return;
    this.#before = this.#before.slice(0, -1);
    this.#t.restore(r);
    this.thread.pop();
    this.error = '';
  }

  /** More items were added on top ("More"): the reviews before are no longer what Undo should bring back. */
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

/** The list review as it stood: the list, its dropped marks (keys) and the pack name. */
interface ListReview<T> { items: T[]; dropped: Set<string>; name: NameSnapshot | null }

/** What a list review screen hands over. */
export interface ChangeScreen<T, A> {
  game: ChangeGame<T, A>;
  request: () => string;
  asked: () => number;
  avoid: () => A[];
  items: () => T[];
  setItems: (items: T[]) => void;
  dropped: () => Set<string>;
  setDropped: (keys: Set<string>) => void;
  name: () => PackName | null;
  /** Each new item as it lands (a tick). */
  onItem?: () => void;
  /** A change starts, with this many items on screen (for the share decision: `passedSoFar`). */
  onStart?: (onScreen: number) => void;
}

/** "Ask for changes" on a list review: the items the player dropped are the removed ones. */
export class WizardChanges<T, A = T> extends Changes<T, A, ListReview<T>> {
  constructor(s: ChangeScreen<T, A>) {
    const keyOf = s.game.keyOf;
    super({
      game: () => s.game, request: s.request, asked: s.asked, avoid: s.avoid, name: s.name, items: s.items,
      save: () => {
        const name = s.name();
        return { items: $state.snapshot(s.items()) as T[], dropped: new Set(s.dropped()), name: name ? name.snapshot() : null };
      },
      restore: (r) => {
        s.setItems(r.items);
        s.setDropped(r.dropped);
        if (r.name) s.name()?.restore(r.name);
      },
      parts: (r) => ({ kept: r.items.filter((t) => !r.dropped.has(keyOf(t))), removed: r.items.filter((t) => r.dropped.has(keyOf(t))) }),
      clear: () => { s.setItems([]); s.setDropped(new Set()); },
      add: (t) => { s.setItems([...s.items(), t]); s.onItem?.(); },
      onStart: (r) => s.onStart?.(r.items.length),
    });
  }
}
