// What a button's tooltip says and where it goes (components/Tooltip.svelte shows it).

interface Box { left: number; top: number; width: number; height: number }

const GAP = 8;

/** The tip's top left corner: centred over the button, under it when there is no room above, always on screen. */
export function placeTip(target: Box, tip: { width: number; height: number }, screen: { width: number; height: number }): { left: number; top: number } {
  const within = (x: number, size: number, room: number) => Math.max(GAP, Math.min(x, room - size - GAP));
  const above = target.top - tip.height - GAP;
  const top = above >= GAP ? above : target.top + target.height + GAP;
  return { left: within(target.left + target.width / 2 - tip.width / 2, tip.width, screen.width), top: within(top, tip.height, screen.height) };
}

/** What to say about a button: its tip, or the spoken name of one that shows only a picture; '' for nothing. */
export function tipText(b: { tip?: string | null; label?: string | null; shown: string }): string {
  if (b.tip) return b.tip;
  return b.label && !/[\p{L}\p{N}]{2}/u.test(b.shown) ? b.label : '';
}
