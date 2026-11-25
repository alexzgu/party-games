// Screens the room reads from across it: every own-phones game's host screen (on a TV or propped
// up), Big Board's play screens and the Heads Down. round (the phone on a forehead). They always
// show at Normal text size; the Text size setting does not apply while one is up (applyDisplay in
// settings.svelte.ts). index.html repeats the pattern for the first paint; display.test.ts keeps
// the two the same and checks every game with a host screen is covered.
export const FAR_READ = /^\/(?:[a-z]+\/host|quiz\/play|forehead\/play)(?:\/|$)/;

export const farRead = (path: string): boolean => FAR_READ.test(path);
