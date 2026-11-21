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
  tap controls, no vibration → sound only, no key → built-in packs only). Chrome on Android
  never vibrates while the phone is on silent; Settings says so under Vibration.
- **Readable at arm's length in a dim room**: large type, high contrast, colour never the only
  signal (✓/✗ icons and words alongside green/red).
- **Accessible**: every control reachable and labelled, 44 px minimum targets (56 px default),
  `prefers-reduced-motion` respected (tokens set durations to 0).

## Stack and layout

Svelte 5 (runes) + TypeScript + Vite, `vite-plugin-pwa` precaches everything. Hash routing
(`#/forehead`, `#/dial`, `#/gibberish`, `#/quiz`, `#/settings`, `#/join/<key>`) so any static host works.

- `src/lib/` — shared logic: `storage` (guarded localStorage), `router.svelte` (each history
  entry carries how many in-app steps lie behind it, so `back()` returns to the screen a page
  came from, also after the browser's or Android's back gesture or a reload, and never leaves the
  app; a screen leaving to the one it came from uses `back()`, never a new `go()`, or Back there
  would return to it in a loop), `settings.svelte`,
  `sound` (synthesised cues; call `unlockAudio()` in the first tap), `haptics`, `wakelock`,
  `motion` (permission, motion stream, sign fix, upright rotation), `pitch` (forehead pitch from
  gyroscope + gravity), `tilt` (gesture detector), `calibration` (practice tilts → thresholds),
  `bag` (deal without repeats across rounds and restarts), `content` (built-in + custom packs),
  `claude` (live generation, streamed line by line), `wizard` (effort → model), `wizardServer` (the magic words), `invite` and `join` (invite links), `history` (finished rounds and games),
  `paste` (reading pasted lists), `packfile` (pack files: export, import), `share` (share sheet or download), `update` (new versions switch in on the main menu), `random`.
- `src/components/` — `Screen` (page frame: back button, title, sticky actions), `Popup`,
  `HowTo` (the "?" header button that opens a game's rules), `Button`,
  `FitText` (text as large as its box allows), `Stepper`, `Toggle`, `Triage` (review generated
  items while they stream in), `WizardEffort` (how hard Fizzwick tries, on every make page), `PackFile` (Import packs, Export my packs),
  `ExportPack` (Export pack).
- `src/styles/tokens.css` — every colour, radius, spacing and duration. Each game sets `--accent`
  to its colour token (`--c-forehead`, `--c-dial`, `--c-gibberish`, `--c-quiz`).
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
3. **Ask the wizard in the app**, first way in, the host's own testing route (no screen mentions
   invite links; players are told only about the magic words, route 4): players see live generation as
   "Fizzwick the Wizard" 🧙; no screen names Claude, Anthropic or an API key. The host (the owner,
   who pays for usage) sends friends a link `<site>#/join/<key>` carrying an Anthropic key; the
   key is never in the repo or the bundle. Opening it (`src/lib/join.ts`, `invite.ts`) stores
   the key in `settings.apiKey` (that phone's localStorage), wipes it from the address bar and
   history at once (`replaceState` to `#/`), and says "Fizzwick the Wizard has moved in on this
   phone."; a link whose key does not look like an Anthropic key (`sk-ant-`, 20–300 of
   `[A-Za-z0-9_-]`) says it is broken and stores nothing. The phone calls the API directly.
   Each make page shows "How hard Fizzwick tries" (`WizardEffort`) next to the theme and the
   make button, when the phone has a key: 🥱 Half-asleep (Haiku 5.5), ☕ Had his coffee (Sonnet
   5.5), 🔮 Full beard power (Opus 5.5, the default), kept in `settings.model`; an unknown stored
   id uses Opus. Without a key or pass the magic-words box (`MagicWords`) appears wherever the
   wizard is wanted: Settings and in place of the wizard's form on every make page.
   `streamLines()` hands each line over as soon as it is complete; items stream into `Triage`;
   "More" sends the items already kept so the wizard avoids repeats.
4. **The magic words** (second way in, kept apart from invite links): a small Cloudflare Worker
   in `worker/` (setup in `worker/README.md`) holds its own, spend-capped Anthropic key and a few
   shared party phrases as secrets the owner enters in Cloudflare. A friend types a phrase in
   the magic-words box; the server checks it (case, punctuation and spacing ignored; guessing is a game of its own, so guesses are limited only far
   above human pace: 60 a minute per address, an IPv4 address or an IPv6 /64, and 600 a minute
   overall, with a separate 100 a minute (10 per network) for addresses with no guess in the last
   minute so a flood cannot lock friends out for long; right ones
   are given back and limited to 20 per address per day; `worker/README.md` has the numbers)
   and returns a 30-day pass, kept in `settings.wizardPass`, never in a URL or an invite
   link. The phone then uses the server as its API address with the pass in place of a key and
   without model fallback; the server allows only the app's own requests (models from
   `wizard.ts`, plain text, no fallback or betas, capped tokens and size), counts them against a
   daily allowance (300 requests for everyone; 60 per pass, a soft cap since the words can
   be said again), and forwards them with its key. A phone with its own key uses that instead,
   with fallback as before. Removing a phrase ends its passes ("The magic words have changed.
   Ask the host for the new ones."); an old pass says "Fizzwick's pass expired. Say the magic
   words again."; any other refused pass (one signed before the server's key was replaced)
   says "Fizzwick forgot this phone. Say the magic words again."; in each case the
   pass is forgotten, unless a newer one was saved meanwhile. The
   allowance running out says "Fizzwick needs a nap", naming this phone's share or the party's
   (only when the server says `party`; any other 429 is Anthropic busy: "Fizzwick is swamped").
   A connection lost after sending, or a 5xx, stays counted (the API may have run it); the
   Anthropic workspace spend limit is the money cap.
   An unexpected server error (a JSON 500 with the usual CORS headers and `x-wizard-reason:
   server`, no details; when saying the words, any 5xx) says "Fizzwick's tower is having
   trouble. Try again in a little while." and keeps the pass.
   `WIZARD_SERVER` in `src/lib/wizardServer.ts` holds the server's address; empty hides the
   magic words everywhere (the box then says "Ask the host." and only takes the host's key).
   Something that looks like a key or invite link but is not a whole one is turned down on the
   phone ("That looks like a key but isn't a whole one.") and never sent to the server; an
   answer arriving after the box has gone, or after the phone's key or pass changed, is dropped.

**Every pack can be opened and edited**, built-in or the player's own. Editing a built-in saves
an edit under the same id that replaces it everywhere on that phone, marked "Edited", until
"Restore original". Only the player's own packs can be deleted.

**Packs are called packs in every game** (a Heads Down. pack is a list of words, a Big Board
pack is one whole board). Code, routes and storage keys keep their older names (`decks`, `board`).

**Import and export** (`src/lib/packfile.ts`, buttons in `PackFile` and `ExportPack`): a pack file
is JSON, `{"jerkBox": 1, "game": "<game id>", "packs": [...]}`, each pack as stored (id, name,
emoji for Heads Down., blurb, items) without `custom` and `added`; named
`<game>-<pack id or my-packs>.jerkbox.txt` (JSON inside, plain-text type so Chrome on Android
can share it; import also takes `.json`). "Export pack" sits in every pack editor (built-ins
included); "Import packs" and "Export my packs" (every pack made or edited on this phone; hidden
when there are none) sit under every pack list: Heads Down.'s "Packs" screen (Edit on setup),
Spectrum and Don't Say It setup under "Make a pack", the pack tiles of Inn Co Hear Ant, Brain
Freeze and Earworm setup, Big Board's pack list, and Snark Tank's game settings. Export uses the
share sheet when the browser can share the file, else a download. Import reads a file of at most
1 MB (an Earworm clip pack: 40 MB) and up to 100 packs of up to 1,000 items; checks each item with that game's own rules (the
pack editor's or the paste route's; Big Board: 1–8 categories × 1–10 clues, cut and padded like a
pasted board); drops what fails and says how many; leaves out a pack with nothing usable; and
saves each pack as the player's own, ticked (Big Board: picked), under a fresh id (`-2`, `-3`, …)
when a built-in or a pack on the phone already has its id, so nothing is overwritten. A file of
another game says which game to open; anything else says it isn't a pack file. An Earworm pack's
songs from the YouTube version that still need an Apple Music match travel apart, as
`"legacySongs": [{"title", "artist"}]`, and come back as such (so "Rematch saved songs" offers
them on the other phone); a file that has them among its `songs`, with no Apple track, is read
the same way.

## Shared behaviour

- **Home** shows every game in `GAMES` (name, emoji, player count), History and Settings. No blurbs.
- **Settings**: Feel (sound, vibration; switching either on plays a sample chime or buzz), Look (colours), Heads Down. (scored-word feedback,
  "Calibrate tilt" with the calibration note under it, "Check tilt" with its notes under it),
  The wizard, Cards (reset card history). The wizard never mentions invite links. Without a key
  or pass: "Fizzwick the Wizard is not on this phone yet. Say the magic words the host told
  you:", a hidden field with Show (no autofill) and "Say them", answered "Fizzwick heard you.
  He's yours on this phone.", "Fizzwick doesn't know those words." or, after too many guesses,
  how long to wait. A whole invite link or a bare key typed there is stored as the phone's key
  (`keyFromTyped`, for the host's testing; an iPhone Home Screen app keeps its own storage, so a
  tapped link may not reach it). With either: "Fizzwick the Wizard lives on this phone" and
  "Send Fizzwick away" (clears both). No key field and no model list. Descriptions are
  --text-dim, weight 600.
  Home: a game name over 13 characters is one size down (min(1.32rem, 6vw)) to stay on one line.
- **Rules** live in each game's "?" popup, not on its screens.
- **History** (`#/history`): one entry per Heads Down. round (rewritten if a word is fixed
  afterwards) and per finished Spectrum or Inn Co Hear Ant game: title, scores, packs and
  details. Filter by game, open, delete one, or clear all. Stored on the phone only.
- **Search and sort** (`ListTools`): every pack list and every pack's contents has a search
  toggle (matches names, blurbs and the items inside; a pack found only through an item shows
  `has "…"`) and a sort toggle (Suggested, Newest, Oldest, A–Z). Each list remembers its toggles
  and order on the phone. Packs carry an `added` date; built-ins without one count as oldest.
  Ticking packs during a search still counts every picked pack.
- **Ended early**: a Heads Down. round quit from the pause menu, or a Spectrum / Inn Co Hear Ant
  game thrown away before a winner (End game; Start a new game over a saved one) is still
  recorded, with `finished: false` and an "Ended early" tag, if anything was scored. Leaving a
  saved, resumable game is not ending it.
- **Tap to skip**: a tap finishes any animation players are waiting through (reveals, points,
  win screens); scores are applied before animations start, so skipping never changes them.
  Live play (Heads Down. countdown and round, Inn Co Hear Ant card timer) is never skippable.

Updates reach phones without interrupting play: a new version downloads in the background
(checked every minute) and switches in only on the main menu (`src/lib/update.ts`).

## Game 1 — Heads Down. (`forehead`)

Heads Up-style. One player holds the phone on their forehead, screen facing out; the others
shout clues; the holder tilts down for "got it", up for "pass".

- **Setup**: grid of packs (emoji, name, word count); tap to select one or several (mixed).
  Round length 30/60/90/120 s (default 60). Controls: Tilt, Tap or Both (default Both on phones
  and tablets, Tap on a laptop; the old saved "Tilt", which always took taps, carries over as
  Both). Only the chosen input scores: in a Tilt round the tap zones are gone and the arrow keys
  do nothing; in a Tap round tilting does nothing. A Tilt round on a phone that cannot feel
  motion takes taps instead, so it can always be played (`accepts` in `round.ts`).
  "Edit" (in the packs header, before the search and sort toggles) opens the pack list: open any pack to see, edit or restore its words.
- **Start tap**: `unlockAudio()`, `requestMotion()` (iOS prompt), sample gravity for the sign fix
  (`axisSignFromLookingAt`) and for where the page's top is (below), `keepAwake(true)`, and on
  Android try fullscreen + landscape lock (guarded; iOS has neither). Both samples are read
  against the page as it was at the tap, before the lock can turn it.
- **Get ready**: "Put it on your forehead". The countdown starts by itself once the phone has
  been held upright and steady for ~0.7 s (or on tap). 3-2-1 beeps, then the first word.
- **Play**: the word as large as possible (`FitText`), timer, score. The screen content is rotated
  so text reads upright for the people facing the phone, even when the phone's rotation lock
  keeps the page in portrait: its top goes to the device edge gravity says is up (fixed at
  countdown start), measured against the edge the page's top is on. That edge is measured, not
  assumed from the browser's angle (`offsetFromReading`, `offsetAfterTurn` in `motion.ts`): at
  the Start tap the player is reading, so the page's top is the edge pointing up; when the system
  turns the page it turns it toward gravity, so the browser's angle gives only the new axis and
  gravity says which end. The browser's angle alone (`window.orientation`, else
  `screen.orientation.angle`) assumed the motion axes and the angle share one frame and the axis
  sign fix was already learned; a freshly installed app (its own storage, sign not yet learned)
  or a foldable whose inner screen's natural orientation is not its motion frame broke that and
  showed the word upside down or sideways. Phone sideways (the turned screen wider than tall)
  mirrors the tap zones to the holder's hands. Tilt down → correct (✓, chime, double buzz); tilt
  up → pass (buzz).
  Feedback (Settings): by default the screen edge on the side of the matching tap zone glows
  green or amber; "Flash the screen" flashes the whole screen instead. Tap fallback always on: right half correct, left half pass. Last 10 s:
  tick each second and a red pulsing timer. Leaving the app pauses; returning shows a Resume
  overlay. A small ✕ ends the round after confirmation. Packs used up → round ends early.
- **Results**: score headline, every word shown marked ✓/✗ and tappable to fix mis-tilts.
  Play again (same settings, next player), change packs, home. Round scores of this session
  listed so the group can compare.
- Pitch comes from the gyroscope blended with gravity (1 s time constant, `src/lib/pitch.ts`).
  Raw gravity alone fails: recorded nods (Tilt lab, below) start with a shove along the screen
  normal that reads, for ~100 ms, as a big tilt the other way, so got-it nods scored as passes.
  Browsers disagree on which `rotationRate` field holds which axis (Firefox on Android puts the
  nod on `beta`), so each phone learns its layout from its own motion (whichever candidate
  tracks gravity best while the phone is on a forehead) and keeps it; Firefox on Android starts
  from its recorded layout. A gap of over 0.25 s between readings restarts from gravity, and a
  different edge must point up for 150 ms before the nod's sign follows it. With no gyroscope, the
  browser's gravity estimate (`accelerationIncludingGravity` minus `acceleration`) is used.
- Tilt is measured from where the phone rests: the median over the last 2 seconds of the
  readings near the current rest (leaving out the newest quarter second, moving at most 10°/s,
  clamped to ±35° like the countdown's steady check), starting from the pose held steady before
  the countdown (0 after a tap start). Tilts, slow or missed ones and fast spamming included,
  never pull it along. It is frozen from a score until the phone settles again, so a held tilt
  never scores twice or counts the way back. A score needs the angle and speed: the pitch must
  have turned briskly toward that side in the last 0.4 s, since that direction was armed (so
  the way back from one tilt never lends its speed to the next). Until a player calibrates:
  25° down, 25° up, 150°/s: the owner's calibration from 64 recorded tilts (they turned at
  175–1100°/s; talking, laughing, looking around, leaning back stayed under ~105°/s), with up
  raised from 20° because a ~21° wind-up before a fast nod down scored as a pass.
- Quick tilts in a row: the same direction counts again as soon as the phone is back near rest
  (and 150 ms after the last score), with no pause there. On the way back the head bounces past
  rest by up to ~28°, so right after a score the other direction needs 15° more than the larger
  of its angle and 25° (40° by default). Once the phone settles (150 ms near rest, or held still
  at least halfway back from the tilt) both directions count at their plain angles. Tuned on
  three Tilt lab recordings, a speed run among them. Constants in `src/lib/tilt.ts`.
- **Calibrate tilt** (`#/forehead/calibrate`, from Setup and Settings): the phone, on the
  forehead, says "Down" or "Up"; each practice tilt it catches beeps and counts (the way back
  from a tilt never counts: the next one starts only once the phone is halfway back and still).
  A tilt under 12° (too small ever to score) is not kept; the phone says "Further". Done saves
  once there are at least 3 of each; with fewer it says how many more and keeps the old
  calibration. Thresholds: 45% of the player's median tilt (12–25°; not lower, so a wind-up before a nod the other way never scores) and half their median speed
  (60–150°/s). Kept on the phone until the next calibration (a damaged stored value is clamped
  into those limits or ignored); Reset returns to the defaults. Replaces the old Small / Medium /
  Big setting.
- **Tilt lab** (`#/forehead/lab`, not linked): speaks a ~3.5-minute script of cued tilts and
  non-tilts and records every motion reading with the cue times, for designing detection from
  real data. The file goes to a laptop lab server when the page is served from one, else to
  share / download.

## Game 2 — Spectrum (`dial`)

Wavelength-genre. Two teams. Each round one player of the active team (the reader) secretly
sees where a target sits on a scale between two opposites, gives one clue out loud, and their
team sets a dial to where they think the target is.

- **Setup**: two team names (editable), points to win (default 10), packs (multi-select),
  optional "steal" rule: the other team then guesses whether the target is left or right of
  the needle for 1 point. Entry to "Make a pack" (paste a list or ask the wizard). Each pack row
  has a separate › that opens the pack editor.
- **Teams**: Early Birds (`--c-team-a`, warm orange) vs Night Owls (`--c-team-b`, blue), on the
  dark theme: team colour as glow, border and name, never a full bright fill. The scoreboard
  is a face-off; the hand-off shows round, both scores and the rival.
- **Round**: hand-off screen ("Team X — pick a reader, hand them the phone") → reader view:
  scale card + dial showing the target zone; one free redraw of the card; optional clue text
  field → "Hide & hand over" → team view: scale + clue, big semicircle dial with a draggable
  needle (pointer events, smooth, light haptic tick every few degrees) → Lock in → (steal) →
  reveal: a cover swings open to show the target, points fly to the team.
- **Scoring**: dial 0–100, target centre in [4, 96], spread out: the range is cut into five equal
  parts dealt from a shuffle bag kept across games (each part once before any repeats), and a
  target sits at least 15 from the previous one when its part allows. Distance ≤ 2.5 → 4 pts, ≤ 7.5 → 3,
  ≤ 12.5 → 2, else 0. Steal correct → 1 pt to the other team. Turns alternate. First to the
  target score wins (win screen with confetti, rematch).
- Game state saved after every step; reopening resumes.

## Game 3 — Inn Co Hear Ant (`gibberish`)

Mad Gab / Incoherent-genre. Each card is a phrase of real but unrelated words that, said
aloud, sounds like something well known ("Eye Scream" → Ice Cream).

- **Setup**: player names (3+; add/remove; remembered), packs (multi-select), seconds per card
  (off/20/30/45/60, default 30), points to win (default 5). Entry to "Make a pack" (paste a list or ask the wizard).
  A pencil on each pack tile opens the pack editor (giveaway check applies to edits).
- **Card**: the reader rotates each card. Hand-off screen ("X reads — everyone else, eyes off the
  phone") → reader view: the phrase huge, a "Show category" button the reader may read out,
  answer hidden until press-and-hold, countdown ring. When someone shouts the answer the
  reader taps that player's name → point, answer revealed big with a chime. Time runs out or
  "Nobody" → answer revealed, no point. Skip draws a new card without penalty.
- Scoreboard between cards; first to the target wins (win screen, rematch). State saved.

## Game 4 — Big Board (`quiz`)

A team quiz board for a host who reads aloud, on a phone or a laptop on the TV. Each pack is one
board: categories across and clues down, easiest at the top. Built-in packs (`src/content/quiz/*.json`)
are 3–6 categories × 3–5 clues; packs made or edited on the phone may be 1–8 × 1–10.

- **Setup**: 1–10 teams (stepper, default 3; a team may be one person), names editable and
  remembered for all twenty seats, each with its own colour (`--team-1` … `--team-20` in
  tokens.css, one set per scheme, readable as text and under a number badge). One pack
  (search/sort list; a pencil per row opens the editor; "Make a pack" at the end), points
  100, 200, … per level or doubled, "Wrong answers lose points" (default off). A pack with an
  empty clue or answer is a draft: setup names the empty tiles and will not start it.
- **Board**: fills the screen; categories across, values down; a played tile goes dim with a dot
  in the winning team's colour. Header: back to setup (game saved), Undo, full screen (wide
  screens with the Fullscreen API), "?", End. A score strip shows every team at all times:
  big boxes up to 4 teams; compact chips from 5 (phone: two rows up to 8, then one sideways row
  with the leader pinned at its start; wide: up to 10 across, then two even rows); leaders get a
  crown. Tapping a team opens a fix popup (± each board value). Tiles ignore taps for 400 ms
  after the board appears (double-tap guard).
- **Tile**: the clue full screen (FitText) with category and value → "Show answer" → the answer
  big → tap the team that got it (+value) or "Nobody got it" → back to the board. "Back" puts the
  tile back unplayed. With the penalty on, ✗ marks a team wrong on either step (−value at once,
  can be taken back, that team cannot win the tile). Up to 4 teams: big buttons and a row of ✗;
  from 5: a compact grid, each team's ✗ beside its name (past 8 teams the page may scroll).
  Keys: Space/Enter show the answer, 1–9 award teams 1–9 (more teams: the buttons), 0 nobody,
  Esc puts the tile back.
- **Solo** (one team): no contest; the answer step is "Got it" (+value) or "Missed" (with the
  penalty on, −value). Keys 1 and 0. Undoing a miss reopens the tile with no mark. The win
  screen shows the score and tiles got; History says "<name> scored <points>".
- **Scores** are never stored: they are the sum of the log (tiles closed, hand fixes) plus wrong
  marks on the open tile. Undo drops the last log entry; an undone tile reopens on its answer
  with its wrong marks so the right team can be tapped.
- **End**: every tile played → "See who won", or End with something scored → win screen
  (confetti, tap to skip; standings with shared places for ties; from 9 teams compact rows, two
  columns on wide screens). History gets one entry at that moment (`finished: false` when ended
  early; more than 4 teams: the title gives the top score and the team count); End with nothing
  scored just closes the board. State saved after every step; a reload resumes on the same
  screen. Saves and setups from the 2–4 team version load unchanged.
- **Pack editor** (`#/quiz/board?id=<id>`): name, short description, levels stepper (adds or
  removes the bottom level on every category; removing one with clues asks first), category
  tabs (add up to 8, rename, move left/right, remove), and every clue and answer inline, empty
  ones highlighted. Every change saves at once; a built-in saves this phone's copy under the
  same id (Edited tag, "Restore original"); own packs can be deleted.
- **Make a pack** (`#/quiz/make`): Blank (name, categories 1–8 × levels 1–10, default 5 × 5),
  Paste (a "# Category" line then "clue | answer" lines, easiest first; tolerant of other
  headings, list markers, tables, "Q:/A:", value columns and "Category | level | clue | answer"
  lines; short categories get empty tiles; past 8 × 10 is cut off and the skipped lines are
  counted), or 🧙 Wizard (topic, categories × levels, how hard Fizzwick tries; the model streams one line
  per clue, "Category | level | clue | answer", easiest row first, under the AGENTS.md quality
  bar, and a live preview fills tile by tile; "Stop" opens what came; a pass refused mid-preview
  shows the magic-words box under the error in place of "Try again"). Without a key it shows the
  magic-words box, and suggests asking the host for a built-in pack ("a Big Board about
  <topic>", which the owner's Claude Code chat makes). Every route opens the new
  pack in the editor, kept in storage (`quiz:new-board`) until "Save pack" (or "Save as a
  draft" with empty tiles), which picks it on setup.

## Game 5 — Don't Say It (`taboo`)

Taboo-genre. Two teams take turns; one player describes the word on the card to their team
without saying it or any of its five banned words, while a player from the other team sits
beside them watching for slips.

- **Setup**: two team names (editable, `--c-team-a` / `--c-team-b`, default Loudmouths vs
  Mimes), turn length 45/60/90 s (default 60), play until a points target (default 15, 5–50)
  or a number of rounds (default 5; a round is one turn per team), "Skips cost a point"
  (default off), packs (search/sort; a › on each opens its editor; "+ Make a pack").
- **Turn**: hand-off ("Pick a describer… someone from the other team sits next to them") →
  the word as large as it fits (`FitText`), its five banned words under it, a clock and a bar.
  Got it +1 (chime), Skip 0 or −1, Buzz −1 (red flash, buzzer); each button ignores taps for
  400 ms after a new card. Last 10 s: a tick each second and a red pulsing clock. Leaving the app
  or the pause button stops the clock behind an opaque menu (Resume, Pause and go home, End game);
  a reload mid-turn resumes paused with the time left. Packs used up → the turn ends early.
- **Summary**: the turn's total, every card with its mark; a tap cycles a card got → skipped →
  buzzed. The card on screen when time ran out is listed as "Time's up" (0) and can be changed
  to got or buzzed (said at the buzzer). Then the scoreboard: the turn's points land on the team
  (tap to land them at once), then "Next: <team>".
- **Scores** are never stored: they are the sum of every card's mark, so fixes on the summary
  just work. The game is checked only when both teams have had the same number of turns: target
  reached (or every round played) with one team ahead → win screen (confetti, rematch with the
  other team starting); level at that point → one more round each.
- Words never repeat within a game; across games each pack deals every card before reusing any
  (`lib/bag`). History: one entry per finished game, one line per turn; End game with a card
  marked records it as ended early. Demo screens: `#/taboo?demo=handoff|turn|turn-late|summary|scores|win`.
- **Packs**: `src/content/taboo/*.json` (Classic 150, Pop Culture 100, After Dark 60). Paste
  lines `Word: one, two, three, four, five` in the pack editor to add many.

## Game 6 — Brain Freeze (`quick`)

Name-three-under-pressure genre. Pass the phone round; whoever is up reveals a prompt and has a
few seconds to name three things that fit it out loud; the room judges.

- **Setup**: player names (2+; add/remove; remembered, and a first visit borrows Inn Co Hear
  Ant's list), packs (search/sort; a pencil on each opens its editor; "Make a pack": paste a
  list or ask the wizard), seconds on the clock 5/7/10 (default 5), points to win (default 7, 3–15),
  Steal (default on).
- **Turn**: hand-off ("Pass the phone to Maya"; the last turn's result and a scoreboard strip in
  seating order above it) → "I'm Maya, show my prompt" reveals "Name 3 …" huge (`FitText`) and
  starts the clock at once: a big ring drains, a tick each second (sharper in the last two),
  buzzer at zero. "Got all 3" stops the clock early with the point. At zero the same screen
  shows "Time!" and the room taps ✓ Got 3 (+1) or ✗ Didn't. Steal on and missed: the next
  player gets the same prompt and a fresh clock and must name three *different* things for the
  point; a missed steal ends the turn with no point. The turn then passes to the next seat.
- **Undo**: the hand-off and the steal screen offer "Wrong call? Undo", which goes back to the
  judging of the last try with its point taken back (one step; gone once the next prompt is up).
- **End**: the hand-off after the winning point shows "See who won" → win screen (confetti,
  standings, rematch: next seat starts). History gets one entry then, one detail line per turn
  ("Name 3 kinds of soup: Ben ✗, Cy stole it"); Start a new game over an unfinished one records
  it with `finished: false`. Reload mid-clock resumes paused with the time left; leaving the
  app pauses. Prompts are dealt without repeats within a game and across games (per-pack bags).
- **Content**: `src/content/quick/*.json`, `{"prompts": ["things you'd find in a fridge", …]}`
  stored without the "Name 3" lead-in. Built-ins: Classic (200), Pop Culture (120), After Dark (80).

## Game 8 — Earworm (`song`)

Name-that-tune. One device (a phone, or a laptop on the TV) plays a short clip of a song; players
shout the title; the host taps who got it first. The clips are Apple Music's 30-second song
previews (iTunes Search API: no key, open to any site); packs (`src/content/song/*.json`) hold
only title, artist, Apple track id and, optionally, a clip start and a YouTube video id for the
reveal. Nothing plays hidden: there is no video while guessing. It is the only game that needs
internet; without it the ready screen says so ("No internet" or "Can't reach Apple Music") with
Try again. Only a connection problem waits there (offline, a download with no answer, or Apple's
lookup failing); a song whose preview Apple refuses (403, 404), will not decode, or cannot play
because the browser has no Web Audio is skipped like one with no preview ("That song wouldn't
play, so here's another."). Songs from a clip pack (below) play without it.

- **Clip packs** (`scripts/clip-songs.mjs` on the owner's laptop; `clipfile.ts`, `clips.ts`): a
  pack file that also carries a 12-second clip of each song, cut with yt-dlp and ffmpeg from the
  song's YouTube video (its `youtube`, else the best of a search: the artist's own channel,
  "- Topic" or VEVO, about the Apple track's length, never live, cover, remix, karaoke or sped up;
  the next result is tried when Apple's preview is not in the first). The clip starts on the
  moment the game would play from the preview: Apple's preview is found in the full recording
  (mono 1 kHz samples, normalised cross-correlation by FFT, `align.ts`; sure at 0.4, or at 0.2
  when 2.5 times every other offset), plus the pack's `start` or the game's own pick; about 30% in
  when it is not found; `--at "Title=1:23"` (or a `clipAt` field in the input) sets it by hand.
  AAC 128 kbps stereo in .m4a, no tags, 0.03 s fade in, 0.5 s fade out. The file is
  `{"jerkBox": 1, "game": "song", "packs": [the pack], "clips": {"<song key>": {"youtube", "at",
  "seconds", "type": "audio/mp4", "data": base64}}}` (song key: the Apple track id, or
  `yt:<video id>` for a song Apple lacks, marked `"clipOnly": true` and kept only when its clip is
  in the file). It holds copies of recordings, so it goes to `~/Data/party_games/clips/`, never
  into the repo, the site or anywhere public (`.gitignore` refuses `*.clips.jerkbox.txt`).
  "Import packs" on Earworm setup takes it (up to 40 MB, 300 clips of up to 1 MB and 30 s, each
  an MP4): the pack is saved as the player's own like any pack file and its clips go into
  IndexedDB (`jerkbox-clips`, per pack and song key, no titles), with a request that the browser
  keep them; the message says how many were saved. A song with a clip plays from it (decoded
  once, clip from 0, same 2 / 5 / 10 s and 10-second reveal) with no Apple lookup or preview;
  one without plays Apple's preview as before; one whose clip will not decode falls back to the
  preview. A clip-only song is dealt only on a phone that has its clip. Offline, with clips among
  the chosen packs, only those songs are dealt ("No internet, so only the songs saved on this
  phone play."). The pack editor shows "N clips on this phone · 5.6 MB", marks songs that play
  from a clip, and deleting the pack deletes its clips. Built-in packs never carry clips: the
  content gate still requires an Apple track for every built-in song.

- **Setup**: players (2+, remembered), packs (multi-select; pencil opens the pack editor; "New
  pack" makes an empty own pack and opens "Add songs"), points to win (default 10, 3–30).
- **Start**: every song in the chosen packs is looked up in batched calls (`lookup` takes 50 ids a
  call; answers are kept on the phone for a week); songs Apple has no preview for are left out.
  Each song's preview is downloaded and decoded just before it is needed (the next one during
  the reveal), so Play answers at once and the clip starts on the exact second. Songs are dealt
  from per-pack bags (what a phone has heard is remembered across games) and never twice in a
  game; once every playable song has been used (rematches carry on the same list), the one used
  longest ago comes back, never the song on screen unless it is the only one left.
- **Round**: ready screen ("Song N", one big Play button) → Play plays the 2-second clip → listen
  screen: a record spins while the clip plays, with a ring for its progress; "Again" replays,
  "Longer" replays from the start at 5 s then 10 s. Naming it is worth 3 / 2 / 1 points at
  2 / 5 / 10 s. Tap the player who got it, or "Nobody got it" (both ignore taps in the first
  0.4 s, the tail of the Play tap); "Skip song" swaps in another with no penalty and goes back to
  the ready screen, so nobody is ever asked about, or shown, a song the room has not heard.
  Keys on a laptop: Space again, L longer, 1–9 award, 0 nobody. If the browser will not start
  sound, the record says "Tap to start the sound".
- **Clip start** (`pick.ts`): a pack's `start` (seconds into the preview) wins; otherwise the game
  picks the moment itself and remembers it per track: loudness every 50 ms and onset strength,
  Apple's fade-in and fade-out (first and last 1.5 s) ignored, the start in 1.5–20 s that best
  begins the loudest sustained stretch (mean loudness of the next 5 s, plus a bonus for starting
  just after a clear rise or hit), moved back up to 0.3 s to the quietest moment so it opens in a
  breath, not mid-word. The 10-second clip always ends inside the preview.
- **Reveal**: who scored (+points), title and artist big, album art, the song playing on from the
  clip's start for 10 s ("Stop the music" / "Hear it again"), and "Listen on Apple Music" (opens
  the song's Apple Music page in a new tab). A song with a YouTube id shows the video instead of
  the big art, uncovered, at least 200×200, with YouTube's own controls; starting it stops the
  preview. "Wrong name? Undo" returns to the same clip. Nothing names a song before its reveal:
  no screen before it renders the title, artist, art or video; the clips play through Web Audio
  (no media element, so the lock screen, notification shade and car displays get no song
  details); the page title stays the app's; the YouTube player is created only on the reveal.
  The YouTube player (reveal and playlist reading, `youtube.ts`) is always a plain cross-origin
  `youtube-nocookie.com/embed` iframe driven by postMessage, answering only messages from that
  frame on that origin; no YouTube script is ever added to the app's page, so YouTube's code
  never runs where the phone's settings (an invite key, the wizard pass) are stored. The frame
  is sandboxed (scripts, its own origin, presentation and pop-ups only, never top navigation,
  so it cannot move the app's page); only the watched video gets media permissions. It counts
  as answered only on the player's `onReady` or `initialDelivery`. If the player is not ready
  within 15 s, or reports an error before or after it is ready, the reveal shows a "Watch the
  video on YouTube" link.
  Then the scoreboard → "Next song" → ready. First to the target wins (win screen, confetti, rematch). History gets one entry per
  finished game, `finished: false` when a game with something scored is thrown away; songs
  whose preview would not play are listed in its details.
- **Pack editor**: every song with its art; tap one to change its title and artist, the clip
  start (the preview's loudness drawn as bars: tap to place the start, at most 19.5 s, ▶ 2 / 5 /
  10 s to hear it, "Auto" to let the game pick again) and an optional YouTube link for the
  reveal. "+ Add songs" opens the adding screen. A pack with songs from the YouTube version
  says they need a match; "Rematch saved songs" on Add songs puts them in the list, and each
  leaves the pack's to-match list once it is added or turns out to be in the pack already.
- **Add songs** (one screen per pack; nothing is saved until "Add N songs"): Paste (one per line,
  any mix of YouTube links in every form, Apple Music song links, Spotify song links
  (`open.spotify.com/track/…`, with or without `/intl-xx/` and `?si=…`, or `spotify:track:…`),
  "Title - Artist" or "Artist - Title", numbered or bulleted lists, tables from a chat), Playlist (a YouTube playlist link: an
  off-screen embedded player reads up to 200 video ids and is never played; a playlist YouTube
  will not list (private, deleted or empty: the player reports an error, or no videos within
  15 s) becomes a line saying "That YouTube playlist can't be
  read: it may be private or empty", pasting it again retries, and the list goes on; the player
  never answering within 15 s, or being offline, pauses the list), or 🧙 Ask the
  wizard (a theme, a count and "How hard Fizzwick tries"; "Fizzwick is conjuring … songs" while
  "Title | Artist" lines stream in through `streamLines`; without the wizard the screen shows
  the magic-words box and how to ask any chatbot app and paste the answer). Every line goes through the
  matcher (`match.ts`): a YouTube link's title comes from oEmbed and is cleaned (official video,
  lyrics, HD, remastered, featured artists, VEVO and "- Topic" channels), then searched on Apple;
  results are ranked by title and artist likeness, preferring the original studio recording over
  live, demo, karaoke, remix and cover versions; when no result is clearly right, the artist's own
  catalogue is searched too. A Spotify song link's title comes from Spotify's public oEmbed (no
  key or login; never the Spotify Web API or SDK, whose terms rule out games), three calls at a
  time, each given up after 8 s. It gives no artist, so the line is the title with artist "N/A",
  searched on Apple by title alone and always marked "Check this match" with the other results to
  pick from; a kept song takes the artist of the Apple track picked. Spotify not answering stays on
  that line (pasting it again retries); being offline pauses the list. A Spotify playlist, album or
  artist link gets one line saying it can't be read and to paste the songs' links instead; a
  spotify.link short link one saying to open it and copy the long link (a web page may not read
  where it redirects). Results stream into a review list ("Matched 12 of 40", about how
  long is left): art, ▶ preview, keep or drop, "Check this match" on doubtful ones, "Wrong match?
  Pick another" listing the other results, and songs already in the pack, or kept on another
  line, marked "Already in this pack" (the mark is worked out again whenever a line is kept,
  dropped or re-picked: unticking one line frees its repeat to be ticked, and picking another song
  for a kept line passes its old song to the first line set aside as its repeat). The YouTube id a
  line came from is kept for the reveal. Apple allows about 20 calls a minute, so calls go one by
  one through a queue that keeps under it. The review list survives a reload.
- State saved after every step; a reload resumes on the same screen (the clip waits for a tap).
  A game saved by the YouTube version cannot carry on: setup says so once and its scores go to
  History as ended early. `npm run check:songs` asks Apple whether every built-in track still
  has a preview, and YouTube whether every reveal video may still be embedded.

## Hosting

Static build (`npm run build` → `dist/`), base path `./` so it runs from any folder or host.
iPhone motion permission, service workers and wake lock need HTTPS.

## Checks

`npm run check` (types), `npm test` (unit tests for pure logic: tilt, scoring, dealing,
parsing), `node scripts/shot.mjs <url> <png>` for phone-size screenshots of a running dev server.

## Game 7 — Snark Tank (`snark`)

Write-funny-answers-and-vote genre, the first game where every player uses their own phone. One
**host screen** (a laptop on the TV, or a phone in the middle of the table) shows the room code,
prompts, answers and scores; 3–8 players join from their phones at the same site.

- **Networking**: no server of ours. Phones and the host talk directly over WebRTC data
  channels (PeerJS, JSON messages); PeerJS's free public broker only introduces them. The host
  registers as `jerkbox-snark-<CODE>` (4 consonants, no vowels or L). `?peer=host:port` (or
  `wss://host:port/path`) on any Snark Tank address switches that device to another broker, and
  is remembered. The published site is https, so a backup broker must be reachable over
  https/wss (on an https page every broker address connects with wss://; plain ws:// works only
  from an http page, i.e. local dev): e.g. `npx peer --port 9000` plus a quick tunnel such as
  `cloudflared tunnel --url http://localhost:9000`, then `?peer=<name>.trycloudflare.com:443`.
  `?peer=cloud` switches back; the join link and QR
  code carry it to phones. Connection settings (start screen, join screen, lobby) do the same by
  hand. Broker unreachable → "Can't reach the matchmaking service. Check internet, or use the
  backup broker." on both sides, retrying in the background.
- **Host is authoritative** (`logic.ts`, pure): it holds the whole game, saves it after every
  change (`hr:snark:host`), and sends each phone only its own view (`view.ts`: its prompts, the
  two anonymous answers, its score); authors are never sent before the reveal. A phone with
  nothing to do also shows what the host screen shows, so a group can play from phones alone:
  the players in the lobby; who is still writing once it is done (or joined late); who has voted
  once it has voted or the prompt is its own (its answer marked "Yours"); every final answer once
  its votes are sent; the reveal (each answer's author, voters, votes and points, final answers
  ranked); the scoreboard with this round's gains and the next round's countdown; the final
  standings. A phone busy writing or voting is not sent any of this. Pings every 2.5 s;
  a link silent for 9 s is dropped on both sides and the phone redials (1, 2, 4, then every 8 s,
  at once when the phone is unlocked). The room lives at module level, so the host can open
  settings or a pack and come back without dropping anyone; only End game / Close the room ends it.
- **Robustness**: a phone keeps an id and name in localStorage and rejoins as the same player
  with its score after a lock, reload or Wi-Fi change; half-typed answers survive a reload;
  answers and votes sent while offline are resent. A host reload reopens the same room (same
  peer id) and phones reconnect by themselves; a timer that ran out meanwhile gets 12 s back. A
  name already in use by an online phone is refused; the same name from a phone that lost its
  storage takes over the offline seat. Late joiners watch until the next round (they may vote).
  A player who drops keeps their seat; unanswered prompts become "(no answer)". A kicked phone
  cannot rejoin that room. A phone that cannot find its host for about two minutes stops trying.
- **Flow**: Snark Tank → "Host on this screen" or "Join a game". Lobby: big code, QR code of
  `<site>#/snark/join?code=ABCD`, players with colours (✕ removes, after a confirm), settings
  summary, Start (3+). Settings (`#/snark/settings`): rounds 2 or 3, seconds to write
  45/75/90/120 (default 75), seconds to vote 10/15/20/30 (default 15), packs (search/sort, editor,
  paste a pack). 3 rounds = round 1, round 2 (double points), final; 2 rounds = round 1, final.
- **Head-to-head rounds**: one prompt per player, each to exactly two players (a shuffled ring:
  prompt i to seats i and i+1), so everyone answers two (80 characters, Done; the host shows who
  is still writing). Writing ends when every present player is done, or the timer. Then each
  prompt in turn: both answers on the host, everyone except the two authors votes on their phone;
  voting ends when every connected voter has voted, or the timer. Reveal: voters, authors,
  points = share of votes × 1000 (× 2 in round 2), +250 (× 2) for a clean sweep of 2+ votes;
  a prompt with no answers or no possible voters goes straight to its reveal. Scoreboard between
  rounds (next round starts by itself after 15 s, or Start).
- **Final round**: one prompt for everyone; every answer on the host; each player spreads 3
  votes over the others' answers (stacking allowed, never their own; twice the vote time); every
  vote is worth 400. Then the winner screen with confetti; History gets one entry on the host
  only, recorded once (`finished: false` when the room is closed early with something scored).
- **Host controls**: pause/resume (Space; the timer stops on every phone too), skip (End
  writing / End voting / Next; ignores a second tap within 0.8 s), end game, rules. Wake Lock
  on the host and on phones while in a room.
- Demo screens: `#/snark/host?demo=lobby|lobby-empty|write|vote|reveal|vote3|reveal3|scores|over|paused|duel-write|duel-vote|duel-reveal`,
  `#/snark/join?demo=join|lobby|late|write|wait|vote|voted|vote-own|vote3|voted3|reveal|reveal3|scores|over|duel-write|duel-vote|duel-reveal`.
- **Packs**: `src/content/snark/*.json`, `{"prompts": [...]}`, 3–14 words (Classic 200, After
  Dark 80); optional `safety` and `finals`, below.

### Snark Tank: Quiplash 3 options (`snark`, on by setting; defaults unchanged)

Settings gain **Final round**: "Everyone, 3 votes" (today's final, default; also what settings and
games saved before it load as) or "Three-line duels". Rules from Quiplash 3; amounts marked
*house* are ours (the original's are not published).

- **Give me one** (both options): in head-to-head rounds a prompt whose pack has a stock (safety)
  answer for it sends that answer with the prompt; the phone shows "Give me one", which fills the
  box. The host compares each sent answer (cleaned) with its own copy, never trusting the phone:
  an exact match earns half of every point (rounded down, sweep bonus included); an edited one is
  a normal answer. The reveal tags it "Safety" on the host and the phones.
- **Three-line duels** (the final, when chosen and the game has 3+ players and some finals):
  players are paired at random, each pair with its own final prompt (asks for three things). With
  an odd count the player in last place (ties: random) faces **the house**, whose three lines come
  with the prompt. Each player writes up to three lines of 40 characters (Done needs one; blank
  lines dropped; drafts survive a reload). Each duel in turn: a showing step (`show` phase, timed,
  pausable, skippable with "Start voting"), where the prompt and then side A's lines appear one at
  a time 1.5 s apart, then side B's (reduced motion: all at once; the steps are counted from the
  timer, so a pause holds them and a reloaded host or reconnecting phone lands in step); then
  everyone except the two duellers votes for a whole side (twice the vote time; late joiners too).
  Authors (and which side is the house) stay hidden until the reveal. Points: vote share × 3000,
  +750 for a clean sweep of 2+ votes (*house*: the head-to-head formula × 3); votes for the house
  score nothing. Phones with nothing to do follow the showing and the reveal like the host. Then
  the winner screen as today; History gets one line per duel.
- **Fallbacks**: no finals in the chosen packs → Classic's; none at all, or fewer than 3 players
  left → the 3-vote final.
- **Content**: a Snark pack may add `"safety": {"<prompt>": "<answer>"}` and
  `"finals": [{"prompt": "...", "house": ["...", "...", "..."]}]`. Finals are dealt from the
  chosen packs, never repeating until they run out (like prompts). The content gate checks
  shapes only: safety keys are the pack's own prompts and answers 1–80 characters; final prompts
  are unique across Snark packs and never a regular prompt; exactly 3 house lines of 1–40
  characters. Pack files carry both fields when present (broken entries dropped). Classic and
  After Dark have a safety answer for every prompt and 40 / 20 finals.
- Demo screens add `duel-write`, `duel-vote`, `duel-reveal` on host and phone (the head-to-head
  demos carry stock answers; `reveal` shows one sent untouched).

## Shared room link (`src/lib/room/`)

Every own-phones game (Snark Tank, Word Salad, Doodle Brawl) uses one link layer: room codes,
broker choice (`?peer=`, stored under the existing `snark:broker` key so the setting carries
over), PeerJS peers, ping/timeout/redial, hello/welcome/reject/ended, the phone's outbox and the
host's one-view-per-phone sending. Each game supplies its own message reader, view builder and
logic. The host's peer id is `jerkbox-<game>-<CODE>`. Leaving the host screen (its back arrow,
ending the game or closing the room) and leaving or cancelling on a phone return to the game's
first screen the way they came (`back()`), and that screen's Back returns to the main menu; the
browser's or Android's back gesture walks the same path and never lands on a closed host screen. Any message whose JSON is 15,000 UTF-8
bytes or more is sent as numbered parts (`{t: 'part', id, i, n, s}`, at most 5,000 characters
each) and reassembled before it is read; incomplete parts are dropped after 30 s. (PeerJS errors
and drops the link on a JSON message of 16,300 bytes or more.)

## Game 9 — Word Salad (`salad`)

2–8 players join a host screen by code or QR using the shared room link. Two rounds, with
one turn per player in seat order. The host chooses built-in packs in Settings.

- **Pick** (20 s): privately choose one of three secrets, including one Easy and a mix of
  categories (person, place, thing, story). One reshuffle per player each round. At the
  deadline the first choice is taken for anyone who has yet to pick.
- **Prepare** (30 s): everyone builds an opening clue at once. Each blank offers six shuffled
  words, up to three tailored to the secret and the rest drawn from plain shared vocabulary.
  More words redeals the decoys for one blank. At the deadline any empty blank takes its first choice.
- **Present** (75 s): show the opening clue, then offer follow-up frames one at a time. The
  presenter can publish each completed sentence or skip the frame. Comparison frames use
  previous guesses as blanks. Other phones can guess freely. Published clues and guesses
  with their authors appear on the host and phones. The first correct guess ends the turn.
  Matching ignores case, punctuation, spaces and a leading article. Accepted variants use
  the same rules. One typo is allowed, or two for an answer longer than ten letters.
- **Scoring**: the presenter and first correct guesser each earn 1,000 points at the start of
  the turn, falling linearly toward 200, rounded to the nearest point after modifiers. Easy
  halves that payout and round two doubles it. Each distinct wrong guess used in a published
  comparison pays its author 100 on a solve. Unsolved turns reveal the answer and pay zero.
  Reveal lasts 9 s and round scores last 15 s. Final standings share places on ties and show
  the number of secrets the room solved. Results are saved to History on the host.
- **Room controls**: pause, skip, remove a player, close the room or rematch. The host saves
  the room; phones reconnect to their seats and scores. Late arrivals can guess immediately
  and present starting next round. An offline presenter is skipped when their turn comes
  up, or revealed without points after 10 s offline during their turn.
- **Content**: `src/content/salad/*.json` holds packs of secrets with an answer, category,
  difficulty, accepted variants and fitting words for the sentence slots in `words.ts`.
- **Demos**: use `#/salad/host?demo=present` or `#/salad/join?demo=guess`. Both accept
  `lobby`, `pick`, `prepare`, `present`, `reveal`, `unsolved`, `scores`, `over` and
  `paused`. The phone also has `join`, `late`, `wait`, `comparison` and `guess` views.

## Game 10 — Doodle Brawl (`brawl`)

Rules of Champ'd Up, our titles and art. 3–8 players draw on their own phones; a host screen
stages the bouts. Two rounds. No spectator seats; late joiners vote.

- **Round, drawing pass 1** (draw time, default 90 s; 60/90/120/180): each player gets a private
  title (ours, e.g. "World's okayest roommate") and draws a fighter for it, then names it
  (30 characters; an empty name becomes “Nameless”).
- **Drawing pass 2**: each player is handed another player's fighter (picture and name, never
  the title; a shuffled ring, never their own) and draws and names a challenger for it.
- **Bouts**: for each title in turn the host reveals the title, then both fighters with their
  names; everyone except the two artists votes (15 s). Purse 1000 (round 2: 2000, *house*) split
  by vote share; the challenger also gets 10% of their own share (wiki, single source), so an
  even split goes to the challenger. The side with more points wins the bout. A blank fighter
  loses without a vote and the other side takes the whole purse; both blank: the bout is skipped.
  No votes cast: each side gets half the purse, the challenger's bonus applies.
- **Round 2 rematch**: straight after each round-2 bout the same two artists get a surprise
  title. Each picks on their phone (15 s): keep their fighter, or tag in one of their own
  fighters already shown this game. Then a vote as above, purse 2000; a player who kept their
  fighter and wins the rematch gets +500 (*house*; the original confirms a bonus, not its size).
- Highest total wins; ties share first. End screen: standings and each bout winner's fighter.
- **Drawing**: square canvas, 640 × 640 units, Pointer Events, scrolling locked; 8 colours,
  thin/thick pen, undo, clear. Stored as strokes `{c: colour, w: width, p: [x0, y0, dx1, dy1, …]}`
  (whole units, points closer than 3 units dropped). The host keeps drawings in their own
  store (key `brawl:art`), never in the game state; views carry drawing ids; a phone asks for a
  drawing it lacks (`{t: 'art?', id}`) and keeps the answer. Drawings travel through the shared
  link's parts.
- **Content** (`src/content/brawl/*.json`): `{"titles": ["..."]}`; titles and rematch titles
  come from one pool, never repeating within a game.
- The drawing timer applies to each pass. Submit early or let the phone send your drawing at
  the buzzer. A half-finished drawing survives a phone reload. Drawings over 200 KB
  or 6,000 points are rejected. The host removes stored art when the room closes.
- The title gets 3 s on its own. Results stay up for 8 s and the round scoreboard for 15 s.
  When both round-two fighters are blank, the first bout is skipped and the rematch runs if
  either artist has a previously shown fighter available. The host can pause, advance or close
  the room. The lobby supports removing players, choosing packs and changing brokers. Reconnects
  and History work as in Snark Tank. Classic has 120 titles and After Dark has 60.
- Demos at `#/brawl/host?demo=` and `#/brawl/join?demo=` with
  `lobby|lobby-empty|draw|challenge|title|vote|payout|tag|rematch|scores|over|paused`.
  Phone demos also have `join|wait|late|voted|watching|tagged`.
