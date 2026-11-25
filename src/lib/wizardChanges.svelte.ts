// "Ask for changes" on one review screen: runs a change (wizardChange.ts) against what is on
// screen, keeps the thread of changes and the reviews before them for Undo, and puts everything
// back when a change fails, is refused, is stopped or brings nothing: asking never loses a list.
// `Changes` is the mechanism for any screen (`ChangeTarget`); `WizardChanges` fits it to a list
// review, which hands over its list, its dropped marks and its pack name.
// Rules kept here, so no screen can forget them: a change and a first run never write at once
// (`writing`); leaving the screen stops a change; Undo is offered only while nothing has been
// changed by hand since the change; the pack name is read-only while a change streams.
import { onDestroy } from 'svelte';
import { oneLine, streamChange, tally, resultLine, type ChangeGame } from './wizardChange';
import type { NameSnapshot, PackName } from './packName.svelte';

/** What a screen hands a change; `S` is the whole review as it stands, to put back. */
export interface ChangeTarget<T, A, S> {
  /** The game's change rules for a change starting from review `s`. */
  game: (s: S) => ChangeGame<T, A>;
  /** What the player first asked for, and how many. */
  request: () => string;
  asked: () => number;
  /** What a first run avoids, never what is on screen. */
  avoid: () => A[];
  /** The new pack's name; null when the items go into a pack that already exists (no changes offered then). */
  name: () => PackName | null;
  /** Whether the screen's own first run (or "More") is writing. */
  running: () => boolean;
  save: () => S;
  /** Puts a saved review back (the name follows PackName's rule). */
  restore: (s: S) => void;
  /** The items of a saved review the player kept (Fizzwick's list as it stands) and removed. */
  parts: (s: S) => { kept: T[]; removed: T[] };
  /** Whether the player has changed review `s` by hand since it was saved (the name aside). */
  edited: (s: S) => boolean;
  /** Empties the screen for the new list; then each new item as it lands; then the items on screen. */
  clear: () => void;
  add: (t: T) => void;
  items: () => T[];
  /** A change starts from this review (the share decision; the first run's error line goes). */
  onStart?: (s: S) => void;
  /** A change finished and its list is on screen. */
  onDone?: () => void;
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
  /** The review right after the last change (or Undo), to tell whether it was changed by hand since. */
  #after = $state.raw<S | null>(null);
  #ctrl: AbortController | null = null;
  #t: ChangeTarget<T, A, S>;

  constructor(target: ChangeTarget<T, A, S>) {
    this.#t = target;
    // Leaving the screen stops a change. Made inside a component (every screen), this runs when it
    // goes; made outside one (a plain unit test) there is no screen to leave.
    try {
      onDestroy(() => this.stop());
    } catch {
      /* not made inside a component */
    }
  }

  /** Whether the box is offered: a new pack made from a request (not a paste, not adding to a pack). */
  get offered(): boolean {
    return !!this.#t.request().trim() && this.#t.name() !== null;
  }

  /** Fizzwick is writing on this review, a change or the screen's own run: every run control waits. */
  get writing(): boolean {
    return this.busy || this.#t.running();
  }

  /** The request as the thread shows it. */
  get request(): string {
    return oneLine(this.#t.request());
  }

  get canUndo(): boolean {
    return this.#before.length > 0 && !this.writing && this.#after !== null && !this.#t.edited(this.#after);
  }

  /** Asks Fizzwick to change the list; resolves once the screen shows the new list or the old one again. */
  async ask(text: string): Promise<void> {
    const ask = oneLine(text);
    if (!ask || this.writing || !this.offered) return;
    const t = this.#t;
    const before = t.save();
    const { kept, removed } = t.parts(before);
    const game = t.game(before);
    t.onStart?.(before);
    const name = t.name();
    name?.askAgain();
    const named = !!name && name.wanted;
    this.error = '';
    this.busy = true;
    name?.hold(true);
    t.clear();
    const ctrl = (this.#ctrl = new AbortController());
    try {
      const n = await streamChange(game, {
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
      t.onDone?.();
      this.#before = [...this.#before, before];
      this.#after = t.save();
      this.thread.push({ ask, result: resultLine(tally([...kept, ...removed], t.items(), game.keyOf)) });
      if (oneLine(this.draft) === ask) this.draft = '';
    } catch (e) {
      t.restore(before);
      this.error = (e as Error).message;
    } finally {
      name?.hold(false);
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
    if (r === undefined || !this.canUndo) return;
    this.#before = this.#before.slice(0, -1);
    this.#t.restore(r);
    this.#after = this.#t.save();
    this.thread.pop();
    this.error = '';
  }

  /** The screen's own run starts ("More", "Try again"): the reviews before are no longer what Undo should bring back, and the last error goes. */
  newRun(): void {
    this.#before = [];
    this.#after = null;
    this.error = '';
  }

  /** The review is gone (saved, discarded): start afresh. */
  clear(): void {
    this.stop();
    this.newRun();
    this.thread = [];
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
  running: () => boolean;
  items: () => T[];
  setItems: (items: T[]) => void;
  dropped: () => Set<string>;
  setDropped: (keys: Set<string>) => void;
  name: () => PackName | null;
  /** Each new item as it lands (a tick). */
  onItem?: () => void;
  /** A change starts, with this many items on screen (the share decision: `passedSoFar`; the first run's error goes). */
  onStart?: (onScreen: number) => void;
}

const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((k) => b.has(k));

/** "Ask for changes" on a list review: the items the player dropped are the removed ones. */
export class WizardChanges<T, A = T> extends Changes<T, A, ListReview<T>> {
  constructor(s: ChangeScreen<T, A>) {
    const keyOf = s.game.keyOf;
    const keys = (items: T[]) => items.map(keyOf).join('\u0001');
    super({
      game: () => s.game, request: s.request, asked: s.asked, avoid: s.avoid, name: s.name, running: s.running, items: s.items,
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
      edited: (r) => keys(s.items()) !== keys(r.items) || !sameSet(s.dropped(), r.dropped),
      clear: () => { s.setItems([]); s.setDropped(new Set()); },
      add: (t) => { s.setItems([...s.items(), t]); s.onItem?.(); },
      onStart: (r) => s.onStart?.(r.items.length),
    });
  }
}
