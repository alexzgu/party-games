/** The default name for a new player: "Player N", N one past the list length, or the next free N after it. */
export function nextPlayerName(names: string[]): string {
  const taken = new Set(names.map((n) => n.toLowerCase()));
  let n = names.length + 1;
  while (taken.has(`player ${n}`)) n++;
  return `Player ${n}`;
}
