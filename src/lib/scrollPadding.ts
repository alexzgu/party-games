// Keeps what the page scrolls to (scrollIntoView, a focused input) clear of the bars pinned over
// it: a screen sets its scroller's scroll padding to its pinned header's and start bar's heights.

const GAP = 8;
let last = 0;

/** The element that scrolls this node: the nearest scrolling ancestor, else the page. */
function scroller(node: HTMLElement): HTMLElement {
  for (let el = node.parentElement; el && el !== document.body; el = el.parentElement) {
    const y = getComputedStyle(el).overflowY;
    if (y === 'auto' || y === 'scroll') return el;
  }
  return document.documentElement;
}

/**
 * Pads `node`'s scroller by `top` and `bottom` px (plus a small gap). Returns the undo, which
 * leaves the padding alone when a newer screen has set its own meanwhile.
 */
export function padScroller(node: HTMLElement, top: number, bottom: number): () => void {
  const box = scroller(node);
  const mine = String(++last);
  box.dataset.scrollPad = mine;
  box.style.scrollPaddingTop = `${Math.round(top) + GAP}px`;
  box.style.scrollPaddingBottom = `${bottom ? Math.round(bottom) + GAP : 0}px`;
  return () => {
    if (box.dataset.scrollPad !== mine) return;
    delete box.dataset.scrollPad;
    box.style.scrollPaddingTop = '';
    box.style.scrollPaddingBottom = '';
  };
}
