// This phone's username: a friendly random name (an adjective and an animal, "Sneaky Otter")
// given the first time anything asks, changed in Settings, the name a room game's Join screen
// starts with, and sent with every pack this phone shares to the Community library. Kept on the
// phone only; nobody checks that names are unique. The rules for what a username may be are in
// usernameShape.ts, shared with the wizard server.
import { pick } from './random';
import { load, save } from './storage';
import { cleanUsername, cutName, normaliseUsername } from './usernameShape';

export { USERNAME_MAX } from './usernameShape';

const KEY = 'username';

/**
 * The words random names are made of: friendly, nothing rude in any pairing. Adjectives are at
 * most 6 letters and animals at most 7, so every name fits the shortest room-game name (14).
 */
export const ADJECTIVES = [
  'Sneaky', 'Jolly', 'Sleepy', 'Brave', 'Fuzzy', 'Zesty', 'Breezy', 'Clever', 'Cosmic', 'Dapper',
  'Peppy', 'Plucky', 'Quirky', 'Snappy', 'Sunny', 'Witty', 'Bouncy', 'Cheery', 'Comfy', 'Fancy',
  'Gentle', 'Groovy', 'Happy', 'Humble', 'Lucky', 'Mellow', 'Mighty', 'Nimble', 'Perky', 'Polite',
  'Shiny', 'Silly', 'Swift', 'Tiny', 'Wobbly', 'Zippy', 'Cozy', 'Bold', 'Calm', 'Crafty',
  'Daring', 'Eager', 'Frosty', 'Jazzy', 'Keen', 'Lively', 'Merry', 'Noble', 'Snazzy', 'Spry',
  'Tidy', 'Wise', 'Dreamy', 'Golden', 'Sparky', 'Chirpy',
] as const;

export const ANIMALS = [
  'Otter', 'Panda', 'Llama', 'Badger', 'Falcon', 'Walrus', 'Penguin', 'Gecko', 'Koala', 'Moose',
  'Bison', 'Lemur', 'Ferret', 'Toucan', 'Narwhal', 'Raccoon', 'Puffin', 'Yak', 'Owl', 'Fox',
  'Heron', 'Squid', 'Newt', 'Wombat', 'Alpaca', 'Lobster', 'Pelican', 'Marmot', 'Turtle', 'Dolphin',
  'Beetle', 'Sloth', 'Hamster', 'Kiwi', 'Quokka', 'Ocelot', 'Jaguar', 'Goose', 'Parrot', 'Rabbit',
  'Pigeon', 'Gopher', 'Iguana', 'Lynx', 'Tapir', 'Zebra', 'Giraffe', 'Octopus',
] as const;

export const randomUsername = (rand: () => number = Math.random): string => `${pick(ADJECTIVES, rand)} ${pick(ANIMALS, rand)}`;

/** Kept here too, so a phone whose storage is blocked keeps one name while the page is open. */
let current: string | null = null;

function keep(name: string): string {
  current = name;
  save(KEY, name);
  return name;
}

/** This phone's username; a phone without one (or with a broken one) is given a random one now. */
export function getUsername(): string {
  if (current) return current;
  const stored = cleanUsername(load<unknown>(KEY, null));
  return stored ? (current = stored) : keep(randomUsername());
}

/** Saves what was typed, tidied, and returns it; nothing is saved when only spaces were typed (null). */
export function setUsername(typed: string): string | null {
  const name = normaliseUsername(typed);
  return name ? keep(name) : null;
}

/** Gives the phone a new random username, saved, and returns it. */
export const freshUsername = (): string => keep(randomUsername());

/**
 * The name a room game's Join screen starts with: `kept` (what was typed for a join that was just
 * refused, so it can be fixed) when there is one, else the username, cut to the game's `max`.
 */
export function joinName(max: number, kept = ''): string {
  return cutName(kept.trim() ? kept : getUsername(), max);
}
