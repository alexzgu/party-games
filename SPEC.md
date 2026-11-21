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
  never vibrates while the phone is on silent. Settings words the Sound and Vibration notes for
  this device only (`lib/device`: iPhone, iPad, Android or other, from the browser's own report;
  used for wording only, never for play), and the tilt check names it ("browser tab on iPhone").
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
  would return to it in a loop; a game's Home button uses `backHome()`, which walks back to the
  main menu; a new screen opens at the top and Back restores the scroll it was left at),
  `settings.svelte`, `players` (default names, and `reseating`: a saved game's players after
  its setup list was edited, which `PlayerList` tracks by place),
  `sound` (synthesised cues; call `unlockAudio()` in the first tap), `haptics`, `wakelock`,
  `motion` (permission, motion stream, sign fix, upright rotation), `pitch` (forehead pitch from
  gyroscope + gravity), `tilt` (gesture detector), `calibration` (practice tilts → thresholds),
  `bag` (deal without repeats across rounds and restarts), `content` (built-in + custom packs),
  `claude` (live generation, streamed line by line), `wizard` (effort → model), `wizardServer` (the magic words), `invite` and `join` (invite links), `history` (finished rounds and games),
  `paste` (reading pasted lists), `packfile` (pack files: export, import), `menu` (a menu's keys and which way it opens), `panel` (whether a pack page's players or teams start shown; which edges of a part scrolling on its own have more behind them), `keepScroll` (the scroll of a page's parts scrolling on their own, kept for Back), `library` (the Community library), `shareLog` (what the Community library took of each pack, and which are being sent), `username` and `usernameShape` (this phone's username; the rules for one, shared with the wizard server), `packList` (search, picks and counts for the shared pack list), `share` (share sheet or download), `update` (new versions switch in on the main menu), `random`.
- `src/components/` — `Screen` (page frame: back button and title pinned at the top, actions pinned at the bottom), `PackList` (every pack game's pack page: pinned players or teams and packs row, the scrolling packs, the Add pack row), `ScrollWindow` (rows that grow, in a window scrolling on its own with fading edges), `Popup`, `MenuButton` (a button opening a small menu),
  `HowTo` (the "?" header button that opens a game's rules), `RulesCard` (a setup's settings
  behind one row), `Button`,
  `FitText` (text as large as its box allows), `Stepper`, `Toggle`, `Triage` (review generated
  items while they stream in), `WizardEffort` (how hard Fizzwick tries, on every make page), `PackFile` (the row under every pack list: Add pack — New, Community, Import — and Export),
  `ExportPack` (Export pack), `Community` and `CommunityItems` (browse, preview, import and star
  Community packs), `ShareNote` (the note a failed Community share leaves), `UsernameField` (Settings' username box).
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
2. **Paste a list** on the phone: each game's "Make a pack" screen (Add pack → New under the
   pack list) takes a pasted list (one item per line, in the game's format), shows it in
   `Triage` for review, and saves it as a custom pack on that phone.
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
   shared party phrases as secrets the owner enters in Cloudflare. A friend types a word or a
   few in the magic-words box; the server checks them (case, punctuation, symbols and spacing
   ignored; each distinct word is a guess, and so is the whole phrase when there are two or
   more words, at most 12 per try, and any one matching a magic word lets the phone in, so a
   phrase of several words still works typed whole; guessing is a game of its own, so guesses
   are limited only far above human pace: 60 a minute per address, an IPv4 address or an IPv6 /64, and 600 a minute
   overall, with a separate 100 a minute (10 per network) for addresses with no guess in the last
   minute so a flood cannot lock friends out for long; every guess of a try is counted before
   checking, only as many as the address has left are checked, and a right try gives all of
   its guesses back; right tries are limited to 20 per address per day; `worker/README.md` has the numbers)
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
icon (`emoji`, any one character) for Heads Down., blurb, items) without `custom` and `added`; named
`<game>-<pack id or my-packs>.jerkbox.txt` (JSON inside, plain-text type so Chrome on Android
can share it; import also takes `.json`). "Export pack" sits in every pack editor (built-ins
included); Add pack → "Import" (packs from a file) and "Export" (every pack made or edited on this
phone; hidden when there are none) sit in the row under every game's pack list (the
setup's, Snark Tank's in its game settings). Export uses the
share sheet when the browser can share the file, else a download. Import reads a file of at most
1 MB and up to 100 packs of up to 1,000 items; checks each item with that game's own rules (the
pack editor's or the paste route's; Big Board: 1–8 categories × 1–10 clues, cut and padded like a
pasted board); drops what fails and says how many; leaves out a pack with nothing usable; and
saves each pack as the player's own, ticked on its own in place of the packs ticked before (Big Board: picked), under a fresh id (`-2`, `-3`, …)
when a built-in or a pack on the phone already has its id, so nothing is overwritten, and a fresh
name ("Movies (2)") when one already has its name. A pack just made is likewise played on its own. A file of
another game says which game to open; one of a game taken out of the app (`RETIRED_GAMES` in
`src/app.config.ts`) says so by name, even when it is too big to read ("Earworm is no longer in
Jerk Box."); anything else says it isn't a pack file.

**Community library** (`src/lib/library.ts`; server routes `/library/…` in `worker/`, see
`worker/README.md`): packs Fizzwick makes on any phone with a magic-words pass are shared
automatically, whole, the moment they are saved, and again after "🧙 Add more" (Snark Tank: also
"Fill in stock answers"), so friends need not remember to. Only what the wizard wrote through a
pass is shared by itself (decided as each run starts): anything made with the host's own key or an
invite link never is, even once the phone has a pass, nor is a built-in pack or its edit. Each own
pack keeps that decision with it: it is marked for sharing when a wizard run through a pass made it
(a Big Board draft keeps the mark when saved) or when it is shared by hand (below), and loses the
mark once a run not through a pass adds to it; one that started pasted, typed by hand or imported
has no mark until it is shared by hand. A pack is shared by itself only while it has the mark and
the run that just added to it went through a pass; hand edits keep the mark. Pack files never
carry it. The same pass and pack update one entry. Sharing never holds up saving; when it fails
the page shows a small note, "Couldn't share to the library". Each wizard form says once, in
small text, "Packs Fizzwick makes are shared in the Community library." Shared packs stay for
good (the owner can hide one).
**Sharing by hand** (`SharePack`, `canShare`, `shareStatus`, `shareProblem`): every pack editor of
a game with the library shows "🌍 Share to Community" under "Export pack" for the phone's own saved
packs (pasted, typed by hand, imported from a file or made by Fizzwick), never for a built-in pack
or its edit, nor for a pack imported from the Community library (marked `fromLibrary` when
imported; packs imported before the mark existed cannot be told apart). The first share of a pack
asks once, in place: "Anyone can see and import it. Your username, <name>, shows on it." with
"Share it" and "Cancel". Without a pass, the magic words box opens right there ("Sharing needs the
magic words. Say the ones the host told you:", with "Not now") and the share goes ahead once they
are said; a phone on the host's own key is told sharing needs the magic words. A pack the library
would not take is a disabled button with the reason under it: no name, a Big Board with empty
tiles ("Fill the 3 empty tiles first."), nothing in it, more than 400 items or over 64 KB (the
server's own limits, `libraryShape.ts`). A refused share says why in plain words (`failureWords`:
offline, pass ran out (the box comes back), today's sharing limit, too big, server trouble). What
goes, and what the button compares, is always the pack as saved on the phone (each editor saves on
every change), never the editor's own copy. Once the library takes it, the saved pack is marked
shared in place, nothing else in it changed (a pack deleted meanwhile stays deleted), so it then
behaves like a shared wizard pack; the button is a quiet "✓ Shared in Community", and after any
change it reads "Share changes", under "Shared in Community · changed since". The phone keeps, for
each pack the library took, a fingerprint of the version it took and the id the library knows it
by (`shareLog.svelte.ts`, noted on every share that lands, Fizzwick's included; a pack moved off a
new built-in's id keeps both, so its next share updates the same entry). A pack marked for
sharing with no such record (Fizzwick's automatic share failed, or it was shared before records
were kept) says "This phone has no record of sharing it." over "Share now", asking nothing
first; while any share of the pack is on its way the button reads "Sharing…" and waits. The
editor's status line says "shared in the Community library: edits go out when you tap Share
changes or Fizzwick adds to it".
Each share (and each update) carries the phone's username at that moment; the server keeps it only
when it is a username by the same rules as the phone's (tidied, 1–24 characters) and otherwise
stores the pack without one. Packs shared before usernames have none.
Add pack → "🌍 Community" (beside "Import" in that menu) opens the Community packs over the pack list (the
address gains `?community=1`, so Back closes it): a search of pack names and descriptions only
(not the items, nor usernames), Most stars (then newest) or Newest, 30 at a time with "Show more"; each row
shows name, description, item count and ★ stars, and the sharer's username as a small, quiet
chip beside the count (nothing for a pack without one; no "made by" wording); the preview shows the
same chip under its count. Tapping a pack shows everything in it (Snark
Tank: with its stock answers and finals). Everything fetched is rebuilt from each game's own
fields first (`src/lib/libraryShape.ts`, the same rules the server stores by).
"Import" saves it through the pack-file import above (same checks, fresh id and name, ticked on
its own) and leaves out items a built-in pack already has in games whose items must be new
across packs (Spectrum, Inn Co Hear Ant, Brain Freeze, Don't Say It, Snark Tank). Browsing and
importing are open to anyone; starring (one star per pass per pack, tap again to take it back)
needs the magic words, and without them the star is a hint that opens the magic words box; a
pass the server refuses (expired, or the words changed) is forgotten and the box comes back.
Loading, empty, offline and server-trouble states are said in plain words. Without a wizard
server (`WIZARD_SERVER` empty) there is no Community entry.

## Shared behaviour

- **Home** shows every game in `GAMES` (name, emoji, player count), History and Settings. No blurbs.
  Any other address, such as one of a game taken out of the app (`#/song`), shows Home.
- **Settings**: Feel (sound, vibration; switching either on plays a sample chime or buzz), Look (colours; pack lists as Tiles or List, the same choice as the switch on every pack list), Heads Down. (scored-word feedback,
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
- **Username** (`src/lib/username.ts`): every phone has one. A phone without one is given a
  random friendly name the first time anything asks: an adjective and an animal from the app's
  own word lists ("Sneaky Otter"), at most 14 characters so it fits every room game's name box.
  Settings shows exactly "Username:" and a text box (`UsernameField`). What is typed is saved as
  it is typed, tidied: invisible and control characters dropped, spaces collapsed and trimmed,
  1–24 characters (`src/lib/usernameShape.ts`). A box left empty or holding only spaces gets a
  fresh random username when it loses focus or the page is left. Nobody checks that usernames are
  unique. It is the name the room games' Join screens start with (see the shared room link) and
  goes with every pack the phone shares to the Community library.
- **Rules** live in each game's "?" popup, not on its screens; the popup sits on setup and, in the
  pass-the-phone games, on every hand-off too.
- **Settings behind a card** (`RulesCard`): a setup keeps players or teams and packs on the page and
  puts its game settings behind one full-width row in the pinned bar just above Start: a title
  ("Rules" unless the game names it), the current values on the same line ("60 s turns · first to
  15 points · skips are free", cut off with "…" when long; its accessible name says all of it) and a
  settings icon, about 52 px tall. Tapping it opens a popup with the controls and Done; a change
  applies and is saved at once, and Done, ✕, Escape or a tap outside just close it, with focus back
  on the row.
- **Pinned bars**: every screen's header (back, title, "?") stays at the top as the page scrolls,
  in the page's own background (under the status bar too), with a hairline once something slides
  under it; its title is one line, cut with "…" when long (the whole title is still read out). The
  main menu's header (🎲 Jerk Box, History, Settings) likewise. A screen's actions (a setup's rules
  row and Start) stay at the bottom; they sit in the page's flow, so at the end of the page they
  cover nothing. A phone on its side (height ≤ 500 px) also shrinks the screen header to 48 px and
  puts the rules row and the start buttons side by side. Whatever the page scrolls to (a new row, a
  focused field) stops clear of the pinned header and actions (`src/lib/scrollPadding.ts`). The
  page's glow is one layer fixed to the screen, and each pinned bar paints the same glow placed
  where it sits, so the bars match the page on iPhones too.
- **Pack pages** (every setup with packs, and Snark Tank's game settings; `Screen` with `fill`,
  `PackList`): the page fits the screen and only the packs scroll. Above them, pinned under the
  header, stay any notice (a compact "Game in progress" card with the leading scores, Big Board's
  draft warning, Snark Tank's "A game is running"), the players or teams, and the packs row
  (title, counts, search, sort, tiles/list, and the open search bar or sort chips); under them,
  pinned over the actions, the Add pack row. A hairline (with a soft shade) marks the packs' top
  edge only while some are scrolled away above, and their bottom edge only while more are below,
  rechecked whenever the list scrolls or changes size (a search, the tiles/list switch, an
  import). The packs keep at least about one row on screen (96 px; 64 px on a phone on its
  side); a screen too short even for that scrolls as a whole, the header and actions still pinned,
  and a swipe on the packs that reaches their end moves the screen on. Leaving for a pack editor,
  a make page or calibration and coming Back finds the packs (and the screen) scrolled where they
  were (`src/lib/keepScroll.ts`, kept by the router with the page's own scroll).
  - **Hide players / Show players** (Big Board, Spectrum, Don't Say It: "teams"): a button at the
    end of the packs row, "Players" with an arrow, spoken "Hide players" or "Show players", folds
    the players or teams away (and back) with a smooth change of height (none with reduced
    motion); folded, they cannot be focused or read out. One choice for every game, kept on the
    phone; until the phone has made one, they start shown on a screen 700 px tall or more and
    folded on a shorter one (a small phone, any phone on its side). While the game cannot start
    for too few players (Inn Co Hear Ant, Brain Freeze) they show whatever was chosen and the
    button is gone; once enough are added they stay shown for this visit. The choice is read when
    the page opens, so a keyboard shrinking the screen never folds them. The button and the
    tiles/list switch ignore taps in their first 400 ms (the tail of a double tap on the screen
    before). Heads Down. and Snark Tank have nothing above their packs row and no button.
  - **Players and teams that grow** (Inn Co Hear Ant and Brain Freeze players, Big Board
    teams; one list, `PlayerList`: two tiles a row, tap a name to rename it in place, ✕ removes,
    the count and "need N+" in its head) show in a window about three rows tall that scrolls on
    its own, with Add player (Big Board: Add team) always in view outside it. Its top and bottom edges fade out,
    each only while there is more to scroll that way; a name scrolled to or being typed stops
    clear of the fades. Adding a player (or a team) scrolls the window to the new row. A shorter
    screen shows fewer rows (down to one), and if it shrinks while a name is being typed, that
    name stays in view. Spectrum and Don't Say It's two team names need no window.
- **Stacking** (`--z-*` in tokens.css, lowest first): the page's pinned header and actions, things floating over everything without taking taps (confetti,
  flashes, the drag-around timer), full-screen layers (pauses, game menus, the Community packs), a
  pinned bar holding an open popup or menu, popups, the share note.
- **Double taps**: a button or the rules row ignores taps in its first 400 ms on screen
  (`src/lib/tapGuard.ts`), so the second tap of a double tap never presses what the next screen
  has in the same spot.
- **Pack list** (`PackList`, `src/lib/packList.ts`): the one way every pack game (Heads Down.,
  Spectrum, Inn Co Hear Ant, Big Board, Don't Say It, Brain Freeze, and Snark Tank's game settings)
  picks, edits, makes and shares packs. Header: "Packs" (Snark Tank: "Prompt packs") with what is
  picked under it ("2 picked · 320 words"; Big Board: "25 clues"; "pick one or more" when none),
  then search, sort and a tiles/list switch (one choice for every game, kept on the phone; default
  tiles). Tiles: a grid of at least 150 px columns (two on a phone); each shows the mark top right,
  the Heads Down. icon, name, description cut to two lines, a search hit line while searching, and
  "60 words · Mine" (or Edited; Big Board "5 × 5" and "3 empty"). List: one full-width row each,
  the mark on the left, the Heads Down. icon, name with a Mine or Edited tag, the whole description,
  Big Board's category names and "N empty", and the size on the right. In both, tapping a pack
  ticks it (several packs; a rounded-square tick) or picks it (Big Board: exactly one, a round
  mark, a radio group), and the pencil (48 px, bottom right of a tile, right end of a row) opens it
  in that game's editor. The last item (not while searching) is "✨ Make a pack", a dashed tile or
  row with the game's ways to make one under it ("Paste a list or ask the wizard"), the same as
  Add pack → New. Under the list, pinned just above the actions (see Pack pages), a row holds
  "Add pack" and "Export" (spoken "Add pack" and
  "Export my packs to a file"; Export only when this phone has packs of its own), with a line
  under them saying how an import or export went. "Add pack" opens a small menu that grows out of
  it, upward (downward when there is more room below), over everything: ✨ New (the game's way to
  make a pack), 🌍 Community (games in the Community library) and 📂 Import (a pack file). A tap
  outside, Escape or choosing closes it, with focus back on the button; it is a proper menu
  (the button says whether it is open; the arrow keys, Home and End move between the items; Tab
  closes it and moves on). Reduced motion: it appears without growing. An import plays the
  imported packs on their own (Big Board: picks the first; Snark Tank: adds them to the picked
  ones). Brain Freeze's list ignores taps in its first 400 ms (the tail of a double
  tap on the screen before).
- **A saved game and its setup**: with a game in progress, setup shows that game's players
  (Big Board: teams). Adding, renaming or removing them changes the saved game on Resume (or on
  leaving setup): a kept player keeps their score, newcomers start at 0, a removed one leaves
  with their points. Pack and rule changes apply to the next game, and setup says so.
- **History** (`#/history`): one entry per Heads Down. round (rewritten if a word is fixed
  afterwards) and per finished Spectrum or Inn Co Hear Ant game: title, scores, packs and
  details. Filter by game, open, delete one, or clear all. Stored on the phone only; entries of a
  game taken out of the app are left out.
- **Search and sort** (`ListTools`): every pack list and every pack's contents has a search
  toggle (matches names, blurbs and the items inside; a pack found only through an item shows
  `has "…"`, or `has "…" and 2 more`) and a sort toggle (Suggested, Newest, Oldest, A–Z). Each list remembers its toggles
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

- **Setup**: the shared pack list (packs with their icon, word count); tap to select one or several (mixed); the pencil opens a pack to see, edit or restore its words (`#/forehead/deck?id=…`; the old pack screen `#/forehead/decks` now opens setup). Add pack → New ("Make a pack") offers Paste, By hand (opens an empty pack in the editor) and 🧙 Wizard.
  A "Round" card (summary like "60 s rounds · tilt or tap") holds round length 30/60/90/120 s
  (default 60), Controls and, unless Controls is Tap, Calibrate tilt. Controls: Tilt, Tap or Both (default Both on phones
  and tablets, Tap on a laptop; the old saved "Tilt", which always took taps, carries over as
  Both). Only the chosen input scores: in a Tilt round the tap zones are gone and the arrow keys
  do nothing; in a Tap round tilting does nothing. A Tilt round on a phone that cannot feel
  motion takes taps instead, so it can always be played (`accepts` in `round.ts`).
  Between its name and its words, a pack's icon is a box that takes one character, typed or pasted ("Type or paste one emoji or letter"), shown large beside it: anything longer is cut to its first character as a person sees it (`oneIcon` in `src/lib/icon.ts`: a flag, a skin-toned or joined emoji like 👩‍🚀, or an accented letter is one), and an empty box means the default 🃏. Pack files and the Community library carry the icon (the library keeps it only when it is exactly one character); older packs keep theirs. No other game's packs have an icon.
  On the player's own packs (not built-ins), "🧙 Add more" (`AddMore`, `src/lib/addMore.ts`) asks how many (10–80, default 20) and for an optional steer, then the wizard writes more in the pack's spirit (the request carries its name, description and every word, so none repeats); they stream into `Triage` for review and the kept ones go on top. No wizard: the magic-words box in place of the form.
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
  The word on screen when the round ends (time up or ✕) was never played: it is left out of the
  results and goes back into its pack unseen (`putBack` in `src/lib/bag.ts`), so a later round can deal it.
- **Results**: score headline, every word played marked ✓/✗ and tappable to fix mis-tilts.
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

Community: wizard packs and Add more are shared; "🌍 Community" is in Add pack under the pack list on setup; imported words are kept even when a built-in pack has them.

## Game 2 — Spectrum (`dial`)

Wavelength-genre. Two teams. Each round one player of the active team (the reader) secretly
sees where a target sits on a scale between two opposites, gives one clue out loud, and their
team sets a dial to where they think the target is.

- **Setup**: two team names (editable), packs (multi-select), and behind the Rules card
  ("First to 10 points · steals on") points to win (default 10) and the optional "steal" rule: the other team then guesses whether the target is left or right of
  the needle for 1 point. Add pack → New at the end of the pack list makes a pack (paste a list or ask the wizard). Each
  pack's pencil opens the pack editor; on the player's own packs, "🧙 Add more" as in Heads Down. (5–40 cards, default 10; never a scale any pack on the phone has).
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
- The hand-off's ⋯ menu offers Keep playing, Pause and go home, and End game, like the menu
  on every other game screen.
- **Landscape** (a phone on its side, height ≤ 500 px): game screens put the dial on the right at
  full height and everything else, the main button included, on the left; the hand-off and win
  screens split the same way. Nothing scrolls, and turning the phone re-fits the page at once.
- Game state saved after every step; reopening resumes.

Community: wizard packs and Add more are shared; "🌍 Community" is in Add pack under the pack list on setup; scales a built-in pack has are left out on import.

## Game 3 — Inn Co Hear Ant (`gibberish`)

Mad Gab / Incoherent-genre. Each card is a phrase of real but unrelated words that, said
aloud, sounds like something well known ("Eye Scream" → Ice Cream).

- **Setup**: player names (3+; add/remove; remembered), packs (multi-select), and behind the Rules
  card ("30 s per card · first to 5 points") seconds per card (off/20/30/45/60, default 30) and
  points to win (default 5). Add pack → New makes a pack (paste a list or ask the wizard; a pasted
  card without a category gets "Anything").
  A pencil on each pack opens the pack editor (giveaway check applies to edits); on the player's own packs, "🧙 Add more" as in Heads Down. (5–30 cards, default 10; never an answer any pack on the phone has; a card without a category takes the pack's most common one).
- **Card**: the reader rotates each card. Hand-off screen ("X reads — everyone else, eyes off the
  phone") → reader view: the phrase huge, a "Show category" button the reader may read out,
  answer hidden until press-and-hold, countdown ring. When someone shouts the answer the
  reader taps that player's name → point, answer revealed big with a chime. Time runs out or
  "Nobody" → answer revealed, no point. Skip draws a new card without penalty.
- Scoreboard between cards; first to the target wins (win screen, rematch). State saved.

Community: wizard packs and Add more are shared; "🌍 Community" is in Add pack under the pack list on setup; answers a built-in pack has are left out on import.

## Game 4 — Big Board (`quiz`)

A team quiz board for a host who reads aloud, on a phone or a laptop on the TV. Each pack is one
board: categories across and clues down, easiest at the top. Built-in packs (`src/content/quiz/*.json`)
are 3–6 categories × 3–5 clues; packs made or edited on the phone may be 1–8 × 1–10.

- **Setup**: 1–10 teams (default 3; a team may be one person), in the same list as Inn Co Hear
  Ant's players: Add team (the next unused default name, then "Team N"), tap a name to rename it
  (blank or repeated names are turned down; 18 characters at most), ✕ to remove; the head says
  "Solo" for one team, with "Play for a high score" under it. The list is remembered. Each team
  has its own colour (`--team-1` … `--team-20` in tokens.css, one set per scheme, readable as text
  and under a number badge), shown as its tile's dot with its number; colours and numbers follow
  the team's place. While a game is saved, solo stays solo (Add is off) and teams stay two or
  more (no ✕ at two); a removed team leaves with its points (tiles it won count as nobody's). One pack
  (the shared pack list, single pick; a pencil on each opens the editor; Add pack → New at the end). A "Points" card
  ("Tiles 100–500 · wrong answers cost nothing") holds points 100, 200, … per level or doubled
  and "Wrong answers lose points" (default off). A pack with an
  empty clue or answer is a draft: setup names the empty tiles and will not start it.
- **Timer** (cosmetic, never touches scores or play): a countdown chip floating over the board and
  clues: tap to start or pause, ↺ resets, the length button cycles 10/20/30/60 s, × hides it (the
  ⏱ in the board's header shows it again). A new clue resets it without starting it; at zero it
  shows "Time!" with a buzzer (if sound is on) and a light buzz. Drag it anywhere; it stays on
  screen and the phone remembers its place, length and whether it shows (shown at first).
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
  screen. Saves from the 2–4 team version load unchanged; a setup saved with a name for every seat
  and a team count loads as its first that many names.
- **Pack editor** (`#/quiz/board?id=<id>`): name, short description, levels stepper (adds or
  removes the bottom level on every category; removing one with clues asks first), category
  tabs (add up to 8, rename, move left/right, remove), and every clue and answer inline, empty
  ones highlighted. Every change saves at once; a built-in saves this phone's copy under the
  same id (Edited tag, "Restore original"); own packs can be deleted. On own packs, "🧙 Add more" asks the wizard for a new category (as tall as the others) or a harder level (one clue per category), whichever still fits 8 × 10, with an optional steer; each clue is reviewed and a dropped one stays an empty tile.
- **Make a pack** (`#/quiz/make`, Add pack → New): Blank (name, categories 1–8 × levels 1–10, default 5 × 5),
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

Community: a board Fizzwick wrote is shared when it is first saved from the editor, and again after Add more; "🌍 Community" is in Add pack under the pack list; the preview lists every category's clues and answers.

## Game 5 — Don't Say It (`taboo`)

Taboo-genre. Two teams take turns; one player describes the word on the card to their team
without saying it or any of its five banned words, while a player from the other team sits
beside them watching for slips.

- **Setup**: two team names (editable, `--c-team-a` / `--c-team-b`, default Loudmouths vs
  Mimes); behind the Rules card ("60 s turns · first to 15 points · skips are free") turn length
  45/60/90 s (default 60), play until a points target (default 15, 5–50)
  or a number of rounds (default 5; a round is one turn per team), "Skips cost a point"
  (default off); packs (the shared pack list; a pencil on each opens its editor; Add pack → New: write the
  cards one by one or ask the wizard for a theme, 10–60 cards, default 30, reviewed before saving).
  The player's own packs have "🧙 Add more" in their editor (5–40 cards, default 15). Wizard cards
  follow the pack editor's rules (exactly five banned words, none containing the word or inside
  it); a word any Don't Say It pack on the phone has is never offered; cards that fail are dropped
  unseen.
- **Turn**: hand-off ("Pick a describer… someone from the other team sits next to them") →
  the word as large as it fits (`FitText`), its five banned words under it, a clock and a bar.
  Got it +1 (chime), Skip 0 or −1, Buzz −1 (red flash, buzzer); each button ignores taps for
  400 ms after a new card. Last 10 s: a tick each second and a red pulsing clock. Leaving the app
  or the pause button stops the clock behind an opaque menu (Resume, Pause and go home, End game);
  a reload mid-turn resumes paused with the time left. Packs used up → the turn ends early,
  and the next team's hand-off offers "Play those cards again" (the game's played cards are
  dealt again) or End game.
- **Summary**: the turn's total, every card with its mark; a tap cycles a card got → skipped →
  buzzed. The card on screen when time ran out is listed as "Time's up" (0) and can be changed
  to got or buzzed (said at the buzzer). Then the scoreboard: the turn's points land on the team
  (tap to land them at once), then "Next: <team>", with "Fix <team>'s cards" to go back to the
  summary. In a tiebreak the scoreboard says "tiebreak" instead of the goal.
- **Scores** are never stored: they are the sum of every card's mark, so fixes on the summary
  just work. The game is checked only when both teams have had the same number of turns: target
  reached (or every round played) with one team ahead → win screen (confetti, rematch with the
  other team starting); level at that point → one more round each.
- Words never repeat within a game; across games each pack deals every card before reusing any
  (`lib/bag`). History: one entry per finished game, one line per turn; End game with a card
  marked records it as ended early. Demo screens: `#/taboo?demo=handoff|turn|turn-late|summary|scores|win`.
- **Packs**: `src/content/taboo/*.json` (Classic 150, Pop Culture 100, After Dark 60). Paste
  lines `Word: one, two, three, four, five` in the pack editor to add many.

Community: wizard packs and Add more are shared; "🌍 Community" is in Add pack under the pack list on setup; words a built-in pack has are left out on import.

## Game 6 — Brain Freeze (`quick`)

Name-three-under-pressure genre. Pass the phone round; whoever is up reveals a prompt and has a
few seconds to name three things that fit it out loud; the room judges.

- **Setup**: player names (2+; add/remove; remembered, and a first visit borrows Inn Co Hear
  Ant's list), packs (search/sort; a pencil on each opens its editor, where the player's own packs
  have "🧙 Add more" as in Heads Down.: 5–40 prompts, default 15, never one any pack on the phone has;
  Add pack → New: paste a list or ask the wizard), seconds on the clock 5/7/10 (default 5), points to win (default 7, 3–15),
  Steal (default on), and with Steal on "A steal uses the stealer's turn" (default off; saved
  setups and games from before it load as off).
- **Turn**: hand-off ("Pass the phone to Maya"; the last turn's result and a scoreboard strip in
  seating order above it) → "I'm Maya, show my prompt" reveals "Name 3 …" huge (`FitText`) and
  starts the clock at once: a big ring drains, a tick each second (sharper in the last two),
  buzzer at zero. "Got all 3" stops the clock early with the point. At zero the same screen
  shows "Time!" and the room taps ✓ Got 3 (+1) or ✗ Didn't. Steal on and missed: the next
  player gets the same prompt and a fresh clock and must name three *different* things for the
  point; a missed steal ends the turn with no point. The turn then passes to the next seat: the
  stealer, who then takes their own turn, or, when a steal uses the stealer's turn, the player
  after them (the steal screen says "This steal is your turn").
- **Rounds and winning**: a round is one turn per seat, counted from the seat that started (a turn
  used by a steal counts as had; `left` in `logic.ts`). Reaching the points target does not end
  the game: the round plays out, the hand-off saying so ("Maya reached 7 — the rest of the round
  still plays"). When the round ends, the one top score at or above the target wins; a tie on top
  plays another full round ("Maya and Ben are tied on 8 — a tie when the round ends plays one more round"). Players added in setup
  mid-game sit after the last seat and play in the current round only if it has not passed there
  yet; removing everyone still to play in it ends the round.
- **Undo**: the hand-off and the steal screen offer "Wrong call? Undo", which goes back to the
  judging of the last try with its point taken back (one step; gone once the next prompt is up).
- **End**: the hand-off at the end of the winning round shows "See who won" → win screen
  (confetti, standings, rematch: the seat after the one who started goes first). History gets one entry then, one detail line per turn
  ("Name 3 kinds of soup: Ben ✗, Cy stole it"); Start a new game over an unfinished one records
  it with `finished: false`. Reload mid-clock resumes paused with the time left; leaving the
  app pauses. Prompts are dealt without repeats within a game and across games (per-pack bags).
  Once every prompt of the chosen packs was played in a game, the hand-off says so and they come
  round again, shuffled, never starting with the one just played.
- **Content**: `src/content/quick/*.json`, `{"prompts": ["things you'd find in a fridge", …]}`
  stored without the "Name 3" lead-in. Built-ins: Classic (200), Pop Culture (120), After Dark (80).

Community: wizard packs and Add more are shared; "🌍 Community" is in Add pack under the pack list on setup; prompts a built-in pack has are left out on import.

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
  code always carry the host's choice to phones (`peer=cloud` for the usual one, so a phone that
  once used a backup is switched back). "Trouble connecting?" (start screen, join screen, lobby)
  does the same by hand, in plain words; while a device uses a backup that link says so.
  Broker unreachable → "Can't reach the online service that links phones to the host. Check the
  internet, or see Trouble connecting." on both sides, retrying in the background.
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
  summary, Start (3+). Settings (`#/snark/settings`, a pack page): packs (search/sort, editor,
  Make a pack or Add pack → New: paste a list or ask the wizard; "A game is running: these apply
  to the next one" under the packs row while one is), and a Rules row over Done ("3 rounds · 75 s
  to write · 15 s to vote · 3-vote final") opening rounds 2 or 3, seconds to write 45/75/90/120
  (default 75), seconds to vote 10/15/20/30 (default 15) and the final round. The wizard takes a theme (or a tap-to-use
  suggestion such as Office life or Roommates) and 10–60 prompts (default 30); each prompt comes
  with a stock answer, and about one final per five prompts comes with three house lines, all
  reviewed before saving. The player's own packs have "🧙 Add more" (5–40 prompts, default 15,
  finals likewise) and, while some prompts lack a stock answer (pasted or older packs), "🧙 Fill in
  stock answers" (up to 40 at a time). The editor shows each prompt's stock answer (editable with
  the prompt; it moves with a reworded prompt and goes with a deleted one) and lists the finals.
  Wizard lines that break the Snark rules (prompts 3–14 words, stock answers 1–8 words, finals
  starting "Three" with three house lines of 1–6 words and 40 characters) or repeat a prompt or
  final of any Snark pack on the phone are dropped unseen.
  3 rounds = round 1, round 2 (double points), final; 2 rounds = round 1, final.
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

Community: wizard packs, Add more and Fill in stock answers are shared with their stock answers and finals, and imported with them; "🌍 Community" is in Add pack under the pack list in the game settings; prompts a built-in pack has are left out on import.

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
first screen the way they came (`back()`), and that screen's Back returns to the main menu.
"Leave room" on a phone (any time, after a confirm) tells the host (`{t: 'leave'}`) before the
link closes: the player is out like a removed one (no more turns or prompts, nobody waits for
them) but may rejoin with the same code and keeps their score; a removed player may not. A
refusal or the end of the room is shown on the join screen even on a phone that came by QR code.
The join screen's name box starts with the phone's username, cut to that game's name limit (Snark
Tank 14, Word Salad 18, Doodle Brawl 20 characters); after a refused join (a name already taken,
say) it keeps what was typed, so it can be fixed. A name typed there is for that room only (kept
for rejoining it) and never changes the username.
The browser's or Android's back gesture walks the same path as Back and never lands on a closed host screen. Any message whose JSON is 15,000 UTF-8
bytes or more is sent as numbered parts (`{t: 'part', id, i, n, s}`, at most 5,000 characters
each) and reassembled before it is read; incomplete parts are dropped after 30 s. (PeerJS errors
and drops the link on a JSON message of 16,300 bytes or more.)

## Game 8 — Word Salad (`salad`)

2–8 players join a host screen by code or QR using the shared room link. Two rounds, with
one turn per player in seat order. The host chooses built-in packs in Settings (they apply to a
new room) and how long a dropped presenter is waited for: 30 s, 1 min (default), 2 min or 5 min
(applies at once; saved rooms and settings from before the choice wait 1 min).

- **Pick** (20 s): privately choose one of three secrets, including one Easy and a mix of
  categories (person, place, thing, story). One reshuffle per player each round. Picking takes
  two taps: the first selects a tile (raised, the others dimmed) and grows a "Pick this one" bar
  on it; the bar confirms, and tapping another tile moves the selection. Each selection reaches
  the host (`select`), so at the deadline the selected secret is taken for anyone who has yet to
  confirm, and the first choice for anyone who selected nothing.
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
  up. One whose phone drops during their turn holds it: the clock stops on every screen, guesses
  wait, and host and phones say who they are waiting for and for how long at most; back within
  the host's wait, the turn carries on with the time it had, else it is revealed without points. Guesses read into a comparison
  clue lose their closing punctuation and a capital leading article. The presenter's phone lists
  the guesses straight under the clue builder.
- **Content**: `src/content/salad/*.json` holds packs of secrets with an answer, category,
  difficulty, accepted variants and fitting words for the sentence slots in `words.ts`.
- **Demos**: use `#/salad/host?demo=present` or `#/salad/join?demo=guess`. Both accept
  `lobby`, `pick`, `prepare`, `present`, `reveal`, `unsolved`, `scores`, `over` and
  `paused`. The phone also has `join`, `late`, `picking` (a tile selected), `wait`, `comparison`
  and `guess` views.

## Game 9 — Doodle Brawl (`brawl`)

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
  Screens say that a tied vote goes to the challenger, mark each artist's own card "Yours", and
  explain the +500 on the keep-or-tag screen. Players who join after a round's drawings are
  handed out are shown as drawing next round (or voting, in round 2).
- Highest total wins; ties share first. End screen: standings and each bout winner's fighter.
- **Drawing**: square canvas, 640 × 640 units, Pointer Events, scrolling locked; 8 colours,
  thin/thick pen, undo, clear ("Undo clear" brings a cleared drawing back until the next stroke);
  on a short phone the canvas shrinks so the name and Submit stay on screen. Stored as strokes `{c: colour, w: width, p: [x0, y0, dx1, dy1, …]}`
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
  the room; its back arrow leaves the room open (the start screen offers "Back to room CODE").
  The lobby supports removing players, choosing packs and changing brokers. Reconnects
  and History work as in Snark Tank. Classic has 120 titles and After Dark has 60.
- Demos at `#/brawl/host?demo=` and `#/brawl/join?demo=` with
  `lobby|lobby-empty|draw|challenge|title|vote|payout|tag|rematch|scores|over|paused`.
  Phone demos also have `join|wait|late|voted|watching|tagged`.
