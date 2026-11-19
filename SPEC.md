# Jerk Box — specification

A web app of pass-and-play party games for one phone, played by adults in their 20s at a
house party. Guests have iPhones and Android phones, so it runs in the browser, installs to
the home screen, and works offline once loaded. Names shown to players live in
`src/app.config.ts`.

## Principles

- **Fast**: first paint under 1 s on a mid phone; every tap answers within 100 ms.
- **Obvious**: a guest who never saw the app starts a round in under 15 seconds. One primary
  action per screen, big type, plain words.
- **Robust**: never loses a game in progress (state saved to localStorage, resumes after a
  reload), never crashes mid-round, degrades quietly when a feature is missing (no motion →
  tap controls, no vibration → sound only, no key → built-in packs only).
- **Readable at arm's length in a dim room**: large type, high contrast, colour never the only
  signal (✓/✗ icons and words alongside green/red).
- **Accessible**: every control reachable and labelled, 44 px minimum targets (56 px default),
  `prefers-reduced-motion` respected (tokens set durations to 0).

## Stack and layout

Svelte 5 (runes) + TypeScript + Vite, `vite-plugin-pwa` precaches everything. Hash routing
(`#/forehead`, `#/dial`, `#/gibberish`, `#/settings`) so any static host works.

- `src/lib/` — shared logic: `storage` (guarded localStorage), `router.svelte`, `settings.svelte`,
  `sound` (synthesised cues; call `unlockAudio()` in the first tap), `haptics`, `wakelock`,
  `motion` (permission, gravity stream, sign fix, upright rotation), `tilt` (gesture detector),
  `bag` (deal without repeats across rounds and restarts), `content` (built-in + custom packs),
  `claude` (live generation, streamed line by line), `random`.
- `src/components/` — `Screen` (page frame: back button, title, sticky actions), `Button`,
  `FitText` (text as large as its box allows), `Stepper`, `Toggle`, `Triage` (review generated
  items while they stream in).
- `src/styles/tokens.css` — every colour, radius, spacing and duration. Each game sets `--accent`
  to its colour token (`--c-forehead`, `--c-dial`, `--c-gibberish`).
- `src/games/<id>/` — one folder per game; `Game.svelte` is the entry the router loads.
- `src/content/` — built-in packs as JSON (formats in `src/lib/content.ts`).

## Making new packs

Three routes, in the order the owner chose to rely on them:

1. **A Claude Code chat** (uses the owner's subscription): someone asks a chat for a pack; it
   writes `src/content/<game>/<id>.json`, passes the content gate (`src/lib/content.test.ts`),
   commits and pushes; the site rebuilds in 1–2 minutes. Steps: "Making a new pack" in
   AGENTS.md, or `/make-pack`.
2. **Paste a list** on the phone: each game's "Make a pack" screen takes a pasted list (one
   item per line, in the game's format), shows it in `Triage` for review, and saves it as a
   custom pack on that phone.
3. **Ask Claude in the app** (later, needs an API key): the host pastes an Anthropic API key in
   Settings; it stays in that phone's localStorage and the phone calls the API directly.
   `streamLines()` hands each line over as soon as it is complete; items stream into `Triage`;
   "More" sends the items already kept so Claude avoids repeats.

Updates reach phones without interrupting play: a new version downloads in the background
(checked every minute) and switches in only on the main menu (`src/lib/update.ts`).

## Game 1 — Heads Down. (`forehead`)

Heads Up-style. One player holds the phone on their forehead, screen facing out; the others
shout clues; the holder tilts down for "got it", up for "pass".

- **Setup**: grid of decks (emoji, name, word count); tap to select one or several (mixed).
  Round length 30/60/90/120 s (default 60). Controls: Tilt (default when motion works) or Tap.
  Entry to "My decks" (create, edit, delete, make with Claude).
- **Start tap**: `unlockAudio()`, `requestMotion()` (iOS prompt), sample gravity for the sign fix
  (`axisSignFromLookingAt`), `keepAwake(true)`, and on Android try fullscreen + landscape lock
  (guarded; iOS has neither).
- **Get ready**: "Put it on your forehead". The countdown starts by itself once the phone has
  been held upright and steady for ~0.7 s (or on tap). 3-2-1 beeps, then the first word.
- **Play**: the word as large as possible (`FitText`), timer, score. The screen content is rotated
  so text reads upright for the people facing the phone, even when the phone's rotation lock
  keeps the page in portrait (`uprightRotation` combined with `screen.orientation.angle`; fixed
  at countdown start). Tilt down → correct (green flash, ✓, chime, double buzz); tilt up → pass
  (amber flash, buzz). Tap fallback always on: right half correct, left half pass. Last 10 s:
  tick each second and a red pulsing timer. Leaving the app pauses; returning shows a Resume
  overlay. A small ✕ ends the round after confirmation. Deck exhausted → round ends early.
- **Results**: score headline, every word shown marked ✓/✗ and tappable to fix mis-tilts.
  Play again (same settings, next player), change decks, home. Round scores of this session
  listed so the group can compare.
- Tilt thresholds are in `src/lib/tilt.ts` (ported from the device-tested Android app).

## Game 2 — Spectrum (`dial`)

Wavelength-genre. Two teams. Each round one player of the active team (the reader) secretly
sees where a target sits on a scale between two opposites, gives one clue out loud, and their
team sets a dial to where they think the target is.

- **Setup**: two team names (editable), points to win (default 10), packs (multi-select),
  optional "steal" rule: the other team then guesses whether the target is left or right of
  the needle for 1 point. Entry to make a pack with Claude.
- **Round**: hand-off screen ("Team X — pick a reader, hand them the phone") → reader view:
  scale card + dial showing the target zone; one free redraw of the card; optional clue text
  field → "Hide & hand over" → team view: scale + clue, big semicircle dial with a draggable
  needle (pointer events, smooth, light haptic tick every few degrees) → Lock in → (steal) →
  reveal: a cover swings open to show the target, points fly to the team.
- **Scoring**: dial 0–100, target centre uniform in [4, 96]. Distance ≤ 2.5 → 4 pts, ≤ 7.5 → 3,
  ≤ 12.5 → 2, else 0. Steal correct → 1 pt to the other team. Turns alternate. First to the
  target score wins (win screen with confetti, rematch).
- Game state saved after every step; reopening resumes.

## Game 3 — Inn Co Hear Ant (`gibberish`)

Mad Gab / Incoherent-genre. Each card is a phrase of real but unrelated words that, said
aloud, sounds like something well known ("Eye Scream" → Ice Cream).

- **Setup**: player names (3+; add/remove; remembered), packs (multi-select), seconds per card
  (off/20/30/45/60, default 30), points to win (default 5). Entry to make a pack with Claude.
- **Card**: the reader rotates each card. Hand-off screen ("X reads — everyone else, eyes off the
  phone") → reader view: the phrase huge, a "Show category" button the reader may read out,
  answer hidden until press-and-hold, countdown ring. When someone shouts the answer the
  reader taps that player's name → point, answer revealed big with a chime. Time runs out or
  "Nobody" → answer revealed, no point. Skip draws a new card without penalty.
- Scoreboard between cards; first to the target wins (win screen, rematch). State saved.

## Hosting

Static build (`npm run build` → `dist/`), base path `./` so it runs from any folder or host.
iPhone motion permission, service workers and wake lock need HTTPS.

## Checks

`npm run check` (types), `npm test` (unit tests for pure logic: tilt, scoring, dealing,
parsing), `node scripts/shot.mjs <url> <png>` for phone-size screenshots of a running dev server.
