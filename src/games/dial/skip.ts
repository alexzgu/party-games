// Tap to skip: while an animation is playing, a tap anywhere on the page finishes it instead
// of pressing whatever is under the finger; the next tap works as normal.

/** Listens until the returned function is called. `busy` is read on every tap. */
export function tapToSkip(busy: () => boolean, skip: () => void): () => void {
  const onclick = (e: MouseEvent) => {
    if (!busy()) return;
    e.stopPropagation();
    e.preventDefault();
    skip();
  };
  addEventListener('click', onclick, true);
  return () => removeEventListener('click', onclick, true);
}
