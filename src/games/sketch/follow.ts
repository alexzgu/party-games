// A list of guesses that keeps its newest row in sight (Feed.svelte): while it shows its last
// row it stays there as rows come in or its box changes size; scrolled up to read, it stays put
// until scrolled back down.

/** How far from the very end still counts as showing it (rounding, a last half pixel). */
const SLACK = 4;

/** Whether a list scrolled this far down shows its last row. */
export function atEnd(scrollTop: number, scrollHeight: number, clientHeight: number): boolean {
  return scrollHeight - clientHeight - scrollTop <= SLACK;
}

/** Where to scroll after a change: to the end when it showed its end before the change, else nowhere. */
export function afterChange(wasAtEnd: boolean, scrollHeight: number): number | null {
  return wasAtEnd ? scrollHeight : null;
}
