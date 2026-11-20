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
(`#/forehead`, `#/dial`, `#/gibberish`, `#/quiz`, `#/settings`) so any static host works.

- `src/lib/` — shared logic: `storage` (guarded localStorage), `router.svelte`, `settings.svelte`,
  `sound` (synthesised cues; call `unlockAudio()` in the first tap), `haptics`, `wakelock`,
  `motion` (permission, motion stream, sign fix, upright rotation), `pitch` (forehead pitch from
  gyroscope + gravity), `tilt` (gesture detector), `calibration` (practice tilts → thresholds),
  `bag` (deal without repeats across rounds and restarts), `content` (built-in + custom packs),
  `claude` (live generation, streamed line by line), `history` (finished rounds and games),
  `paste` (reading pasted lists), `update` (new versions switch in on the main menu), `random`.
- `src/components/` — `Screen` (page frame: back button, title, sticky actions), `Popup`,
  `HowTo` (the "?" header button that opens a game's rules), `Button`,
  `FitText` (text as large as its box allows), `Stepper`, `Toggle`, `Triage` (review generated
  items while they stream in).
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
3. **Ask Claude in the app** (later, needs an API key): the host pastes an Anthropic API key in
   Settings; it stays in that phone's localStorage and the phone calls the API directly.
   `streamLines()` hands each line over as soon as it is complete; items stream into `Triage`;
   "More" sends the items already kept so Claude avoids repeats.

**Every pack can be opened and edited**, built-in or the player's own. Editing a built-in saves
an edit under the same id that replaces it everywhere on that phone, marked "Edited", until
"Restore original". Only the player's own packs can be deleted.

## Shared behaviour

- **Home** shows every game in `GAMES` (name, emoji, player count), History and Settings. No blurbs.
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

- **Setup**: grid of decks (emoji, name, word count); tap to select one or several (mixed).
  Round length 30/60/90/120 s (default 60). Controls: Tilt (default when motion works) or Tap.
  "Edit decks" opens the deck list: open any deck to see, edit or restore its words.
- **Start tap**: `unlockAudio()`, `requestMotion()` (iOS prompt), sample gravity for the sign fix
  (`axisSignFromLookingAt`), `keepAwake(true)`, and on Android try fullscreen + landscape lock
  (guarded; iOS has neither).
- **Get ready**: "Put it on your forehead". The countdown starts by itself once the phone has
  been held upright and steady for ~0.7 s (or on tap). 3-2-1 beeps, then the first word.
- **Play**: the word as large as possible (`FitText`), timer, score. The screen content is rotated
  so text reads upright for the people facing the phone, even when the phone's rotation lock
  keeps the page in portrait (`uprightRotation` combined with `screen.orientation.angle`; fixed
  at countdown start). Tilt down → correct (✓, chime, double buzz); tilt up → pass (buzz).
  Feedback (Settings): by default the screen edge on the side of the matching tap zone glows
  green or amber; "Flash the screen" flashes the whole screen instead. Tap fallback always on: right half correct, left half pass. Last 10 s:
  tick each second and a red pulsing timer. Leaving the app pauses; returning shows a Resume
  overlay. A small ✕ ends the round after confirmation. Deck exhausted → round ends early.
- **Results**: score headline, every word shown marked ✓/✗ and tappable to fix mis-tilts.
  Play again (same settings, next player), change decks, home. Round scores of this session
  listed so the group can compare.
- Pitch comes from the gyroscope blended with gravity (1 s time constant, `src/lib/pitch.ts`).
  Raw gravity alone fails: recorded nods (Tilt lab, below) start with a shove along the screen
  normal that reads, for ~100 ms, as a big tilt the other way, so got-it nods scored as passes.
  Browsers disagree on which `rotationRate` field holds which axis (Firefox on Android puts the
  nod on `beta`), so each phone learns its layout from its own motion (whichever candidate
  tracks gravity best while the phone is on a forehead) and keeps it; Firefox on Android starts
  from its recorded layout. With no gyroscope, the
  browser's gravity estimate (`accelerationIncludingGravity` minus `acceleration`) is used.
- Tilt is measured from where the phone has been over the last 2 seconds (the median pitch,
  leaving out the newest quarter second, clamped to ±25°), starting from the pose held steady
  before the countdown (0 after a tap start). That reference is frozen from a score until the
  phone settles again, so a held tilt never scores twice or counts the way back. A score needs
  the angle and speed: the pitch must have turned briskly in the last 0.4 s. Until a player
  calibrates: 25° down, 20° up, 150°/s, the owner's calibration from 64 recorded tilts (they
  turned at 175–1100°/s; talking, laughing, looking around, leaning back stayed under ~105°/s). After a score the phone must settle near rest for 150 ms, or hold still at least
  halfway back from the tilt, before the next one counts. Constants in `src/lib/tilt.ts`.
- **Calibrate tilt** (`#/forehead/calibrate`, from Setup and Settings): the phone, on the
  forehead, says "Down" or "Up"; each practice tilt it catches beeps and counts; as many as the
  player likes, then Done. Thresholds: 35% of the player's median tilt (12–25°) and half their
  median speed (60–150°/s). Kept on the phone until the next calibration; Reset returns to the
  defaults. Replaces the old Small / Medium / Big setting.
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
  the needle for 1 point. Entry to "Make a pack" (paste a list or ask Claude). Each pack row
  has a separate › that opens the pack editor.
- **Teams**: Early Birds (`--c-team-a`, warm orange) vs Night Owls (`--c-team-b`, blue), on the
  dark theme: team colour as glow, border and name, never a full bright fill. The scoreboard
  is a face-off; the hand-off shows round, both scores and the rival.
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
  (off/20/30/45/60, default 30), points to win (default 5). Entry to "Make a pack" (paste a list or ask Claude).
  A pencil on each pack tile opens the pack editor (giveaway check applies to edits).
- **Card**: the reader rotates each card. Hand-off screen ("X reads — everyone else, eyes off the
  phone") → reader view: the phrase huge, a "Show category" button the reader may read out,
  answer hidden until press-and-hold, countdown ring. When someone shouts the answer the
  reader taps that player's name → point, answer revealed big with a chime. Time runs out or
  "Nobody" → answer revealed, no point. Skip draws a new card without penalty.
- Scoreboard between cards; first to the target wins (win screen, rematch). State saved.

## Game 4 — Big Board (`quiz`)

A team quiz board for a host who reads aloud, on a phone or a laptop on the TV. A board has
categories across and clues down, easiest at the top. Built-in boards (`src/content/quiz/*.json`)
are 3–6 categories × 3–5 clues; boards made or edited on the phone may be 1–8 × 1–10.

- **Setup**: 1–20 teams (stepper, default 3; a team may be one person), names editable and
  remembered for all twenty seats, each with its own colour (`--team-1` … `--team-20` in
  tokens.css, one set per scheme, readable as text and under a number badge). One board
  (search/sort list; a pencil per row opens the editor; "Make a board" at the end), points
  100, 200, … per level or doubled, "Wrong answers lose points" (default off). A board with an
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
- **Board editor** (`#/quiz/board?id=<id>`): name, short description, levels stepper (adds or
  removes the bottom level on every category; removing one with clues asks first), category
  tabs (add up to 8, rename, move left/right, remove), and every clue and answer inline, empty
  ones highlighted. Every change saves at once; a built-in saves this phone's copy under the
  same id (Edited tag, "Restore original"); own boards can be deleted.
- **Make a board** (`#/quiz/make`): Blank (name, categories 1–8 × levels 1–10, default 5 × 5),
  Paste (a "# Category" line then "clue | answer" lines, easiest first; tolerant of other
  headings, list markers, tables, "Q:/A:", value columns and "Category | level | clue | answer"
  lines; short categories get empty tiles; past 8 × 10 is cut off and the skipped lines are
  counted), or Ask Claude with an API key (topic, categories × levels; Claude streams one line
  per clue, "Category | level | clue | answer", easiest row first, under the AGENTS.md quality
  bar, and a live preview fills tile by tile; "Stop" opens what came). Without a key it points to
  Settings or to a Claude Code chat ("a Big Board about <topic>"). Every route opens the new
  board in the editor, kept in storage (`quiz:new-board`) until "Save board" (or "Save as a
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
  list or ask Claude), seconds on the clock 5/7/10 (default 5), points to win (default 7, 3–15),
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
shout the title; the host taps who got it first. Songs stream from YouTube through the official
IFrame Player API on that device: nothing is downloaded or stored, and packs
(`src/content/song/*.json`) hold only title, artist, YouTube video id and start second. It is
the only game that needs internet; without it the ready screen says so ("No internet" or "Can't
reach YouTube") with Try again.

- **Setup**: players (2+, remembered), packs (multi-select; pencil opens the pack editor; "New
  pack" makes an empty own pack to fill from YouTube links), points to win (default 10, 3–30).
- **Round**: ready screen ("Song N", one big Play button) → Play plays the 2-second clip from the
  song's start → listen screen: the player is covered by a record that spins while the clip
  plays, with a ring for the clip's progress; "Again" replays the clip, "Longer" replays from the
  start at 5 s then 10 s. Naming it is worth 3 / 2 / 1 points at 2 / 5 / 10 s. Tap the player who
  got it, or "Nobody got it"; "Skip song" swaps in another with no penalty. Keys on a laptop:
  Space again, L longer, 1–9 award, 0 nobody.
- **Reveal**: who scored (+points), title and artist big, and the video uncovered, playing on
  for 8 s as a payoff ("Skip video"); "Wrong name? Undo" returns to the same clip. Then the
  scoreboard (bars toward the target) → "Next song" → ready. First to the target wins (win
  screen, confetti, rematch). History gets one entry per finished game, `finished: false` when a
  game with something scored is thrown away; refused songs are listed in its details.
- **Player** (`clip.ts`, one YouTube player for the whole game, never moved or re-created so the
  iPhone keeps its permission to play sound): the Play tap itself calls play (iOS only starts
  sound inside a tap). A clip counts only while the video's own clock is inside it, so an ad
  (another video id, or our video stuck before the start) never eats the clip: after 1.2 s the
  cover says "One sec, YouTube is showing an ad" and the clip starts from its start once the ad
  ends. If play gets no answer for 3.5 s the cover says "Tap here to start the sound" and lets
  that tap through to the player. The next song is chosen and loaded while the reveal plays.
  A video YouTube refuses (errors 100/101/150, or any other error) is skipped with no penalty,
  logged, swapped for another at once, and (for 100/101/150) never dealt again on that phone.
- State saved after every step; a reload resumes on the same screen (the clip waits for a tap).
  `npm run check:songs` asks YouTube's oEmbed endpoint whether every built-in video may be
  embedded.

## Hosting

Static build (`npm run build` → `dist/`), base path `./` so it runs from any folder or host.
iPhone motion permission, service workers and wake lock need HTTPS.

## Checks

`npm run check` (types), `npm test` (unit tests for pure logic: tilt, scoring, dealing,
parsing), `node scripts/shot.mjs <url> <png>` for phone-size screenshots of a running dev server.

## Game 7 — Snark Tank (`snark`)

Write-funny-answers-and-vote genre, the only game where every player uses their own phone. One
**host screen** (a laptop on the TV, or a phone in the middle of the table) shows the room code,
prompts, answers and scores; 3–8 players join from their phones at the same site.

- **Networking**: no server of ours. Phones and the host talk directly over WebRTC data
  channels (PeerJS, JSON messages); PeerJS's free public broker only introduces them. The host
  registers as `jerkbox-snark-<CODE>` (4 consonants, no vowels or L). `?peer=host:port` (or
  `wss://host:port/path`) on any Snark Tank address switches that device to another broker, e.g.
  `npx peer --port 9000`, and is remembered; `?peer=cloud` switches back; the join link and QR
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
- Demo screens: `#/snark/host?demo=lobby|lobby-empty|write|vote|reveal|vote3|reveal3|scores|over|paused`,
  `#/snark/join?demo=join|lobby|late|write|wait|vote|voted|vote-own|vote3|voted3|reveal|reveal3|scores|over`.
- **Packs**: `src/content/snark/*.json`, `{"prompts": [...]}`, 3–14 words (Classic 200, After
  Dark 80).
