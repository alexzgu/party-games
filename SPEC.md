# Party Box — specification

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
(`#/forehead`, `#/dial`, `#/gibberish`, `#/quiz`, `#/settings`, `#/community/<game>`, `#/join/<key>`) so any static host works.

- `src/lib/` — shared logic: `storage` (guarded localStorage), `router.svelte` (each history
  entry carries how many in-app steps lie behind it, so `back()` returns to the screen a page
  came from, also after the browser's or Android's back gesture or a reload, and never leaves the
  app; a screen leaving to the one it came from uses `back()`, never a new `go()`, or Back there
  would return to it in a loop; a game's Home button uses `backHome()`, which walks back to the
  main menu; a new screen opens at the top and Back restores the scroll it was left at; `swap()`
  changes the current entry's address in place without moving the page, for a search or a tab
  that Back and a reload should find but that is no step of its own; `back(fallback, steps)`
  leaves several entries at once, for a layer with steps of its own closing whole),
  `settings.svelte`, `players` (default names, and `reseating`: a saved game's players after
  its setup list was edited, which `PlayerList` tracks by place),
  `sound` (synthesised cues; call `unlockAudio()` in the first tap), `haptics`, `wakelock`,
  `motion` (permission, motion stream, sign fix, upright rotation), `pitch` (forehead pitch from
  gyroscope + gravity), `tilt` (gesture detector), `calibration` (practice tilts → thresholds),
  `bag` (deal without repeats across rounds and restarts), `content` (built-in + custom packs),
  `claude` (live generation, streamed line by line), `wizard` (effort → model), `wizardAsk` and `packName` (the wizard's request, the name he suggests and its fallback, the description), `wizardServer` (the magic words), `invite` and `join` (invite links), `history` (finished rounds and games),
  `paste` (reading pasted lists), `packfile` (pack files: export, import), `menu` (a menu's keys and which way it opens), `gamePicker` (the drop-down's search, and when it focuses its field), `panel` (whether a pack page's players or teams, a pack editor's details or a Community list's search and filters start shown, each kind with its own remembered choice; which edges of a part scrolling on its own have more behind them; bringing an item into view in its list), `keepScroll` (the scroll of a page's parts scrolling on their own, kept for Back), `library` (the Community library), `communityView` (where the Community packs stand, kept in the address: search, order, filters, the open pack, the page's game; the note after an import), `communityCache` (the Community lists already loaded, kept until Community is opened anew), `communityMarks` (the Community packs this phone skips), `communityPages` (loading pages until enough fit the filters), `shareLog` (what the Community library took of each pack, and which are being sent), `username` and `usernameShape` (this phone's username; the rules for one, shared with the wizard server), `packList` (search, picks and counts for the shared pack list), `share` (share sheet or download), `gamesView` (the Games page's rules: default categories, the orders, the categories box's label, own category names, reading the stored choices defensively) and `gamesPage.svelte` (those choices on this phone), `update` (new versions switch in on the main menu or the Games page, held back while the category editor is open), `random`, `ink` (drawings: strokes, limits, inks, painting; Doodle Brawl and Sketchy), `cards/` (a 52-card deck and a hand's layout; see Playing cards).
- `src/components/` — `Screen` (page frame: back button and title pinned at the top, actions pinned at the bottom), `PinnedPanel` (a page body where one part scrolls: a pinned top that folds away, a pinned row with the fold's button, the scroller with its edge hairlines, an optional pinned foot; used by `PackList`, every pack editor and the Community list), `PackList` (every pack game's pack page: pinned players or teams and packs row, the scrolling packs, the Add pack row), `ScrollWindow` (rows that grow, in a window scrolling on its own with fading edges), `GameCard` (one large row opening a page: a game, or the main menu's Games and Community packs), `CategoryEditor` (making or changing one of the Games page's own categories), `Dropdown` (the searchable drop-down box), `GamePicker` (its pick-one face choosing a game: the Community page, History), `CategoryMenu` (its pick-several face for the Games page's categories), `Popup`, `MenuButton` (a button opening a small menu),
  `HowTo` (the "?" header button that opens a game's rules), `RulesCard` (a setup's settings
  behind one row), `Button`,
  `FitText` (text as large as its box allows), `Stepper`, `Toggle`, `Triage` (review generated
  items while they stream in), `WizardEffort` (how hard Fizzwick tries, on every make page), `WizardRequest` (the box where the player tells Fizzwick what they want), `PackNameField` (a wizard pack's name on its review screen), `WizardNote` (the line that Fizzwick can be wrong, over his results), `PackFile` (the row under every pack list: Add pack — New, Community, Import — and Export),
  `ExportPack` (Export), `Community` and `CommunityItems` (browse, preview, import and star
  Community packs, over a pack list or on the Community page), `ShareNote` (the note a failed Community share leaves), `UsernameField` (Settings' username box), `draw/Canvas` (the drawing pad: colours, pens, optional eraser, undo, clear) and `draw/InkCard` (a drawing shown), `cards/PlayingCard` and `cards/CardFan` (see Playing cards).
- `src/pages/` — the pages that are not a game: `Home`, `Games`, `Settings`, `History`, `CommunityPage`
  (the Community packs, a game at a time), `Joined` (an invite link) and `Crashed`.
- `src/styles/tokens.css` — every colour, radius, spacing and duration. Each game sets `--accent`
  to its colour token (`--c-forehead`, `--c-dial`, `--c-gibberish`, `--c-quiz`, … `--c-fish`). Playing cards
  have their own (`--card-face`, `--card-red`, `--card-black`, `--card-edge`, `--card-back`, `--card-back-2`,
  `--card-w-sm|md|lg`), the same in both schemes.
- `src/games/<id>/` — one folder per game; `Game.svelte` is the entry the router loads.
- `src/content/` — built-in packs as JSON (formats in `src/lib/content.ts`).

## Making new packs

Three routes, in the order the owner chose to rely on them:

1. **A Claude Code chat** (uses the owner's subscription): someone asks a chat for a pack; it
   writes `src/content/<game>/<id>.json`, passes the content gate (`src/lib/content.test.ts`),
   commits and pushes; the site rebuilds in 1–2 minutes. Steps: "Making a new pack" in
   AGENTS.md, or `/make-pack`.
2. **Paste a list** on the phone: each game's "Make a pack" screen (Add pack → New under the
   pack list) takes a pasted list (one item per line, in the game's format) and saves it as a
   custom pack on that phone. Its button says what comes next: "Review words" (cards, prompts,
   clues) where a review follows (`Triage`; Big Board: the editor), "Save these" where the
   list is saved at once (Snark Tank, Doodle Brawl, Bad Hand, Sketchy, Would You Rather, Smarty Pants).
3. **Ask the wizard in the app**, first way in, the host's own testing route (no screen mentions
   invite links; players are told only about the magic words, route 4): players see live generation as
   "Fizzwick the Wizard" 🧙; no screen names Claude, Anthropic or an API key. The host (the owner,
   who pays for usage) sends friends a link `<site>#/join/<key>` carrying an Anthropic key; the
   key is never in the repo or the bundle. Opening it (`src/lib/join.ts`, `invite.ts`) stores
   the key in `settings.apiKey` (that phone's localStorage), wipes it from the address bar and
   history at once (`replaceState` to `#/`), and says "Fizzwick the Wizard has moved in on this
   phone."; a link whose key does not look like an Anthropic key (`sk-ant-`, 20–300 of
   `[A-Za-z0-9_-]`) says it is broken and stores nothing. The phone calls the API directly.
   Each make page shows "How hard Fizzwick tries" (`WizardEffort`) next to the request and the
   make button, when the phone has a key: 🥱 Half-asleep (Haiku 5.5), ☕ Had his coffee (Sonnet
   5.5), 🔮 Full beard power (Opus 5.5, the default), kept in `settings.model`; an unknown stored
   id uses Opus. Without a key or pass the magic-words box (`MagicWords`) appears wherever the
   wizard is wanted: Settings and in place of the wizard's form on every make page.
   `streamLines()` hands each line over as soon as it is complete; items stream into `Triage`;
   "More" sends the items already kept so the wizard avoids repeats.
   **Asking and naming** (every game with the wizard, present and future; `src/lib/wizardAsk.ts`,
   `WizardRequest`, `PackNameField`, `packName.svelte.ts`): the player tells Fizzwick what they want
   in their own words, never a title: one box labelled "Tell Fizzwick what you want", three lines
   that grow, at most 300 characters (a quiet "N characters left" only in the last 60), Enter adds
   a line and the make button starts him, with a placeholder per game showing a descriptive request
   ("e.g. French pastries you'd find in a Paris bakery, nothing too obscure"); nothing on that form
   calls it a theme, topic, title or name. The prompt carries the whole request ("The player asks
   for: …"). The pack's name is its own "Pack name" field on the review screen (Big Board: the
   board's name in its editor). Fizzwick suggests it in the same reply, no extra request: the
   prompt asks him to start with one line "Name: …", the only exception to the game's output
   rules. Only the reply's first line can be the name, and only with a colon after "Name" or
   "Pack name" and a good name in it (1–4 words, at most 40 characters, a letter, no commas or
   bars), put in Title Case; that line is lifted out and never shown or kept as an item. Any other
   first line, and every later line whatever it looks like ("Name-Brand Snacks", a card for the
   word "Name"), goes to the game's own reader as usual. Every review of Fizzwick's pack starts
   with a name in the field: until his comes, or when it is missing or bad, a short name from the
   request's first clause (an empty opening such as "Make me a pack about" and a narrowing clause
   such as "…you'd find in" left out, at most 4 words and 40 characters), else the game's default
   name. A typed name belongs to the pack on screen: "More" and "Try again" never replace it, but a
   run started another way (paste, by hand, wizard) or with other words is a new pack and forgets
   it; "More" asks for a name only while none has been typed or suggested; going back to the
   request forgets an untyped name. Adding to an existing pack asks for no name. In Big Board the
   name arriving alone updates the board in the making silently (only a clue ticks). The description
   is "Conjured by Fizzwick: " and the request, cut at a whole word with "…" to 80 characters in
   all (the board editor's limit, inside the library's 60 for names and 140 for descriptions).
   Fizzwick writes from memory and nobody checks his facts, so wherever items he wrote are on
   screen (the review of a pack he just made, its "Add more" results, and in Big Board the board
   as he writes it and the new board's editor until it is saved), one quiet line (`WizardNote`)
   says "Fizzwick writes from memory and can get things wrong. Check anything that matters
   before you play." with a small "Got it" ("Don't show this again"). It never shows on the
   request form, on a pasted or typed list, or in a saved pack's editor. "Got it" hides it at
   once and for good on this phone, in every game, present and future (one flag,
   `settings.wizardNoteSeen`); when storage is blocked the note simply keeps showing.
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

**A game plays only the packs the player ticked** (every game, present and future; shared steps
in `src/lib/lend.ts`, the question in `LendAsk`). No item from a pack the player did not tick is
dealt, shown, suggested or played by a bot without asking first. A pick whose packs have all been
deleted becomes the game's default pick (Classic, or that game's own default), shown on screen as
the pick, never every pack (a setup screen ticks it; a room's lobby names it). A game that needs
a certain number of items for a whole game works out, in one function per game, what it deals
from, how many the room needs, what is short and which packs would lend; Start, the lobby or setup
line, the settings note and the question all read that one answer. When the picks fall short,
Start does not start: a popup titled "Not enough cards" (the game's own word) says what is short
("Your packs have 40 answer cards. 6 players need 100.") and asks "Add cards from Classic for this
game?". Packs lend whole, in pack order (built-ins as shipped, Classic first, then the player's
own), only as many as reach the count, and only the kind that is short. "Add & start" starts with
them; "Change packs" goes to where the packs are picked; closing does neither. The popup opens
only from Start. In a room it stays while the question stays the same (a player joining only
updates its numbers); once the question goes away or changes it closes for good, and only Start
asks again; the room keeps the yes while the question stays the same (same picks, same lenders
lending the same kinds of item: a yes to words is never a yes to ideas from the same packs),
never into another room or after the host screen reloads. A one-phone game has no room: a yes
lasts for that game only, and Rematch asks again. While the picks fall short the lobby's pack line
adds "(too few cards for this room)", and "(+ cards from Classic)" after the yes; the settings or
setup note says what is short and that the game will ask before adding from the packs it names.
History names the lending packs with the picked ones. Nothing else ever adds items: a game that
runs short mid-game (more late joiners than counted) deals its own items again.

**Import and export** (`src/lib/packfile.ts`, buttons in `PackFile` and `ExportPack`): a pack file
is JSON, `{"jerkBox": 1, "game": "<game id>", "packs": [...]}` (`jerkBox` is the format's fixed
marker from the app's first name, kept so every phone reads every file), each pack as stored (id, name,
icon (`emoji`, any one character) for Heads Down., blurb, items) without `custom` and `added`; named
`<game>-<pack id or my-packs>.partybox.txt` (JSON inside, plain-text type so Chrome on Android
can share it; import also takes `.json`). "Export" sits in every pack editor (built-ins
included); Add pack → "Import" (packs from a file) and "Export" (every pack made or edited on this
phone; hidden when there are none) sit in the row under every game's pack list (the
setup's; Snark Tank's, Doodle Brawl's, Sketchy's, Bad Hand's, Would You Rather's and Smarty Pants's in their room settings). Export uses the
share sheet when the browser can share the file, else a download. Import reads a file of at most
1 MB and up to 100 packs of up to 1,000 items; checks each item with that game's own rules (the
pack editor's or the paste route's; Big Board: 1–8 categories × 1–10 clues, cut and padded like a
pasted board); drops what fails and says how many; leaves out a pack with nothing usable; and
saves each pack as the player's own, ticked on its own in place of the packs ticked before (Big Board: picked), under a fresh id (`-2`, `-3`, …)
when a built-in or a pack on the phone already has its id, so nothing is overwritten, and a fresh
name ("Movies (2)") when one already has its name. A pack just made is likewise played on its own. A file of
another game says which game to open; one of a game taken out of the app (`RETIRED_GAMES` in
`src/app.config.ts`) says so by name, even when it is too big to read ("Earworm is no longer in
Party Box."); anything else says it isn't a pack file.

**Community library** (`src/lib/library.ts`; server routes `/library/…` in `worker/`, see
`worker/README.md`): packs Fizzwick makes on any phone with a magic-words pass are shared
automatically, whole, the moment they are saved, and again after "🧙 Add more" (Snark Tank: also
"Stock answers"), so friends need not remember to. Only what the wizard wrote through a
pass is shared by itself (decided as each run starts): anything made with the host's own key or an
invite link never is, even once the phone has a pass, nor is a built-in pack or its edit. Each own
pack keeps that decision with it: it is marked for sharing when a wizard run through a pass made it
(a Big Board draft keeps the mark when saved) or when it is shared by hand (below), and loses the
mark once a run not through a pass adds to it; one that started pasted, typed by hand or imported
has no mark until it is shared by hand. A pack is shared by itself only while it has the mark and
the run that just added to it went through a pass; hand edits keep the mark. Pack files never
carry it. The same pass and pack update one entry. Sharing never holds up saving; when it fails
the page shows a small note, "Couldn't share to the library", with what to fix when the phone
itself refuses the pack. Each wizard form says once, in
small text, "Packs Fizzwick makes are shared in the Community library." Shared packs stay for
good (the owner can hide one).
**Sharing by hand** (`SharePack`, `canShare`, `shareStatus`, `shareProblem`): every pack editor of
a game with the library shows "Share" beside "Export" for the phone's own saved
packs (pasted, typed by hand, imported from a file or made by Fizzwick), never for a built-in pack
or its edit, nor for a pack imported from the Community library (marked `fromLibrary` when
imported; packs imported before the mark existed cannot be told apart). The first share of a pack
asks once, in place: "Anyone can see and import it. Your username, <name>, shows on it." with
"Share it" and "Cancel". Without a pass, the magic words box opens right there ("Sharing needs the
magic words. Say the ones the host told you:", with "Not now") and the share goes ahead once they
are said; a phone on the host's own key is told sharing needs the magic words. A pack the library
would not take is a disabled button with the reason under it: no name, a Big Board with empty
tiles ("Fill the 3 empty tiles first."), Snark Tank finals an import would leave out (every one
named, with why: `readFinals` in `snark/finals.ts`, the rule an import reads them by), nothing in it, more than 400 items in one list
(Bad Hand and Sketchy have two) or over 64 KB (the server's own limits, `libraryShape.ts`). For Doodle Brawl, Bad Hand, Sketchy, Would You Rather and Smarty Pants the
editor refuses to add a 401st item to a list, and a long paste, Fizzwick's items or a pack file that
would make a list longer is saved as two or more packs ("Mine", "Mine (2)"), its lists shared out
evenly and every mark kept. A pack saved longer than that earlier shows "Split" in its editor,
which does the same; nothing is split until it is tapped. (An edit of a built-in pack is never
shared, so it may stay longer.) The server takes such a pack only whole: every item one the game
itself takes, none twice, and stored as checked; the phone sends no pack the library would cut
anything from (Snark Tank's stock answers and finals included). A fetched pack is read once, as an
import reads it: the preview shows exactly what Import saves and says how much it leaves out, under
the name it is saved under ("Saves as “Movies (2)”." when it is not its own; every part's for a pack saved as several), worked
out by the naming Import uses (`savedNames`) and again when the packs on the phone may have changed.
Working it out only reads: an own pack whose id a new built-in takes shows under its new id at once,
and the move is stored as the app starts and before each save (`settle` in `content.ts`).
An editor open in two tabs saves no old copy over a newer one: it shows the newer and asks again.
Snark Tank's puts each change on the pack as saved by then (`snark/edits.ts`): a prompt or final
changed or deleted elsewhere, a deleted pack or a full phone saves nothing, and the form stays open
with what was typed and says why.
A refused share says why in plain words (`failureWords`:
offline, pass ran out (the box comes back), today's sharing limit, too big, server trouble). What
goes, and what the button compares, is always the pack as saved on the phone (each editor saves on
every change), never the editor's own copy. Once the library takes it, the saved pack is marked
shared in place, nothing else in it changed (a pack deleted meanwhile stays deleted), so it then
behaves like a shared wizard pack; the button is a quiet "✓ Shared in Community", and after any
change it reads "Share changes", under "Shared in Community · changed since". The phone keeps, for
each pack the library took, a fingerprint of the version it took and the id the library knows it
by (`shareLog.svelte.ts`, noted on every share that lands, Fizzwick's included; a pack moved off a
new built-in's id keeps both, so its next share updates the same entry; a deleted pack's record goes). A pack marked for
sharing with no such record (Fizzwick's automatic share failed, or it was shared before records
were kept) says "This phone has no record of sharing it." over "Share now", asking nothing
first; while any share of the pack is on its way the button reads "Sharing…" and waits. The
editor's status line says "shared in the Community library: edits go out when you tap Share
changes or Fizzwick adds to it".
Each share (and each update) carries the phone's username at that moment; the server keeps it only
when it is a username by the same rules as the phone's (tidied, 1–24 characters) and otherwise
stores the pack without one. Packs shared before usernames have none.
Add pack → "🌍 Community" (beside "Import" in that menu) opens the Community packs over the pack list (the
address gains `?community=1`, so Back closes it; the Community page from the main menu, under Shared
behaviour, is the same browser with a game picker): a search of pack names and descriptions only
(not the items, nor usernames), Most stars (then newest) or Newest, 30 at a time with "Show more"; each row
shows name, description, item count and ★ stars, and the sharer's username as a small, quiet
chip beside the count (nothing for a pack without one; no "made by" wording), then a small
"Owned" or "Skipped" chip when it is; the preview shows the
username chip under its count. Tapping a pack shows everything in it (Snark
Tank: with its stock answers and finals; Bad Hand: prompts, then answers; Sketchy: words, then
ideas; Brain Freeze and Would You Rather: each item after a dim "Name 3" or "Would you rather"; Smarty Pants: each question after its
category, dim, never the answers). Everything fetched is rebuilt from each game's own
fields first (`src/lib/libraryShape.ts`, the same rules the server stores by).
"Import" saves it through the pack-file import above (same checks, fresh id and name, ticked on
its own) and leaves out items a built-in pack already has in games whose items must be new
across packs (Spectrum, Inn Co Hear Ant, Brain Freeze, Don't Say It, Snark Tank, Doodle Brawl,
Sketchy, Bad Hand, Would You Rather, Smarty Pants).
Two filters under the order choose among the packs, each on its own (`cown`, `cskip` in the
address): Owned (All, the default; Owned; Not owned) and Skipped (All; Skipped; Not skipped, the
default). "Skip" in a preview leaves the pack out on this phone and returns to the list; "Unskip"
takes that back. A pack is owned while one of this phone's own packs was imported from it (each
carries the Community id it came from, `communityId`, saved with it and on every part of a split
one; pack files and shares never carry it) or was shared as it (the share record keeps the id the
library answered with, and goes when the pack is deleted): `ownedIds` in `library.ts`. Packs
imported or last shared before those ids were kept read as not owned. Skips stay on the phone, one
storage key per pack (`src/lib/communityMarks.svelte.ts`); skipping on a full phone says so. The server knows
nothing of the filters: the phone chooses among its pages of 30 (`src/lib/communityPages.ts`), and
a press (opening, a search, order or game, a filter, "Show more") that shows fewer than 10 packs
that fit loads the next pages by itself, at most 4 a press and never past page 100. "Show more"
stays while the server has more, with "None of the packs loaded so far fit these filters." when
none do.
Browsing and importing are open to anyone; starring (one star per pass per pack, tap again to take it back)
needs the magic words, and without them the star is a hint that opens the magic words box; a
pass the server refuses (expired, or the words changed) is forgotten and the box comes back.
Loading, empty, offline and server-trouble states are said in plain words. Without a wizard
server (`WIZARD_SERVER` empty) there is no Community entry.
The search, the order, the filters and the open preview live in the address (`cq`, `csort`, `cown`, `cskip`, `cpack`;
`src/lib/communityView.ts`), so a reload finds them. Typing reaches the address once it stops, and
a new search, order or filter changes the address in place, adding no step. Opening a pack is a step of its
own (it starts at its top), so phone Back from a preview returns to the list, scrolled where it was.
Every list loaded, "Show more" pages included, is kept unfiltered by game, search and order
(`src/lib/communityCache.ts`, in memory and the tab's session storage) from opening Community until
it is opened anew from the main menu or Add pack, so a list comes back at once, tall enough for its
scroll; starring updates the kept lists. Over a pack list, "Import" closes Community whole (from a
preview, past its list too) and ticks the new pack, as before.

## Shared behaviour

- **Home** (`#/`): the pinned header (🎲 Party Box, History, Settings), then two large rows of the
  same look: "🎉 Games" ("15 party games", the number in `GAMES`) opens the Games page, and, while
  the Community library is on, "🌍 Community packs" ("Browse packs friends made") opens the
  Community page with fresh lists. Without it, the Games row stands alone. Install help at the foot.
- **Games page** (`#/games`, `src/pages/Games.svelte`; Back returns to Home): every game in `GAMES`
  as a large row (emoji, name in its colour, player count; no blurbs). Above them: the order
  (Default, the order of `GAMES`; A–Z; Recent, the games last opened from this page first and the
  never-opened ones after in default order, as they stood when the page was opened from the main
  menu, so opening a game never moves the list and Back from it finds the list as it was left),
  then, pinned under the header, the categories box: the drop-down (see Drop-down below) in its
  pick-several face. Closed it reads "All categories" (none picked), the one picked, or the first
  picked "+ N" ("Teams + 2"); while anything is picked it is tinted with the accent and holds a ✕
  ("Clear") that unpicks them all without opening it. Open: "Search categories", then every
  category with its number of games (a ✓ when picked): the default categories (the `tags` in
  `GAME_TAGS` order: One phone, Own phones, Teams, Words, Drawing, Trivia, Cards, Funny; one no game is in
  is left out), then the phone's own, each tagged "yours" with a pencil ("Edit <name>"); under the
  list New and Done. Tapping a category picks or unpicks it and the menu stays open, the games
  behind changing at once; with several picked a game must be in every one ("No categories
  match." when a search leaves none). Nothing fitting shows "No games fit." and "Clear", which
  unpicks the categories. New, or a pencil, opens the category editor over the open menu: a name
  (1–20 characters, not any category's name nor "All", ignoring case, refused in plain words), a
  switch per game, Save and Cancel, and for one being edited Delete (asked in a popup over it); a
  phone holds at most 20. Closing it leaves the menu open with the change in it and focus back on
  what opened it, or on the search field when that is gone. A new app version waits while the
  editor is open and switches in once it closes. The order, the picks, the own categories and when
  each game was last opened stay on this phone only
  (`src/lib/gamesView.ts`), never in the address; anything broken in storage is dropped, and an own category whose name
  a default category has since taken keeps its games under a free name ("Cards 2"). A game's
  first screen's Back returns here; its Home buttons (`backHome()`) still walk back to the main
  menu.
- **Community page** (`#/community/<game>`, `src/pages/CommunityPage.svelte`): the Community packs
  browser of the pack lists (see Community library) with the game chosen in the game picker (see
  below) pinned under the header, its options the games in `LIBRARY_GAMES`, in that order. The page
  and its glow take the chosen game's colour. Choosing a game changes the address in place, keeps
  the search and order,
  and starts that game's list from its top, so Back from the page always returns to the main menu.
  The list screen (here and over a pack list) is built like the pack pages (`PinnedPanel`): pinned
  under the header the game picker (on this page), then the search, the order and the Owned and Skipped filters,
  which fold away, then a "Packs" row with the fold's button ("Filters" with an arrow, spoken
  "Hide search and filters" or "Show search and filters"); only the packs, their states and "Show
  more" scroll. While folded with a search or a filter other than the default (Owned: All;
  Skipped: Not skipped) the button reads "Filters on" in the accent. The fold has its own remembered choice,
  apart from the setups' and the pack editors', with the same start (shown on a screen 700 px tall
  or more). Leaving for a preview and coming Back finds the packs scrolled where they were.
  Opened from the main menu it starts on the first game with fresh lists. "Import" in a preview
  saves the pack in that game's packs (not ticked) and returns to the list exactly as it was left
  (same game, search, order, loaded pages and scroll), with a note pinned at the bottom,
  "“<name>” added to your packs in <game>." (plus anything skipped or left out), until the next
  search, order, game or preview, or its ✕. Without a wizard server the address shows Home.
  Any other address, such as one of a game taken out of the app (`#/song`), shows Home.
- **Settings**: Feel (sound, vibration; switching either on plays a sample chime or buzz), Look (colours; pack lists as Tiles or List, the same choice as the switch on every pack list), Heads Down. (scored-word feedback,
  "Calibrate tilt" with the calibration note under it, "Check tilt" with its notes under it),
  The wizard, Cards (allow repeats), and App (refresh the offline cache and reload).
  The wizard never mentions invite links. Without a key
  or pass: "Fizzwick the Wizard is not on this phone yet. Say the magic words the host told
  you:", a hidden field with Show (no autofill) and "Say them", answered "Fizzwick heard you.
  He's yours on this phone.", "Fizzwick doesn't know those words." or, after too many guesses,
  how long to wait. A whole invite link or a bare key typed there is stored as the phone's key
  (`keyFromTyped`, for the host's testing; an iPhone Home Screen app keeps its own storage, so a
  tapped link may not reach it). With either: "Fizzwick the Wizard lives on this phone" and
  "Remove wizard" (clears both). No key field and no model list. Descriptions are
  --text-dim, weight 600.
  Games page: a game name over 13 characters is one size down (min(1.32rem, 6vw)) to stay on one line.
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
  main menu's header (🎲 Party Box, History, Settings) likewise. A screen's actions (a setup's rules
  row and Start) stay at the bottom; they sit in the page's flow, so at the end of the page they
  cover nothing. A phone on its side (height ≤ 500 px) also shrinks the screen header to 48 px and
  puts the rules row and the start buttons side by side. Whatever the page scrolls to (a new row, a
  focused field) stops clear of the pinned header and actions (`src/lib/scrollPadding.ts`). The
  page's glow is one layer fixed to the screen, and each pinned bar paints the same glow placed
  where it sits, so the bars match the page on iPhones too.
- **Pack pages** (every setup with packs, and the room settings of Snark Tank, Doodle Brawl, Sketchy, Bad Hand, Would You Rather and Smarty Pants; `Screen` with `fill`,
  `PackList`): the page fits the screen and only the packs scroll. Above them, pinned under the
  header, stay any notice (a compact "Game in progress" card with the leading scores, Big Board's
  draft warning, the room games' "A game is running", Sketchy's mode), the players or teams, and the packs row
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
    before). Heads Down. and the room games have nothing above their packs row and no button.
  - **Players and teams that grow** (Inn Co Hear Ant and Brain Freeze players, Big Board
    teams; one list, `PlayerList`: two tiles a row, tap a name to rename it in place, ✕ removes,
    the count and "need N+" in its head) show in a window about three rows tall that scrolls on
    its own, with Add player (Big Board: Add team) always in view outside it. Its top and bottom edges fade out,
    each only while there is more to scroll that way; a name scrolled to or being typed stops
    clear of the fades. Adding a player (or a team) scrolls the window to the new row. A shorter
    screen shows fewer rows (down to one), and if it shrinks while a name is being typed, that
    name stays in view. Spectrum and Don't Say It's two team names need no window.
- **Pack editors** (every game's pack page for one pack; `Screen` with `fill`, `PinnedPanel`, the
  same layout as the pack pages): the page fits the screen and only the items scroll (words,
  cards, prompts; Big Board: the open category). Above them, pinned under the header: the pack's
  details (Community note, status, name, Export, Share, the add form, Restore or Delete where the
  editor had them there), which fold away, then the items row (title and count, search, sort, the
  open search bar or sort chips, and at its end "Details" with an arrow, spoken "Hide pack
  details" or "Show pack details"). The actions stay pinned at the bottom as before (Add more,
  Restore original, Delete, Paste, + Card, Done). The same hairlines mark the items'
  top and bottom edges while more is scrolled away that way, and the items keep the same least
  height before the whole screen scrolls. Folding works as on the pack pages (smooth, `inert`
  while folded, first 400 ms of taps ignored, read once when the page opens so a keyboard never
  folds it), with its own choice, one for every editor, kept apart from the setups'; until the
  phone has made one, the details start shown on a screen 700 px tall or more and folded on a
  shorter one. While a pack has no items yet (Spectrum, Don't Say It) or a Heads Down. pack is
  new, the details show whatever was chosen, with no button, so the add form is there; they stay
  shown for this visit. Shown, the details take at most 45% of the screen's height and scroll on
  their own past that (a long add form), their edges fading where there is more; not while they
  are needed. An item opened for editing in place (Spectrum, Don't Say It) and an item just added
  scroll into view in the list; a field being typed in stays in view if the screen shrinks.
  Leaving and coming Back finds the items scrolled where they were. Per game:
  - Spectrum, Don't Say It: details hold name, status, Export, Share and the add form (Don't Say
    It: its Paste many and Add more too); Don't Say It keeps "Restore" or "Delete pack" after the last card, unpinned.
  - Inn Co Hear Ant, Brain Freeze, Snark Tank: details hold the status line with its small
    Restore or Delete button, Export, Share, name (Snark Tank: Stock answers too);
    Snark Tank's finals follow its prompts in the list.
  - Doodle Brawl, Bad Hand, Sketchy, Would You Rather, Smarty Pants (`ListPackEditor`, one shared editor): details hold the
    status line with its small Restore or Delete button, Export, Share and name; the list shows
    each of the pack's lists in turn under its own count (Bad Hand: prompts, then answers;
    Sketchy: words, then ideas), one search and sort over all of them. Tapping an item edits it
    in a popup (its rules said under the box; a broken or repeated one is refused in plain
    words); the add button ("+ Title", "+ Card", "+ Item", "+ Question") opens the
    same popup, with a switch for which list on a two-list pack. Own packs have "🧙 Add more".
  - Heads Down.: details hold the built-in note (with Restore), name, icon, Export, Share and
    Delete; the word box ("Type a word, press Enter", Add, and the Undo line) stays pinned under
    the Words row, never folded, since typing words in is the page's main job.
  - Big Board: details hold the status line, Export, Share, name, description and the levels
    stepper with its line; the category tabs, sideways-scrolling, are the pinned row with
    Details at its end; the open category's name, move and remove tools and its clues scroll.
    Opening another tab starts it from its top.
- **Stacking** (`--z-*` in tokens.css, lowest first): the page's pinned header and actions, things floating over everything without taking taps (confetti,
  flashes, the drag-around timer), full-screen layers (pauses, game menus, the Community packs), a
  pinned bar holding an open popup or menu, popups, the share note.
- **Tooltips** (`Tooltip.svelte`, one for the whole app): hovering a button with a mouse or pen for
  about half a second, or reaching it with the keyboard, shows what it does (its `tip`; a
  picture-only button its spoken name), over it or under it, always on screen. Never on touch; it
  takes no taps and goes on any press, Escape, scroll or when its button goes.
- **Double taps**: a button or the rules row ignores taps in its first 400 ms on screen
  (`src/lib/tapGuard.ts`), so the second tap of a double tap never presses what the next screen
  has in the same spot.
- **Pack list** (`PackList`, `src/lib/packList.ts`): the one way every pack game (Heads Down.,
  Spectrum, Inn Co Hear Ant, Big Board, Don't Say It, Brain Freeze, and the room settings of Snark
  Tank, Doodle Brawl, Sketchy, Bad Hand, Would You Rather and Smarty Pants) picks, edits, makes and shares packs. Header: "Packs"
  (Snark Tank: "Prompt packs"; Doodle Brawl: "Title packs"; Bad Hand: "Card packs"; Would You Rather
  and Smarty Pants: "Question packs") with what is
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
  imported packs on their own (Big Board: picks the first; Snark Tank, Doodle Brawl, Sketchy,
  Bad Hand, Would You Rather and Smarty Pants: adds them to the picked ones, as a made pack is). Brain Freeze's and Odd One Out's lists ignore taps in their first 400 ms (the tail of a double
  tap on the screen before). Odd One Out's list shows Heads Down.'s packs with its own picks and
  its own search and sort: no pencil, no "Make a pack" and no New; a line under the packs says
  "These are Heads Down. packs. Make and edit them there." Its Community and Import add to Heads
  Down.'s packs and tick them here, never in Heads Down.
- **A saved game and its setup**: with a game in progress, setup shows that game's players
  (Big Board: teams). Adding, renaming or removing them changes the saved game on Resume (or on
  leaving setup): a kept player keeps their score, newcomers start at 0, a removed one leaves
  with their points. Pack and rule changes apply to the next game, and setup says so. Odd One
  Out is the exception: its setup shows the remembered list, Resume keeps the saved game's
  players, and changes there apply to the next game (setup says so).
- **Drop-down** (`src/components/Dropdown.svelte`, `src/lib/gamePicker.ts`): one full-width box
  (52 px) with a down arrow; tapping it opens a panel attached under it: a search field and the
  options (a ✓ on each chosen one; long names wrap) in a list that scrolls on its own; the panel
  takes at most 60% of the screen's height and what is left under the box. Typing narrows the
  options to names holding the search anywhere, ignoring case and accents. A tap outside or Escape
  closes it, focus back on the box, and the page behind stays still meanwhile. Two faces:
  - **Game picker** (`src/components/GamePicker.svelte`, the Community page and History): pick
    one. The box shows the chosen game's emoji and name, tinted with its colour ("All games" in
    the neutral colours); the options have emoji and name, "Search games", "No games match.".
    Choosing closes it; Tab closes it too.
  - **Categories** (`src/components/CategoryMenu.svelte`, the Games page, above): pick several
    (`aria-multiselectable`). Picking keeps it open; Done under the list closes it; the pencils and
    the foot's buttons are reached with Tab.
  In both, on a touch phone the search field waits
  for a tap (so the keyboard does not cover the list); from the keyboard or with a mouse it takes
  focus at once. The box and the field are comboboxes over one listbox: the arrow keys (wrapping),
  Home and End move, Enter chooses (and, in the categories, Space from the box). On a touch phone the search field waits
  for a tap (so the keyboard does not cover the list); from the keyboard or with a mouse it takes
  focus at once. The box and the field are comboboxes over one listbox: the arrow keys (wrapping),
  Home and End move, Enter chooses.
- **History** (`#/history`): one entry per Heads Down. round (rewritten if a word is fixed
  afterwards) and per finished Spectrum or Inn Co Hear Ant game: title, scores, packs and
  details. The game picker above the list ("All games", then every game) shows one game's; open, delete one, or clear all. Stored on the phone only; entries of a
  game taken out of the app are left out.
- **Search and sort** (`ListTools`): every pack list and every pack's contents has a search
  toggle (matches names, blurbs and the items inside; a pack found only through an item shows
  `has "…"`, or `has "…" and 2 more`) and a sort toggle (Suggested, Newest, Oldest, A–Z). Each list remembers its toggles
  and order on the phone. Packs carry an `added` date; built-ins without one count as oldest.
  Ticking packs during a search still counts every picked pack.
- **Ended early**: a Heads Down. round quit from the pause menu, or a Spectrum / Inn Co Hear Ant
  game thrown away before a winner (End game; New game over a saved one) is still
  recorded, with `finished: false` and an "Ended early" tag, if anything was scored. Leaving a
  saved, resumable game is not ending it.
- **Tap to skip**: a tap finishes any animation players are waiting through (reveals, points,
  win screens); scores are applied before animations start, so skipping never changes them.
  Live play (Heads Down. countdown and round, Inn Co Hear Ant card timer) is never skippable.

Updates reach phones without interrupting play: a new version downloads in the background
(checked every minute) and switches in only on the main menu or the Games page, where phones sit
between games (`src/lib/update.ts`).

## Game 1 — Heads Down. (`forehead`)

Heads Up-style. One player holds the phone on their forehead, screen facing out; the others
shout clues; the holder tilts down for "got it", up for "pass".

- **Setup**: the shared pack list (packs with their icon, word count); tap to select one or several (mixed); the pencil opens a pack to see, edit or restore its words (`#/forehead/deck?id=…`; its "Paste" opens Make a pack on the Paste tab; the old pack screen `#/forehead/decks` now opens setup). Add pack → New ("Make a pack") offers Paste, By hand (opens an empty pack in the editor) and 🧙 Wizard.
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
  green or amber; "Screen" flashes the whole screen instead. Tap fallback always on: right half correct, left half pass. Last 10 s:
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
  25° down, 25° up, 150°/s (tilts turn at 175–1100°/s; talking, laughing, looking around and
  leaning back stay under ~105°/s; a wind-up before a fast nod down reaches ~21°).
- Quick tilts in a row: the same direction counts again as soon as the phone is back near rest
  (and 150 ms after the last score), with no pause there. On the way back the head bounces past
  rest by up to ~28°, so right after a score the other direction needs 15° more than the larger
  of its angle and 25° (40° by default). Once the phone settles (150 ms near rest, or held still
  at least halfway back from the tilt) both directions count at their plain angles. Constants in `src/lib/tilt.ts`.
- **Calibrate tilt** (`#/forehead/calibrate`, from Setup and Settings): the phone, on the
  forehead, says "Down" or "Up"; each practice tilt it catches beeps and counts (the way back
  from a tilt never counts: the next one starts only once the phone is halfway back and still).
  A tilt under 12° (too small ever to score) is not kept; the phone says "Further". Done saves
  once there are at least 3 of each; with fewer it says how many more and keeps the old
  calibration. Thresholds: 45% of the player's median tilt (12–25°; not lower, so a wind-up before a nod the other way never scores) and half their median speed
  (60–150°/s). Kept on the phone until the next calibration (a damaged stored value is clamped
  into those limits or ignored); Reset returns to the defaults.
- **Tilt lab** (`#/forehead/lab`, not linked): speaks a ~3.5-minute script of cued tilts and
  non-tilts and records every motion reading with the cue times, for designing detection from
  real data. The file goes to a laptop lab server when the page is served from one, else to
  share / download.

Community: wizard packs and Add more are shared; "🌍 Community" is in Add pack under the pack list on setup; imported words are kept even when a built-in pack has them.

## Game 2 — Spectrum (`dial`)

Wavelength-genre. Two teams. Each round one player of the active team (the reader) secretly
sees where a target sits on a scale between two opposites, gives one clue out loud, and their
team sets a dial to where they think the target is.

- **Setup**: two team names (editable), packs (multi-select; Classic ticked when every picked pack
  has been deleted), and behind the Rules card
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
- The hand-off's ⋯ menu offers Keep playing, Go home, and End game, like the menu
  on every other game screen.
- **Landscape** (a phone on its side, height ≤ 500 px): game screens put the dial on the right at
  full height and everything else, the main button included, on the left; the hand-off and win
  screens split the same way. Nothing scrolls, and turning the phone re-fits the page at once.
- Game state saved after every step; reopening resumes.
- **Cards** (`src/games/dial/deck.ts`; the shared rule is under "A game plays only the packs the
  player ticked"): a game deals only from its picked packs and never repeats a card until all of
  them are played. A game runs until a team reaches the goal, so it needs only a card: when the
  ticked packs hold none (an empty pack of the player's own), the setup's note says so, and Start
  asks "Your packs have no cards. Add cards from Classic for this game?" ("Change packs" closes the
  popup over the pack list). The yes lasts for that game only: Rematch asks again, and its "Change
  packs" goes back to the setup. Should the game's packs lose every card mid-game (a pack of the
  player's own emptied), the hand-off says "The chosen packs have no cards. Go back to setup and
  pick a pack." and its button becomes "Back to setup", which ends the game.

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
  screen and the phone remembers its place, length and whether it shows (shown at first). A double
  tap on its grip, or Enter on it, puts it back in its place under the scores.
- **Board**: fills the screen; categories across, values down; a played tile goes dim with a dot
  in the winning team's colour. Header: back to setup (game saved), Undo, full screen (wide
  screens with the Fullscreen API), "?", End. A score strip shows every team at all times:
  big boxes up to 4 teams; compact chips from 5 (phone: two rows up to 8, then one sideways row
  with the leader pinned at its start; wide: up to 10 across, then two even rows); leaders get a
  crown. Tapping a team opens a fix popup (± each board value). Tiles ignore taps for 400 ms
  after the board appears (double-tap guard).
- **Tile**: the clue full screen (FitText) with category and value → "Show answer" → the answer
  big → tap the team that got it (+value) or "Nobody" → back to the board. "Back" puts the
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
- **End**: every tile played → "Winner" (or "Undo: <the last scoring>"), or End with something scored → win screen
  (confetti, tap to skip; standings with shared places for ties; from 9 teams compact rows, two
  columns on wide screens). History gets one entry at that moment (`finished: false` when ended
  early; more than 4 teams: the title gives the top score and the team count); End with nothing
  scored just closes the board. State saved after every step; a reload resumes on the same
  screen. Saves from the 2–4 team version load unchanged; a setup saved with a name for every seat
  and a team count loads as its first that many names.
- **Pack editor** (`#/quiz/board?id=<id>`; layout under Pack editors): name, short description, levels stepper (adds or
  removes the bottom level on every category; removing one with clues asks first), category
  tabs (add up to 8, rename, move left/right, remove), and every clue and answer inline, empty
  ones highlighted. Every change saves at once; a built-in saves this phone's copy under the
  same id (Edited tag, "Restore original"); own packs can be deleted. On own packs, "🧙 Add more" asks the wizard for a new category (as tall as the others) or a harder level (one clue per category), whichever still fits 8 × 10, with an optional steer; each clue is reviewed and a dropped one stays an empty tile.
- **Make a pack** (`#/quiz/make`, Add pack → New): Blank (name, categories 1–8 × levels 1–10, default 5 × 5),
  Paste (a "# Category" line then "clue | answer" lines, easiest first; tolerant of other
  headings, list markers, tables, "Q:/A:", value columns and "Category | level | clue | answer"
  lines; short categories get empty tiles; past 8 × 10 is cut off and the skipped lines are
  counted), or 🧙 Wizard (the request, categories × levels, how hard Fizzwick tries; the model streams one line
  per clue, "Category | level | clue | answer", easiest row first, under the AGENTS.md quality
  bar, and a live preview fills tile by tile; "Stop" opens what came; a pass refused mid-preview
  shows the magic-words box under the error in place of "Try again"). Without a key it shows the
  magic-words box, and suggests asking the host for a built-in pack ("a Big Board about
  <topic>", which the owner's Claude Code chat makes). Every route opens the new
  pack in the editor, kept in storage (`quiz:new-board`) until "Save pack" (or "Save draft" with empty tiles), which picks it on setup.

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
  cards one by one or ask the wizard, 10–60 cards, default 30, reviewed before saving).
  The player's own packs have "🧙 Add more" in their editor (5–40 cards, default 15). Wizard cards
  follow the pack editor's rules (exactly five banned words, none containing the word or inside
  it); a word any Don't Say It pack on the phone has is never offered; cards that fail are dropped
  unseen.
- **Turn**: hand-off ("Pick a describer… someone from the other team sits next to them") →
  the word as large as it fits (`FitText`), its five banned words under it, a clock and a bar.
  Got it +1 (chime), Skip 0 or −1, Buzz −1 (red flash, buzzer); each button ignores taps for
  400 ms after a new card. Last 10 s: a tick each second and a red pulsing clock. Leaving the app
  or the pause button stops the clock behind an opaque menu (Resume, Go home, End game);
  a reload mid-turn resumes paused with the time left. Packs used up → the turn ends early,
  and the next team's hand-off offers "Replay cards" (the game's played cards are
  dealt again) or End game.
- **Summary**: the turn's total, every card with its mark; a tap cycles a card got → skipped →
  buzzed. The card on screen when time ran out is listed as "Time's up" (0) and can be changed
  to got or buzzed (said at the buzzer). Then the scoreboard: the turn's points land on the team
  (tap to land them at once), then "Next: <team>", with "Fix cards" to go back to the
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
  seating order above it) → "Start clock" reveals "Name 3 …" huge (`FitText`) and
  starts the clock at once: a big ring drains, a tick each second (sharper in the last two),
  buzzer at zero. "All 3" stops the clock early with the point. At zero the same screen
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
- **Undo**: the hand-off and the steal screen offer "Undo", which goes back to the
  judging of the last try with its point taken back (one step; gone once the next prompt is up).
- **End**: the hand-off at the end of the winning round shows "Winner" → win screen
  (confetti, standings, rematch: the seat after the one who started goes first). History gets one entry then, one detail line per turn
  ("Name 3 kinds of soup: Ben ✗, Cy stole it"); New game over an unfinished one records
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
  settings or a pack and come back without dropping anyone; only Close ends it.
- **Robustness**: a phone keeps an id and name in localStorage and rejoins as the same player
  with its score after a lock, reload or Wi-Fi change; half-typed answers survive a reload;
  answers and votes sent while offline are resent, never into the next game after Play again
  (messages and drafts carry which of the room's games they are for). A host reload reopens the same room (same
  peer id) and phones reconnect by themselves; a timer that ran out meanwhile gets 12 s back. A
  name already in use (see Shared room link for which names count as one) is refused; a phone that lost its storage gets its
  seat back only when the host opens it with New phone (see Shared room link). Late joiners watch until the next round (they may vote).
  A player who drops keeps their seat; unanswered prompts become "(no answer)". A kicked phone
  cannot rejoin that room. A phone that cannot find its host for about two minutes stops trying.
- **Flow**: Snark Tank → "Host" or "Join". Lobby: big code, QR code of
  `<site>#/snark/join?code=ABCD`, players with colours (✕ removes, after a confirm), settings
  summary, Start (3+). Settings (`#/snark/settings`, a pack page): packs (search/sort, editor,
  Make a pack or Add pack → New: paste a list or ask the wizard; "A game is running: these apply
  to the next one" under the packs row while one is), and a Rules row over Done ("3 rounds · 75 s
  to write · 15 s to vote · 3-vote final") opening rounds 2 or 3, seconds to write 45/75/90/120
  (default 75), seconds to vote 10/15/20/30 (default 15) and the final round. The wizard takes a request (or a tap-to-use
  suggestion such as Office life or Roommates) and 10–60 prompts (default 30); each prompt comes
  with a stock answer, and about one final per five prompts comes with three house lines, all
  reviewed before saving. The player's own packs have "🧙 Add more" (5–40 prompts, default 15,
  finals likewise) and, while some prompts lack a stock answer (pasted or older packs), "🧙 Stock answers" (up to 40 at a time). The editor shows each prompt's stock answer (editable with
  the prompt; it moves with a reworded prompt and goes with a deleted one) and, under the prompts,
  the finals: tap one to change its prompt (3–14 words, new in the pack) and the house's three lines
  (1–40 characters each) or delete it, "+ Final" for a new one.
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
  writing / End voting / Next; ignores a second tap within 0.8 s), close the room, rules. Wake Lock
  on the host and on phones while in a room.
- Demo screens: `#/snark/host?demo=lobby|lobby-empty|write|vote|reveal|vote3|reveal3|scores|over|paused|duel-write|duel-vote|duel-reveal`,
  `#/snark/join?demo=join|lobby|late|write|wait|vote|voted|vote-own|vote3|voted3|reveal|reveal3|scores|over|duel-write|duel-vote|duel-reveal`.
- **Packs**: `src/content/snark/*.json`, `{"prompts": [...]}`, 3–14 words (Classic 200, After
  Dark 80); optional `safety` and `finals`, below. A game deals only from the picked packs
  (Classic when none of them exists any more), prompts never repeating until the pool runs out
  (across games too).
- **Too few prompts or finals** (*house*, `src/games/snark/room.ts`; the shared rule is under "A
  game plays only the packs the player ticked"): a game of N players needs a prompt per player in
  each head-to-head round, round 2 sized for two late joiners, up to eight, and one prompt for a
  3-vote final: N + min(N + 2, 8) + 1 with 3 rounds (9 for three, 13 for five, 17 for eight), N + 1
  with 2. A three-line duel final instead needs a final per pair, the odd one out facing the house
  with its own, sized likewise: ⌈min(N + 2, 8) ÷ 2⌉ finals (3 for three, 4 from five), and no final
  prompt. When the picks fall short of either, Start asks: "Your packs have 6 prompts. 5 players
  need 13.", "Your packs have no finals." or both at once, "Add prompts from Classic for this
  game?" ("finals" when only finals are short; "Not enough prompts and finals" and "Add prompts and
  finals from Classic for this game?" when both are); packs lend only the kind that is short, and
  the game keeps which packs lent which kind. Should a round find no prompt left to deal at all (a
  pack emptied mid-game), the game's own prompts already dealt come round again, and a game that
  has dealt none plays the plain line "Say something funny"; with no finals left, the final is
  the one prompt for everyone. Settings shows the same note, and Done says "No pack has
  prompts" when no pack on the phone has any.
- **Bots** (see Shared room link): answer with the prompt's stock answer when sent one, else a
  short stock line or a random two-word phrase; three short lines in a three-line duel; vote at
  random (3 votes spread at random in the final).

Community: wizard packs, Add more and Stock answers are shared with their stock answers and finals, and imported with them; "🌍 Community" is in Add pack under the pack list in the game settings; prompts a built-in pack has are left out on import.

### Snark Tank: Quiplash 3 options (`snark`, on by setting)

Settings gain **Final round**: "Everyone, 3 votes" (the default; also what settings and
games saved before it load as) or "Three-line duels". Rules from Quiplash 3; amounts marked
*house* are ours (the original's are not published).

- **Suggest** (both options): in head-to-head rounds a prompt whose pack has a stock (safety)
  answer for it sends that answer with the prompt; the phone shows "Suggest", which fills the
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
  the winner screen; History gets one line per duel.
- **Fallbacks**: no finals in the chosen packs → Start asks before another pack lends some (see
  Too few prompts or finals); no pack on the phone with any finals, or fewer than 3 players left →
  the 3-vote final.
- **Content**: a Snark pack may add `"safety": {"<prompt>": "<answer>"}` and
  `"finals": [{"prompt": "...", "house": ["...", "...", "..."]}]`. Finals are dealt from the
  chosen packs and the packs lent finals, never repeating until they run out (like prompts). The content gate checks
  shapes only: safety keys are the pack's own prompts and answers 1–80 characters; final prompts
  are unique across Snark packs and never a regular prompt; exactly 3 house lines of 1–40
  characters. Pack files carry both fields when present (broken entries dropped). Classic and
  After Dark have a safety answer for every prompt and 40 / 20 finals.
- Demo screens add `duel-write`, `duel-vote`, `duel-reveal` on host and phone (the head-to-head
  demos carry stock answers; `reveal` shows one sent untouched).

## Shared room link (`src/lib/room/`)

Every own-phones game (Snark Tank, Word Salad, Doodle Brawl, Sketchy, Bad Hand, Would You Rather, Go Fish, Smarty Pants) uses one link layer: room codes,
broker choice (`?peer=`, stored under the existing `snark:broker` key so the setting carries
over), PeerJS peers, ping/timeout/redial, hello/welcome/reject/ended, the phone's outbox and the
host's one-view-per-phone sending. Each game supplies its own message reader, view builder and
logic. The host's peer id is `jerkbox-<game>-<CODE>`. Leaving the host screen (its back arrow,
ending the game or closing the room) and leaving or cancelling on a phone return to the game's
first screen the way they came (`back()`), and that screen's Back returns to the Games page.
On every host screen the button that closes the room says "Close" in every phase and asks
first ("Close the room?", with "The game ends." while one is being played); after a game "Lobby"
keeps the room and its players for another. Start asks first while any player's phone is
disconnected (`StartButton`: "2 phones are disconnected. Start anyway?", naming them), since those
players are dealt in too; the question closes when too few are left to start. In Snark Tank,
Doodle Brawl, Sketchy and Bad Hand, Start also asks before other packs lend to picks too small
for the room (see "A game plays only the packs the player ticked"; each game says what it counts).
"Leave room" on a phone (any time, after a confirm) tells the host (`{t: 'leave'}`) before the
link closes: the player is out like a removed one (no more turns or prompts, nobody waits for
them) but may rejoin with the same code and keeps their score; a removed player may not, not even
after Play again. A
refusal or the end of the room is shown on the join screen even on a phone that came by QR code.
The join screen's name box starts with the phone's username, cut to that game's name limit (Snark
Tank 14, Word Salad 18, Doodle Brawl, Sketchy, Bad Hand, Would You Rather, Go Fish and Smarty Pants 20 characters); after a refused join (a name already taken,
say) it keeps what was typed, so it can be fixed. A name typed there is for that room only (kept
for rejoining it) and never changes the username.
The browser's or Android's back gesture walks the same path as Back and never lands on a closed host screen. Any message whose JSON is 15,000 UTF-8
bytes or more is sent as numbered parts (`{t: 'part', id, i, n, s}`, at most 5,000 characters
each) and reassembled before it is read; incomplete parts are dropped after 30 s. (PeerJS errors
and drops the link on a JSON message of 16,300 bytes or more.)

A player id is 1–64 letters, digits, `_` or `-`, never a name every JavaScript object has; a phone
makes a new one for each room it joins and keeps it for that room (after leaving, a refusal, a
reload, or Play again).

**Names** (`names.ts`, the same in all eight own-phones games): two names that look the same are one
name: the same once compatibility forms (such as full-width letters) are folded, invisible
characters dropped, spaces trimmed and runs of spaces made one, and case ignored ("Sam Lee",
"sam  lee"). No two players who may still play (in the room, or gone mid-game and free to come back
by id) hold one name. A phone with a new id whose name is one already held is refused while that
player's phone is online or they are gone ("That name is already in use."; Snark Tank: "Someone
here is already called Sam. Pick another name."); with that player offline and still in the room it
asks for that player's seat, which the game's rules give it on plain http and which needs the host
where keys are checked. A Sketchy player gone before Play again comes back into the new lobby under
the name they type, refused while it is one another player holds. A saved game that already holds
one name twice keeps both players, each coming back by id or key, and a new id with that name is
matched to the first of them.

**Seat keys** (`seats.ts`; nobody can take another player's seat). Each seat has a secret key its
phone made for that room; the player id and the name never prove anything. The room has a random
id of its own (not its code) that lasts through a host reload, a broker change and Play again, and
ends when the room closes. A phone's `hello` says it can do keys (`keys: 1`); the game's join rules
then say which seat it would get, and until the steps below are done the phone is sent nothing
about the game, replaces nobody and changes nothing.

- A seat new to the game: the host sends `{t: 'enrol', room}`, the phone makes a new key, stores it
  and sends `{t: 'key', key}`, and the host records it before the welcome. A phone never answers
  `enrol` with a key it already had, and answers one per connection. It keeps the two newest keys of
  a room, so an enrolment cut short leaves the one before usable. Two phones enrolling one new
  seat: the first key in takes it, and the other is then asked for a proof like any phone.
- A seat with a key: the host sends `{t: 'prove', room, nonce}` (a new random value each time) and
  the phone answers `{t: 'proof', macs}`, for each key it keeps an HMAC-SHA256 under it of both and of the two
  certificate fingerprints of the connection (host's, phone's; each side reads them from its own
  WebRTC descriptions, never from a message), so a proof passed along by a guest in between is
  wrong; a key is never sent again. The right proof puts the phone back in its seat at once, mid-round
  too, and replaces the seat's old connection even if it still looks online, so sleep, reload, Wi-Fi
  and broker changes need no tap; nothing another phone does can hold it up. The connection replaced
  is told `{t: 'replaced'}` before it closes, with `moved: 1` when the seat went to a phone with a new
  key (the host's Yes). A page that hears it on the connection it uses now stops trying and changes
  nothing saved. Replaced by a proof of the same key (another tab of the same phone), it fills its
  screen with "This game is open in another tab." and "Play here", which rejoins from that page and
  so replaces the other in turn. Moved, it shows "This seat moved to another phone." on its join
  screen, with no way back but joining like any phone. A page that has already redialled hears
  nothing on its old connection, so it never stops itself. A proof is judged on
  the seat as it is when its check ends (if the player left a lobby meanwhile, the seat is new again).
- A page from before keys (its `hello` has no `keys`) is refused with "This page is out of date.
  Refresh the page, then join again." whenever it asks for a seat, new or not, before the game's
  join rules are asked (so also when the room is full or its name is in use), which it shows as it
  shows any refusal; so no seat is ever held without a key, and the host is never asked about a
  phone that could not show a sign. Refreshed, it is a current page: a new seat enrols, and a seat
  the game already has comes back through New phone like any phone.
- Any other phone asking for a seat the game already has (a wrong or empty proof, a seat with no
  key) gets it only through recovery. Without recovery open for that seat it is refused at
  once (`{t: 'reject', ask: 1}`) and the host keeps nothing of it: no question appears on the host
  screen and nothing piles up. The phone shows, in its own words whatever the host sends: "This phone
  can't take that seat by itself. Ask the host to tap New phone and pick your name, then join again."
- **Recovery** is started by the host, never by a phone. Every host screen's top bar has "New phone"
  (once a player is in), which lists the room's players (no bots, nobody removed); the host checks
  who is in front of them and picks that player. Their seat is then open to one new phone for a
  minute (one seat at a time: opening another closes the first), shown in a panel on the host screen
  ("Sam's seat is open to a new phone for a minute. Ask them to join now." and "The next phone to
  join is the one you'll be asked about.", with Close; the list itself says "Pick the player in
  front of you. For a minute, their seat opens to the next phone that joins."). While it is open, a
  hello whose player id has no seat of its own (the game does not know the id, and the room holds
  no key for it and never removed it) asks for that seat, whatever name it typed, even while the
  player's old phone is still connected, which a Yes then replaces like any replaced connection.
  So a brand-new player joining in that minute is asked about too; after the host's No it is told
  "The host said no. If you are new to this room, join again." and then joins as usual. A hello
  whose player id has a seat of its own is handled as with no seat open: it stays with that seat
  and proves its own key, whatever name it typed; a removed id is refused. The name typed never
  decides which seat a phone asks for. On plain http (no keys) nothing changes: the
  game's join rules alone, so typing an online player's name gets "name in use" as ever and a new
  phone is a new player. The first phone that asks for the open seat (a new id, or the seat's own id
  without a valid proof) gets a sign: the host picks one of a fixed list
  of at least 40 pictures, each an emoji and its plain word (`SIGNS`, e.g. 🐙 Octopus), at random
  (crypto where there is one) for that request, never the one the room's previous request got, and
  sends `{t: 'sign', i}` (its place in the list) to that connection alone. The phone shows a sign
  only from that list (anything else is ignored), filling its whole screen with the emoji, large
  (its word as its accessible label), the word under it, "Show this screen to the host" and Cancel,
  and nothing from the other end (`SeatWait`). It shows it until it is welcomed or refused, Cancel,
  a redial, or its link going (closed, or silent for `LINK_TIMEOUT`); a sign left on a slow phone
  from an earlier request never matches the next one. The panel shows the same emoji and word: "A
  phone asks for Sam's seat. Does Sam's phone show this?" and "If it shows something else, or you
  can't see it, tap No." (Yes / No). No numbers appear anywhere in the check. Yes is for that one
  connection: the phone enrols a new key, which becomes the seat's only key, and it is welcomed. At most one Yes waits to be used in a room: if that
  connection drops before then, or the host opens New phone again, removes the player or the room
  moves, the Yes is gone, the phone is refused, and a key it sends later changes nothing. Recovery closes without giving the seat to anyone, with a note on the host screen
  (OK puts it away), when a second connection asks for the seat while it is open (both are refused:
  "Another phone asked for that seat too. Ask the host to try again."), when the asking phone
  disconnects, or when the minute runs out; and with no note on No, Close, or a new code. A phone
  proving the key meanwhile is let in as usual and recovery stays open. The 10 s limit on joining
  stands still while the host is asked.
- A connection is given one seat, once. Leaving, removal and replacement stop the host listening to
  it at once. Only an empty lobby moves (its code is taken on the broker), and it becomes a room
  of its own, with a new id and an empty record before its game is saved under the new code; every
  phone still joining then asks again. Removal drops the key and blocks the player id for the life
  of the room, across reload and Play again; a player who left keeps their key and may return,
  unless the game dropped their row (a lobby does), which drops the key too, so the record cannot grow
  without end. A connection that has said hello and has no seat yet is closed after the 10 s limit
  on joining (unless the host is being asked about it); there is no other limit on them.
- The host keeps the room's id, the keys and who was removed in one record per game
  (`<game>:seats`), outside the game, cleared when the room closes and before each write, so a write
  that fails leaves none rather than an old one. The saved game carries its room's id too (added as
  it is saved, taken off as it is loaded). On reopening, the record counts only if it names the same
  room; with none, another or no id in the save, the room gets a new id, no keys and no bans, and
  every player in it comes back through recovery. A phone keeps its keys by room
  id (`<game>:keys`, the last 200; in memory when storage is blocked). Keys are in no URL, log,
  view, History entry or player row. Proofs need `crypto.subtle` (https, or localhost). A host
  page without it (plain http on a LAN address, as for previews) can check nothing, so it keeps no
  keys and seats every phone by the game's own rules alone, as before keys: nobody is asked for a
  proof or sent to New phone there, and anyone with the code may take a seat by id or name.
- **One tab owns a game's room** (`owner.ts`). The saved game and the seat record are kept under the
  game's name, so the first host screen of a game to open holds a Web Lock (`navigator.locks`,
  named for the game) until it closes the room or the tab goes, whatever broker either tab uses.
  Another tab of that game on the device then opens no room and reads or writes nothing of it; its
  host screen says "This game is open in another tab on this device. Play there, or close the room
  there and come back." (opening it again after that tab closes the room works). A browser without
  working Web Locks (an old one, or plain http) may host, but no tab there can be sure it is the only
  one: it opens a saved room under the id saved with its game, so saves and drawings work as with a
  lock, and keeps who was removed, but loads no saved key (every seat starts with none, so phones
  with a key come back through New phone; keys enrolled in that tab work while it is open). Two
  such tabs on one game still share its saves: closing the room in one deletes the other's save,
  as with any two tabs before rooms had owners. The game's first screen reads the
  saved game only to show its code and whether a game is under way.
- **Views** from the other end are read only if they have what the phone reads: every view is an
  object with `left` (a number or null) and `paused` (true or false), and each game checks what its
  phone reads beyond that (Snark Tank: the screen, and a write screen's prompts; Word Salad: its
  answered guesses and a draft's words and choices). Any other view is ignored, so it cannot break
  the phone's queued messages. The phone does not check that the other end is the real host.

**Bots** (for playtesting: a whole game on one host screen, with one real phone or none). "🤖 Add
bot" in each game's host lobby seats a bot: a pretend phone the host screen runs in a local seat
of the link (`seat`). It says hello through the game's own join rules (same name limits and
player limit, so bots fill seats up to it and count toward the minimum: a room of bots alone can
start), counts as online, is sent exactly the view a phone of its own would be sent (a brain may also read the packs on the host screen, its own packs included), and acts by
sending a phone's messages, which the host checks like any phone's. Its name carries the mark
("🤖 Ada", "🤖 Bix", new in the room), so the robot shows wherever players are listed, on the
host and on phones; a phone's name may not start with 🤖 (it is dropped; a name of only 🤖 is
refused), nor may a phone take a bot's seat. Bots have no keys. The lobby's ✕ removes a bot like a player. A bot's
id starts with `bot-`, which the link lets no phone use: when a reloaded host reopens the room,
every player in it with such an id is seated again as a bot with the same id and name (one the
room refuses is removed from the game; a name alone never makes a seat a bot); closing the room drops them. Bots do not count when an empty
lobby whose code is taken moves to a new code. What a
bot does is its game's brain (`games/<id>/bot.ts`, behind one interface in `lib/room/bots.ts`, so
a smarter brain, say one that asks the wizard, can replace it): today's brains are simple and
*house*. Think times (*house*): 1–4 s to pick or vote; a few seconds up to a good part of the time
left to write or draw; every wait ends before the timer does; never instant, never while paused. Drawing
bots draw a random doodle (`lib/doodle.ts`) within the drawing limits.

## Playing cards (`src/lib/cards/`, `src/components/cards/`)

A kit for any game played with a standard 52-card deck (Go Fish first).

- **Cards** (`deck.ts`, pure): a card is its id 0–51; its suit is `Math.floor(id / 13)` (spades,
  hearts, diamonds, clubs) and its rank `id % 13 + 1` (1 ace … 11 jack, 12 queen, 13 king). A new
  deck in order, a shuffled one (`lib/random.ts`, the random numbers a parameter so tests can seed
  them), dealing one card at a time around the table from the top (the first card of a pile is its
  top), a hand sorted by rank (ace low) then suit, and names: "7 of hearts", "ace of spades",
  "sevens", "seven", "A", "10", "K".
- **`PlayingCard`**: a card drawn in CSS and text, no images: rank and suit symbol (♠ ♥ ♦ ♣) in the
  top-left corner and, upside down, the bottom-right, and the suit large in the middle (small
  cards show the corner only); a white face with red hearts and diamonds and black spades and
  clubs, the same in both schemes (red 5.9:1, black 18:1). Its back is a crosshatch in the card
  tokens. Three sizes from the tokens (30, 52, 72 px wide, 5:7).
- **`CardFan`**: a hand face up, side by side when it fits, else overlapping in even rows, each
  card showing at least the left half of its width (its corner) and each row the top part of the
  cards under it (`fan.ts`), so 30 cards fit a 360 px phone in three rows. With a tap handler each
  card is a button named for its card; selected cards stand raised and outlined in the accent. With
  a count instead (`backs`), a short overlapping row of up to six backs and the number, for a table.

## Game 8 — Word Salad (`salad`)

2–8 players join a host screen by code or QR using the shared room link. Two rounds, with
one turn per player in seat order. The host chooses built-in packs in Settings (they apply to a
new room) and how long a dropped presenter is waited for: 30 s, 1 min (default), 2 min or 5 min
(applies at once; saved rooms and settings from before the choice wait 1 min).

- **Pick** (20 s): privately choose one of three secrets, including one Easy and a mix of
  categories (person, place, thing, story). One reshuffle per player each round. Picking takes
  two taps: the first selects a tile (raised, the others dimmed) and grows a "Pick" bar
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
- **Bots** (see Shared room link): pick one of their secrets at random, fill every blank with its
  first word and publish; presenting, publish up to three follow-ups; guessing, read the category
  off the opening clue and guess that category's answers from the packs, up to five a turn.

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
- **Drawing** (shared with Sketchy: `components/draw/`, `lib/ink`): square canvas, 640 × 640 units, Pointer Events, scrolling locked; 8 colours,
  thin/thick pen, undo, clear ("Undo clear" brings a cleared drawing back until the next stroke);
  on a short phone the canvas shrinks so the name and Submit stay on screen. Stored as strokes `{c: colour, w: width, p: [x0, y0, dx1, dy1, …]}`
  (whole units, points closer than 3 units dropped). The host keeps drawings in their own
  store (key `brawl:art`), never in the game state; views carry drawing ids; a phone asks for a
  drawing it lacks (`{t: 'art?', id}`) and keeps the answer. Drawings travel through the shared
  link's parts.
- **Content** (`src/content/brawl/*.json`): `{"id", "name", "blurb", "added"?, "titles": ["..."]}`; titles and rematch titles
  come from one pool, never repeating within a game: the picked packs' titles shuffled (Classic's
  when none of the picks exists any more).
- **Too few titles** (*house*, `src/games/brawl/pack.ts`; the shared rule is under "A game plays
  only the packs the player ticked"): a game of N players needs N titles for round 1 and two per
  bout in round 2 (title and rematch title), with round 2 sized for two late joiners:
  N + 2 × min(N + 2, 8), so 13 for three, 16 for four, 19, 22, 23 and 24 for eight. The popup
  says "Your packs have 10 titles. 4 players need 16." and "Add titles from Classic for this
  game?"; lent titles follow the picks' in the pool. Should more late joiners come than the count
  allowed for, round 2 reuses round 1's titles, one not yet dealt that round and that neither
  artist had while there is one (a pool smaller than the bouts simply repeats).
- **Settings** (`#/brawl/settings`, a pack page like Snark Tank's): title packs (search/sort,
  editor, Make a pack or Add pack → New / 🌍 Community / Import, Export; a pack just made or
  imported joins the picked ones; with too few titles for the lobby's players (at least three), a
  note says how many and that the game will ask before adding titles from the packs it names) and
  a Rules row over Done opening seconds per drawing. Make a pack: paste titles
  (one per line) or ask the wizard (a request or a suggestion, 10–60 titles, default 30); own packs
  have "🧙 Add more" (5–40, default 15). Every route keeps a title only when it meets the content
  rules (2–8 words, capital first, no closing . ! or ?, 60 characters; `src/games/brawl/rules.ts`),
  and the wizard's are also new to every Doodle Brawl pack on the phone; anything else is dropped
  unseen. Community: wizard packs and Add more are shared; titles a built-in has are left out on
  import.
- The drawing timer applies to each pass. Submit early or let the phone send your drawing at
  the buzzer. A half-finished drawing survives a phone reload. Drawings over 200 KB
  or 6,000 points are rejected. The host removes stored art when the room closes.
- The title gets 3 s on its own. Results stay up for 8 s and the round scoreboard for 15 s.
  When both round-two fighters are blank, the first bout is skipped and the rematch runs if
  either artist has a previously shown fighter available. The host can pause, advance or close
  the room. Its back arrow leaves the room open, and the start screen shows the room code
  and a "Return" button.
  The lobby supports removing players, choosing packs and changing brokers. Reconnects
  and History work as in Snark Tank. Classic has 120 titles and After Dark has 60.
- Demos at `#/brawl/host?demo=` and `#/brawl/join?demo=` with
  `lobby|lobby-empty|topup|draw|challenge|title|vote|payout|tag|rematch|scores|over|paused`
  (`topup`: the question before Start).
  Phone demos also have `join|wait|late|voted|watching|tagged`.
- **Bots** (see Shared room link): draw a random doodle and name it from a short list, vote at
  random, keep or tag in at random.

## Game 10 — Sketchy (`sketch`)

A drawing game in two modes, chosen in Settings: **Telephone** (rules of Gartic Phone's normal
mode) and **Draw & guess** (rules of skribbl.io). Our words, ideas and look. 3–10 players draw
on their own phones through the shared room link; a host screen shows the room. Amounts marked
*house* are ours (the originals do not publish theirs, or we changed them for a party).

- **Drawing**: the Doodle Brawl canvas, moved to shared code (`src/components/draw/`,
  `src/lib/ink.ts`) so both games use one: same strokes, limits, colours, pens, undo, clear and
  "Undo clear"; Sketchy adds an Eraser in the tools row (a thick paper-coloured pen: ink 8,
  width 15, which Doodle Brawl's reader still refuses; Sketchy's host refuses ink 8 at any other
  width). Drawings live in the host's art store
  (key `sketch:drawings`, saved with the room's id and read only by that room). The record from
  before drawings carried a room id (key `sketch:art`) goes to a game saved without one, never to a
  game that has a room id, and stays until a save of the game naming its room id has been stored,
  so a game write that fails after the drawings were filed leaves both as they were. The game is saved with a room id only once its drawings were stored under that id: when
  the room's id is new (an old save, a lost seat record, a move to another code) the drawings are
  written first, and if that write fails (storage full) the game keeps being saved with the id
  it had, so the next open tries again; the host sees nothing different meanwhile, and after a
  reload in that state the seat keys are not trusted (phones come back through New phone). Drawings
  are never in the game state;
  a drawing's id starts with the game's id, which a lobby that moves to another code gets anew, so
  no room ever shows another's drawing; views carry drawing ids; a phone asks for one it
  lacks (and for the next album entry's ahead of time); one the host no longer has comes back
  blank rather than leaving the phone loading. A half-finished drawing and typed text
  survive a phone reload (`sketch:draft`, one job at a time).
- **Settings** (`#/sketch/settings`, a pack page like Snark Tank's): Mode (Telephone, default;
  Draw & guess) over the packs, which count what the mode deals ("100 ideas" or "300 words"; a
  note when the picks are too few for the lobby's players, at least three, as in "Too few words or
  ideas" below); packs as in Snark Tank (search/sort,
  editor, Make a pack or Add pack → New / 🌍 Community / Import, Export; at least one picked; a
  pack just made or imported joins the picked ones), and per mode: Telephone, seconds to write 30/45/60
  (default 45, *house*) and to draw 60/90/120/180 (default 90, *house*); Draw & guess, rounds
  1/2/3/4 (default 2, *house*: the original's 3 runs long with ten players) and seconds to draw
  60/80/120 (default 80, the original's). The mode and packs are on the page; the Rules row over
  Done summarises the mode's timers and opens them, as in Snark Tank. Saved on the device at once;
  a running game keeps its own, so they apply to the next game.
- **Making packs**: paste words or ideas (a switch says which the list is), or ask the wizard (a
  request or a suggestion, 15–120 words, default 45, plus one idea per three words, at least five);
  own packs have "🧙 Add more" (15–90 words, default 30, ideas likewise). Every route keeps an item
  only when it meets the content rules below (`src/games/sketch/rules.ts`), and the wizard's are
  also new to every Sketchy pack on the phone; anything else is dropped unseen. A pack may hold
  only words or only ideas; the Community library takes one with at least one word. Community:
  wizard packs and Add more are shared with both lists; words and ideas a built-in has are left
  out on import.

### Telephone

- **Steps**: as many steps as players at the start (the original's default). Step 1: everyone
  writes a line (80 characters; "Suggest" fills the box with one of the room's ideas, *house*:
  the host sends five with the step and each tap shows the next; each seat's five start further
  along the room's ideas, so while the room has an idea per seat no two seats are offered the
  same idea on the same tap; it is instant and never offers an idea from a pack the room did not pick or borrow). Then steps alternate: draw the
  line you were handed, then describe the drawing you were handed (80 characters), and so on.
  Done is ready once something is written or drawn and sends at once; each step ends when every
  present player is done, or at its timer (at the buzzer the phone sends what it has; the host
  waits one more second for it). Phones show how many present players (online, still in the room)
  the step is waiting for.
- **Who gets what**: each line starts a chain; at every step each player works on a different
  chain and nobody touches a chain twice (a shuffled Latin square: rows and columns shuffled, so
  who hands to whom changes from step to step; step 1 is each player's own chain). A player only
  ever sees the one entry handed to them, never the chain's start; the host screen shows only
  who is done.
- **Gaps** (*house*): an empty or missing line becomes the room's next idea not yet used (on step
  1, one no seat is offered by Suggest where there is one; a line a player wrote from Suggest
  counts as used; once all are used, the room's own ideas come round again, least recently used
  first, so when the picks hold only as many ideas as players a blank line may get an idea the
  room already used), marked in
  the album "The game filled this in"; an empty drawing is handed on as blank and the next phone
  says "Nothing was drawn. Make up what it might have been."
- **Players**: no late joins into the chains once the game starts (they watch the album; they
  play the next game). A player who drops keeps their place; their steps are filled as above
  until they are back. A removed or departed player's remaining steps are filled the same way.
- **Album**: when the last step ends, the host shows each chain in turn, entry by entry ("Sam
  wrote", "Alex drew", "Jo thought it was"), the entry before it alongside, one per Next (host
  button, Space or →; ← goes back). Phones follow the same entry, so a group can play from
  phones alone; only the host turns pages. No scores. After the last entry of the last chain:
  Lobby (same room and players; Start deals new chains) or Close. History gets one
  entry on the host when the album opens: "Telephone · N chains", with each chain's first and last line.

### Draw & guess

- **Turns**: each round every player draws once, in seat order (late joiners guess at once and
  draw from the next round; a drawer no longer in the room is passed over). The drawer picks one
  of three words from the room's (15 s, *house*; else the first is taken); words never repeat
  within a game until the room's words are all offered, and then its own come round again, least
  recently offered first (a game saved by an older version, which did not keep them, brings round
  its last offer); a turn with no word to offer ends the game.
- **Drawing live**: the drawer's phone sends what it added since its last send about every
  100 ms, numbered; undo and clear (or a reconnect, or the host asking after a gap) send the
  whole drawing. The host checks each against the drawing limits, shows it and relays it to every
  other phone; a phone that misses a number asks for the whole drawing. A phone that (re)connects
  mid-turn gets the drawing so far, and the drawer's carries on from it when it has no drawing of
  its own (it took over the seat): until that arrives, or for 3 s, it cannot draw. The host saves live ink at most once a second (a reloaded
  host gets the rest from the drawer) and drops a turn's drawing once its reveal ends.
- **Guessing**: everyone else types guesses on their phone (40 characters, *house*); each guess
  appears on the host and every phone with its author ("Jo: lamp"), except a correct one, shown
  as "Jo got it!". Matching ignores case, accents, spaces, punctuation and a leading "the", "a"
  or "an". A guess one letter off (a letter changed, added or dropped; words of four or more
  letters) still shows in the list and tells only that guesser "Close!" until their next guess.
  A player who has guessed it sees the word and guesses no more.
- **Hint**: guessers see the word's shape (a box per letter, gaps between words, hyphens and
  apostrophes shown, the letter count beside it); one letter is shown at half time and another
  at three quarters (*house*: the original's default is two hints), never more than a third of
  the letters (so none for a word under three letters).
- **Turn end**: when every present guesser has it, at the timer, or when the drawer has been
  offline for 10 s (also while picking: then the turn is passed over; the clock started while
  picking keeps running once drawing starts). The host's End turn while
  the drawer is picking passes the turn over too. The word is revealed with the drawing and each
  player's points (5 s), then the next turn.
- **Points** (*house*: the original's formula is not published): a correct guess earns
  50 + 450 × the share of the draw time left, rounded to 5; the drawer earns the average over all
  guessers (everyone who got it, even if they have since left, and the rest of the room online at
  the turn's end) of what they earned this turn (non-guessers count as 0), rounded to 5. A drawer
  removed or gone from the room by the turn's end earns nothing for it. Phones and the host show
  "N of M got it" over the same guessers. A scoreboard shows between rounds (8 s, or Next); the
  game ends after the last round with standings and confetti; ties share a place. Lobby
  keeps the players and resets the scores. History gets one entry on the host.

### Both modes

- Lobby like Doodle Brawl's: big code, QR, players (✕ removes after a confirm), mode and rules
  summary, Start (3+), Settings. Host controls: pause/resume (the timer stops on every phone;
  Space; while paused the host ignores lines, drawings, live ink, picks and guesses, and a phone
  whose entry crossed the pause shows its job again and resends it on resume), skip (End step /
  End turn / Next; a second tap within 0.8 s is ignored), close the room. The host's back arrow leaves the room open; the start screen shows the room code and
  Return. Host state is saved after every change; a reloaded host reopens the room (a timer that
  ran out meanwhile gets 12 s). For 10 s after the host reopens or changes broker (*house*), while
  phones reconnect, nobody counts as away and "every present player is done" or "every present
  guesser has it" ends nothing; timers still run. A player who chose Leave room and rejoins after
  Lobby is seated in the new lobby. Reconnects, name rules and Leave room as in the shared room link;
  name limit 20 characters.
- **Content** (`src/content/sketch/*.json`): `{"id", "name", "blurb", "added"?, "words": [...],
  "ideas": [...]}`; words (1–3 words, letters, spaces, hyphens and apostrophes, 24 characters)
  for Draw & guess, ideas (3–10 words, capital first, no end punctuation) for Telephone; both new
  across packs. Classic has 300 words and 100 ideas; After Dark 120 and 50. A game deals only
  from the picked packs (Classic when none of them exists any more) and, after a yes, the packs
  that lent to it.
- **Too few words or ideas** (*house*, `src/games/sketch/room.ts`; the shared rule is under "A game
  plays only the packs the player ticked"): Draw & guess offers three words a turn, a turn per
  player each round, rounds after the first sized for two late joiners up to ten: 3 × (N + (rounds
  − 1) × min(N + 2, 10)), so 24 for three and 30 for four over 2 rounds, 60 for ten. Telephone
  needs an idea per chain, enough for every opening line left blank: N (nobody joins once the
  chains start). The popup says "Your packs have 12 words. 4 players need 30." and "Add words from
  Classic for this game?" (ideas in Telephone); only the mode's own kind counts. Should more
  players draw than counted, or more lines be left blank, the room's own items come round again.
- Demos at `#/sketch/host?demo=` and `#/sketch/join?demo=` with
  `lobby|write|draw|describe|album|pick|guess|reveal|scores|over|paused` (`paused`: a paused
  Draw & guess turn); phone demos also have `join|wait|watching|guessed|drawing`.
- **Bots** (see Shared room link): Telephone, write one of the ideas the step brings, draw a
  random doodle, describe with a random word from the room's packs; Draw & guess, pick a word at
  random and draw a random doodle live, a stroke about every second; guess honestly, up to four
  words a turn from the room's packs (its picks and the packs lent to it) that fit the word's
  shape and the letters shown.

## Game 11 — Bad Hand (`hand`)

Rules of Cards Against Humanity, our cards and look (never its card text, terms or black-and-white
card style). 3–10 players hold a hand of answer cards on their own phones; a host screen shows the
prompt and the answers. Amounts marked *house* are ours.

- **Round**: a judge (seat order, starting with a random seat; the original's "most recently
  pooped" is left to the room) reveals a prompt card on the host and every phone. Everyone else
  plays one answer card from a hand of ten (two, in order, when the prompt has two blanks); a
  prompt with no blank is a question answered by one card. Tapping a card selects it (numbered 1,
  2 on a two-card prompt), the prompt shows filled in (mid-sentence an answer opening with an
  article, possessive, number word or -ing word loses its capital; names keep theirs), and Play sends it. Answering ends when every
  present player has played, or at the timer (default 60 s, *house*; 45/60/90/no limit); a player
  who has not played by then plays nothing that round.
- **Judging**: the answers, shuffled and anonymous, appear on the host screen and the judge's
  phone as the prompt filled in. The judge taps one to show it large on the host and read it
  aloud, then confirms the funniest with "Pick" (two taps, as Word Salad's pick). Its
  player scores 1 point; the reveal shows every answer's author (8 s, or Next). Then everyone
  draws back to ten and the next player judges.
- **Missing judge** (*house*): if the judge is offline when judging starts or for 20 s during
  it, everyone who played votes on their phone instead (one vote, never their own; 30 s); most
  votes wins, ties drawn at random (no votes at all: a random answer). A judge who leaves or is
  removed hands judging to the vote at once. After the host screen reloads or changes broker,
  phones get 10 s to reconnect (*house*): until then nobody counts as offline, so neither "every
  present player has played" nor a missing judge ends a phase early (a timer that ran out
  meanwhile still gets its 12 s). No answers from players: the prompt is set aside at
  once (no reveal) and the next player judges. One answer (the house's counted): it wins without
  judging. The host can also skip judging to the vote ("Let the room vote").
- **Winning**: first to the target (5/7/10 points, default 7, *house*: the original plays until
  the room stops) wins, decided when the point is scored; only players still in the game count (a
  player who left reaches the target by rejoining and scoring). Standings with confetti, the winning answer of every round, Lobby
  or Close. History gets one entry on the host.
- **Options** (Settings, off by default; house rules printed with the original):
  - *Trade point*: a player with a point may, while others answer or during the reveal (never
    judging or voting, and not once someone has reached the target), give it up to swap any of
    their cards for new ones; a player who has played still sees their hand to trade.
  - *House player*: each round, when answering ends, random cards from the deck (as many as the
    prompt takes, never a blank one) join the answers as the house's. If it wins, the house
    scores; if the house reaches the target, everyone loses. The standings show the house's points.
  - *Blank cards*: one blank card per 19 answer cards is shuffled into the deck (about one card in
    twenty dealt); playing it means typing your own answer (60 characters).
- **Deck**: answer cards from the chosen packs, shuffled, never dealing a card someone holds;
  played cards go to a discard pile that is shuffled back in when the deck runs out. Prompts are
  dealt without repeats until they run out.
- **Players**: late joiners are dealt ten and play from the next prompt. A player who drops keeps
  their seat, hand and score; one who is removed or leaves returns their hand to the deck (and,
  while answering, the card they played; an answer already shown stays in and can still score).
  One who left may rejoin with their score and is dealt ten. A phone with nothing to do (the judge
  while others answer, a late joiner) shows who has played, then its hand. If fewer than two
  players are left when a round would start, the game ends.
- Lobby, host controls, reconnects, name rules (20 characters) and the open-room Return as in
  Sketchy. Skip reads End answering, Let the room vote, End voting or Next; pause works in every
  phase of play and also stops the missing judge's 20 s. A Players button mid-game removes a player (after a confirm). Settings
  (`#/hand/settings`, a pack page like Snark Tank's): card packs (Classic by default; search/sort,
  editor, Make a pack or Add pack → New / 🌍 Community / Import, Export; a pack just made or
  imported joins the picked ones, like an expansion; if none of the chosen packs exists, Classic
  is used), and a Rules row over Done opening answer time, target and the options; they apply to
  the next game. Done says "No pack has prompt cards" (or answer cards) when no pack on the phone
  has any, and a note says when the picks are too small for the lobby's players (at least three)
  and that the game will ask before adding cards from the packs it names.
- **Too few cards** (*house*, `src/games/hand/pack.ts`; the shared rule is under "A game plays
  only the packs the player ticked"): a room of N players needs (min(N, 8) + 2) × 10 + 20 answer
  cards (a hand of ten each, two seats spare for late joiners, and a refill: 70 for three, 100 for
  six, 120 for eight or more) and at least one prompt. The popup says "Your packs have 40 answer
  cards. 6 players need 100." (or "no prompt cards") and "Add cards from Classic for this game?";
  packs lend only the kind that is short (answers, prompts or both). Late joiners and refills
  draw from the room's own deck.
- **Making packs**: paste cards, one per line (a line with `___` or ending in "?" is a prompt, the
  rest answers), or ask the wizard (a request or a suggestion, 5–40 prompts, default 20, and four
  answers per prompt); own packs have "🧙 Add more" (5–30 prompts, default 10, answers likewise).
  Every route keeps a card only when it meets the content rules below (`src/games/hand/rules.ts`;
  pasted and wizard cards are tidied first: any run of underscores is one blank, first letter
  capital, an answer's closing full stop dropped), and the wizard's are also new to every Bad Hand
  pack on the phone; anything else is dropped unseen. The editor lists prompts, then answers. The
  Community library takes a pack with at least one prompt. Community: wizard packs and Add more are
  shared with both lists; cards a built-in has are left out on import.
- **Content** (`src/content/hand/*.json`): `{"id", "name", "blurb", "added"?, "prompts": [...],
  "answers": [...]}`. A prompt has up to two blanks written `___`; one with none ends with "?".
  Answers are 1–10 words, capital first, no closing full stop, 60 characters. Prompts and answers
  are new across packs. Classic has 100 prompts and 400 answers; After Dark 50 and 200; about one
  prompt in six takes two cards.
- Demos at `#/hand/host?demo=` and `#/hand/join?demo=` with
  `lobby|topup|play|judge|spotlight|reveal|vote|over|paused` (`topup`: the question before
  Start); phone demos also have
  `join|wait|played|judging|trade|blank` (`wait` is the judge's phone while others answer).
- **Bots** (see Shared room link): play random cards (a short stock line on a blank card); as
  judge show each answer large for about 3 s, then pick one at random; vote at random, never for
  their own answer; never trade.

## Game 12 — Odd One Out (`odd`)

Everyone-knows-the-word-but-one folk game. One phone goes round 3–12 players; everyone but one
sees the same secret word, the odd one out does not, and the room talks it out. Amounts marked
*house* are ours.

- **Setup**: player names (3–12; remembered, a first visit borrows Brain Freeze's list), packs
  (Heads Down.'s packs, built-in and own, read through `wordDecks()`; this game has no packs of
  its own and its picks are its own, see Pack list; first visit: every built-in pack but After
  Dark), and a Rules row: rounds 3–10 (default 5), Hint (default on: the odd one out is told the
  word's pack), Odd one never starts (default on). A saved game offers Resume and New game (two taps).
- **Deal**: a word from the picked packs, at random, without repeats on this phone until the packs
  run out (per-pack bags under this game's own keys, so Heads Down.'s own rotation is untouched)
  and never twice in one game; one player at random is the odd one out, and one player at random
  starts the clues (never the odd one out with that option on). All from one random source, so
  tests seed them (`logic.ts`, `deal.ts`). When the game's packs have no words left (deleted
  mid-game), the next round deals from the setup's current picks (its default picks when those were
  deleted too), which become the game's packs; only when those have no words either does the
  screen say "These packs are gone. Start a new game."
- **Pass**: for each player in list order a hand-off ("Pass the phone to Maya", Show) and then
  their secret: the word large with "from Movies" under it, or "Odd one out" with "Word from
  Movies" under it (Hint on) or "Blend in" (Hint off). Both secret screens are one card in the
  same colours with a line above, the big text set the same way (capped in size, a few words at
  most) and a line under it, so a neighbour's glance cannot tell them apart. Hide goes to the next
  hand-off. Back from a secret closes it onto its own hand-off; Back from a hand-off goes to the
  previous player's hand-off (setup from the first). Each takes a back tap only once it has been on
  screen for the double-tap guard time, so a double tap steps back once. Which secret is open is
  never saved: a reload mid-pass lands on the current player's hand-off, and the phone's own back
  gesture from a secret leaves the game for the Games page with the game saved and no secret
  showing, as in Brain Freeze.
- **Clues**: who starts and the order (list order from the starter): "Take turns: say one word
  about the secret word." No timer. Vote.
- **Vote**: "Count to three and point. Who does the room pick?" The room settles a tie itself;
  the phone records one name (tap, then Confirm).
- **Reveal**: "Maya was the odd one out!" then "Maya, guess the word out loud." and Show word,
  then the word with ✗ Missed / ✓ Got it, which ignore taps in their own first 400 ms (so the
  tail of a double tap on Show word judges nothing); or "Ben was not the odd one out. It was
  Maya." with the word at once and Next.
- **Scores** (*house*): not caught, the odd one out scores 2; caught but named the word, 1;
  caught and missed, everyone else 1. Between rounds: who it was, the word, the standings with the
  round's points, Next round. After the last round: the win screen (confetti, the top score or a
  tie, standings, Play again with the same players, packs and options, Setup, Home).
- **History**: one entry per game (scores, the packs, one line per round: "Round 2 · Pizza: Maya
  was the odd one out, caught, named the word"); New game over an unfinished game records it with
  `finished: false` once the new game starts, and only when it had a finished round. Every step is saved; the screen stays awake during play. Back from the clues,
  vote, reveal and scores goes to setup with the game saved.
- Demos at `#/odd?demo=handoff|secret|secret-long|secret-odd|secret-odd-nohint|clues|vote|reveal-caught|reveal-word|reveal-escaped|scores|win`.

## Game 13 — Would You Rather (`rather`)

The folk party game, our questions and look. Each question is two choices ("be able to fly or be
invisible"); everyone picks a side, then the room argues about it. Two ways to play from the start
screen (`#/rather`, with the Return / Rejoin banner as in Bad Hand): the main way in is one phone
read aloud (Play, the large button: "One phone reads the questions aloud and the room picks with a
show of hands."); the second choice is a room (Host and Join under it: "Or everyone picks on their
own phone, with a screen everyone can see (3 to 12 players)."). Its card on the main menu reads
"3–12 players · one phone" (its tags still list both One phone and Own phones). Amounts marked *house* are ours: the folk game keeps no score.

- **Own phones** (the second choice): 3–12 players join a host screen through the shared room link; name limit 20
  characters.
- **Questions**: only the picked packs' questions (when none of the picks exists any more,
  Classic alone, the default; host and one phone share this rule, `pickedPacks`), shuffled, one per
  question (the same choices in either order are one; `roomQuestions`). A game asks 10, 15 or 20
  (Settings, default 10), or as many as the picks hold. The room remembers which questions it has
  asked by their key, never their text: every Start reads the packs as they are then (so an edited
  or deleted question is never asked from memory), asks ones the room has not asked yet, and when
  fewer are left than the game needs, forgets what it asked and carries on with the rest of the
  picks (*house*), none twice in one game. Keys no longer in the picks are dropped at Start.
- **Vote** (default 20 s; 15/20/30/no limit, *house*): the host shows "Would you rather…", the two
  choices as two large panels in two fixed colours (the first warm orange, the second blue; side by
  side, stacked on a narrow screen; each text as large as its panel allows), "Question 3 of 10",
  the timer, and every player's name, dimmed until they have voted (never which way). Each phone
  shows the same two choices as two big buttons in the same colours. A tap sends the vote; the
  chosen button is marked at once (a mark that belongs to that room and seat: it goes when the
  phone leaves the seat, so it never shows in another room) and stays marked and the phone says the other can still be tapped to change: the last
  tap before the reveal counts (*house*). A vote names its phase and question number; the host
  ignores one for another question, from a player not in the game, or after the reveal. Before the
  reveal a phone is sent only its own vote and who has voted, never anyone else's side.
- **Reveal** when every player in the game whose phone is connected has voted, or at the timer;
  with no limit, also when the host taps Reveal. It stays 10 s (or Next; Results when the next
  step ends the game, one rule in the logic). The host's reveal shows no score cards (scores are on
  the phones and at the end), so a full room of long names still fits. Both panels show their count and percent, a split bar runs under them and each choice
  lists its voters. Each player on the side with more votes scores 1 point (*house*). A tie scores
  nobody ("Split down the middle. No points."); no votes at all: "Nobody voted.", no points.
  Players who did not vote get nothing; the votes of players removed or gone by the reveal do not
  count. Phones show which side won, whether they scored, and their total.
- **End**: after the last question, standings with confetti (ties share a place) and how many
  questions were asked (fewer when the game ended early), Lobby (same players, scores at zero) or
  Close. History gets one entry on the host, one line per question
  with each side's count ("be able to fly (3) or be invisible (2)").
- **Players**: late joiners are seated at once and may vote on the question in play. A player who
  drops keeps their seat and score and nobody waits for them; one who leaves or is removed is out
  (their vote stops counting) and one who left may rejoin with their score. If fewer than two
  players are left when a question would start, the game ends.
- Lobby, host controls, reconnects, name rules and the open-room Return as in Bad Hand. Skip reads
  Reveal or Next; pause works while voting and in the reveal. A Players button mid-game removes a
  player (after a confirm). The host is saved under `rather:host`, a phone's seat under `rather:me`.
- **Settings** (`#/rather/settings`, a pack page like Bad Hand's): question packs (Classic by
  default; search/sort, editor, Make a pack or Add pack → New / 🌍 Community / Import, Export; a
  pack just made or imported joins the picked ones; when the picks hold fewer questions than a game
  asks, a note says so: "6 questions picked: a game will have 6"), and a Rules row over Done opening questions per game
  and seconds to vote; they apply to the next game.
- **One phone** (`#/rather/aloud`, the main way in): for reading aloud with a show of hands. "Would you rather…" and
  the two choices large in the same two colours, Previous and Next, a count ("7 of 100") and a
  Packs link to the settings. The same questions a room would ask from (`roomQuestions`), shuffled;
  the place is kept while the app stays open and the picked questions stay the same. After the last question it
  says so and offers Start over. No players, no scores, no History; the screen stays awake.
- **Making packs**: paste questions, one per line, or ask the wizard (a request or a suggestion,
  10–60 questions, default 30); own packs have "🧙 Add more" (5–40, default 15). Every route keeps
  a question only when it meets the content rules below (`src/games/rather/rules.ts`; pasted and
  wizard lines are tidied first: a leading "Would you rather" and closing punctuation dropped, "OR"
  made "or", and a first word of one capital then lowercase letters or apostrophes ("Lick",
  "Don't") lowercased, since what follows "Would you rather" is a verb or adverb, never a name; a
  first word like "DJ" is left and the line refused), and the wizard's are also new to every Would
  You Rather pack on the phone; anything else is dropped unseen. Community: wizard packs and Add
  more are shared; questions a built-in has (the same choices in either order) are left out on
  import.
- **Content** (`src/content/rather/*.json`): `{"id", "name", "blurb", "added"?, "prompts": [...]}`.
  A question is two choices joined by exactly one " or ", each 1–12 words and at most 60
  characters, the whole at most 130; it starts lowercase, never with "Would you rather", and has no
  closing punctuation; the two choices differ. Questions are new across packs (the same choices in
  either order are one question). Classic has 100 questions and After Dark 60.
- Demos at `#/rather/host?demo=` with `lobby|lobby-empty|vote|vote-long|reveal|reveal-full|tie|over|paused`
  and `#/rather/join?demo=` with `join|wait|vote|voted|reveal|over` (the demos use the longest
  built-in question; `vote-long` and `reveal-full` the longest a question may be, two 60-character
  choices, and `reveal-full` twelve players with 20-character names).
- **Bots** (see Shared room link): tap a side at random after 1–4 s, once a question.

## Game 14 — Go Fish (`fish`)

Traditional Go Fish with the common published rules, our look. The host screen is the table;
each phone is that player's hand (`#/fish`: Host and Join, with the Return / Rejoin banner as in
Bad Hand). Choices marked *house* are ours where the published rules vary.

- **Own phones**: 2–6 players join a host screen through the shared room link; name limit 20
  characters. No packs: the deck is a standard 52-card one (see Playing cards).
- **Deal**: a shuffled deck, one card at a time around the table, 7 cards each with 2 or 3
  players and 5 each with 4 to 6; the rest is the pool, face down. A random player goes first.
  Four of a rank in a hand are laid down at once as a book, at any moment, the deal included.
- **Turn**: the player whose turn it is taps a card in their hand (that picks its rank, so they
  always hold the rank they ask for; every card of it stands raised), taps another player who
  holds a card, and taps Ask ("Ask Sam for sevens"). The host settles it; the asked player does
  nothing and cannot lie. They hold that rank: all those cards move to the asker, who goes again.
  They hold none: "Go fish!", and the asker draws the top card of the pool; if it is the rank asked
  for it is shown to the room ("Maya fished a seven!") and the asker goes again,
  otherwise the turn passes to the next player in seat order (*house*: the other common variant
  gives the turn to the player asked). With the pool empty a go fish draws nothing and the turn
  passes. A player whose hand is empty at the start of their turn draws one card and then asks;
  with the pool empty they are skipped. If no other player holds a card, the asker draws one and
  the turn passes; this one rule also settles a turn at once whenever its player is left with
  nobody to ask mid-turn (another player removed or gone), and a turn timed out with nobody to ask. An ask names its turn (`at`); the host ignores one out of turn, for a rank the
  asker does not hold, of themselves, of a player with no cards, who is out or watching, for
  another turn, or while paused, and tells that phone it did not count. A phone keeps only its
  latest ask to send again after a reconnect, and drops one the host refused, so an older ask is
  never sent again.
- **What everyone sees**: every ask and its outcome, as at a real table ("Maya asked Sam for
  sevens. Sam gave 2.", "Maya asked Sam for sevens. Go fish!", "Maya drew a card.", "Maya laid
  down the sevens."). An outcome stays up 3 s (`SHOW_MS`, or Next) before the next turn, with who
  will really play next ("Maya goes again.", "Next: Sam."), decided by the same rules the next
  turn uses (a player who will be passed by is never named; nothing when the game ends). Nobody
  ever sees another player's cards or the pool's order: a phone is sent its own hand, every
  player's card count and books, the pool's count, whose turn it is and the last 8 events; the
  card it just drew, to its own phone only ("You drew the 4 of clubs.").
- **Timer**: seconds per turn 20 / 30 / 45 / no limit (default 30, *house*), in Settings
  (`#/fish/settings`, rules only). When it runs out the game makes a random legal ask for that
  player (a rank they hold, from a player with cards; *house*), so a sleeping or dropped phone never
  stalls the table; with no limit the host's "Ask for them" does the same.
- **End**: when all 13 books are down, after the outcome that laid the last one. Most books wins;
  ties share a place; the standings list each player's books as rank badges, with confetti; Lobby
  (same players, a fresh deal) or Close. History gets one entry on the host: who won, books per
  player, and one line per player naming their books ("Maya: sevens, kings").
- **Players**: a phone that drops keeps its hand and nobody waits but the timer. A player who is
  removed or leaves is out: their hand is shuffled back into the pool ("Sam is out. Their cards
  went back into the pool."), their books stay down under their name on the table, and their turn
  passes on. One who left may come back and plays on with their books and an empty hand (drawing
  on their turn). Fewer than two players left ends the game. The standings count only players
  still in the game (*house*). Late joiners are seated and watch ("You're watching: you'll be dealt
  in at the next deal."); they are dealt in at the next deal.
- **Host screen** (the table): whose turn it is, large ("Maya's turn"), or the outcome in play,
  with who plays next; the timer; each player in a panel in seat order (name, status: Asking, Away,
  Out, Next deal), a fan of backs with their card count and their books as rank badges; in the
  middle the pool (backs and count), "4 of 13 books down" and the last four outcomes small. Skip
  reads "Ask for them" or "Next"; pause stops the turn's and the outcome's clock. A Players button
  mid-game removes a player (after a confirm). Fits six 20-character names at 1366×768.
- **Phone**: the hand as cards sorted by rank (`CardFan`; 25 cards fit a 360×640 phone); on your
  turn "Your turn!", a buzz and a sound, the hand to tap, the other players as buttons with their
  card counts, and one Ask button pinned at the foot; otherwise who is asking, or the outcome;
  your books. A phone's picked rank and player, and "Asking…" once sent, belong to its seat in
  that room and that turn: they go when the turn moves on, the host refuses the ask, or the phone
  leaves the seat; a picked rank no longer held or a picked player no longer askable (removed, out
  of cards) is not picked, and the Ask button says what to tap. The host is saved under `fish:host`, a phone's seat under `fish:me`.
- Lobby, host controls, reconnects, name rules and the open-room Return as in Bad Hand; Start
  reads "Deal for 4 players".
- Demos at `#/fish/host?demo=` with `lobby|turn|gave|fish|book|over|paused|full` and
  `#/fish/join?demo=` with `join|wait|turn|picked|watching|over|full` (`full`: on the host a table
  of six 20-character names, on the phone a hand of 25 cards).
- **Bots** (see Shared room link): on their turn, after 1–4 s, ask for a rank they hold; from a
  player they saw ask for or receive that rank who may still hold it (not given away or laid down
  since), else from a random player with cards (*house*).

## Game 15 — Smarty Pants (`trivia`)

Multiple-choice trivia on everyone's own phone, the faster right answer scoring more. Two ways to
play from the start screen (`#/trivia`: Host, Join and Solo, with the Return / Rejoin banner as in
Bad Hand). Amounts marked *house* are ours.

- **Own phones**: 2–12 players join a host screen through the shared room link; name limit 20
  characters.
- **Questions**: only the picked packs' questions (when none of the picks exists any more, Classic
  alone, the default; host and Solo share this rule, `pickedPacks`), shuffled, none twice (the same
  question text, ignoring case, spacing and punctuation, is one; `roomQuestions`). A game asks 10,
  15 or 20 (Settings, default 10), or as many as the picks hold. The room remembers which questions
  it has asked by their key, never their text, and forgets them when the picks run out, as Would You
  Rather's does (`deal`). Within a game the category changes from one question to the next whenever
  another category still has a question left (*house*). Each question's four answers are shuffled
  once, at Start, and every screen shows them in that order.
- **Each question** has three phases:
  - **Category** (3 s, *house*): the host shows "Question 3 of 10" and the category large; phones
    show it too. Show (the host's skip) goes straight to the question.
  - **Answer** (default 20 s; 10/15/20/30, *house*): the host shows the question, its category,
    the four answers as four tiles in four fixed colours (orange, blue, yellow, purple), each
    showing its letter (A, B, C, D) so colour is never the only cue, the timer, and every player's
    name, dimmed until they have answered (never what). Phones show the question and the four
    answers as four big buttons in the same colours and letters (stacked on a narrow screen). The
    first tap is final: the tapped button is marked at once (a mark that belongs to that room and
    seat), the others dim and take no more taps. When the phone's timer reaches 0 its buttons take
    no taps ("Time's up!"). A tap names its phase and question number; the host ignores one for
    another question, a second tap, one from a player not in the game, or one that arrives when no
    time is left on the host's clock (a paused game keeps the time left when it stopped); a tap that
    finds the time up moves the game to the reveal at once instead of waiting for the timer. Before
    the reveal no view says which answer is right, and a phone is sent only its own answer and who
    has answered.
  - **Reveal** (8 s, *house*; or Next, Results when the next step ends the game) when every player
    in the game whose phone is connected has answered, or at the timer. The right answer is marked
    ("✓ Right"), the others dimmed, each tile with how many picked it; "Got it" lists who was right
    with the points each gained (most first), and "Top 5" the leading scores (ties share a place).
    Phones say "Right! +870", "Not quite." or "Time's up!" (no answer that counts), the answer,
    their tile marked, and their place and total.
- **Points**: a right answer scores 500 plus up to 500 for speed, `round(500 × time left ÷ time
  allowed)` at the moment the host received the tap (*house*; faster scoring more is the usual quiz
  rule). A wrong answer or none scores 0. A tap that arrives while paused scores the time left when
  the clock stopped. If the host screen reloads and a timer ran out meanwhile, that phase gets 12 s
  of extra time (*house*) so phones can reconnect and answer; the timers show those 12 s alone,
  the host says "extra time, no speed points", and a right answer in them scores 500 with no speed
  points. A player who leaves or is removed has no answer to the question in play any more, even
  after rejoining.
- **End**: after the last question, standings with confetti (ties share a place) and how many
  questions were asked, Lobby (same players, scores at zero) or Close. History gets one entry on
  the host, one line per question ("Science: What gas do plants take in from the air? Carbon dioxide
  (3 of 5 right)").
- **Players**: late joiners are seated at once and may answer the question in play. A player who
  drops keeps their seat and score and nobody waits for them; one who leaves or is removed is out
  (their answer stops counting) and one who left may rejoin with their score. If fewer than two
  players are left when a question would start, the game ends.
- Lobby, host controls, reconnects, name rules and the open-room Return as in Would You Rather. Skip
  reads Show, Reveal or Next; pause works in every phase of a question. A Players button mid-game
  removes a player (after a confirm). The host is saved under `trivia:host`, a phone's seat under
  `trivia:me`.
- **Settings** (`#/trivia/settings`, a pack page like Would You Rather's): question packs (Classic
  by default; search/sort, editor, Make a pack or Add pack → New / 🌍 Community / Import, Export; a pack just made
  or imported joins the picked ones; when the picks hold fewer questions than a game asks, a note
  says so), and a Rules row over Done opening questions per game and seconds to answer; they apply
  to the next game. Solo reads the same picks and seconds.
- **Solo** (`#/trivia/solo`): one phone, no room: the category (3 s, or tap it), the question and
  its four answers on the timer, a tap (first tap final), then right or wrong with the points and
  the answer, and Next. Ten questions (*house*), then the score, how many were right, and the best
  score kept on this phone ("A new best on this phone!"), with Play again and Packs. The same pure
  rules as the room (`questions.ts`: dealing, shuffling the answers, points; `solo.ts`); the phone
  remembers each question as it is shown, as a room does, under `trivia:solo` with the best score
  (leaving mid-run skips only the questions it showed; a reload mid-run loses the run). A tap
  counts only while time is left; at 0 the buttons take no taps. The screen stays awake.
- **Making packs**: paste questions, one per line, or ask the wizard (a request or a suggestion,
  10–60 questions, default 30); own packs have "🧙 Add more" (5–40, default 15). Every route keeps
  a question only when it meets the content rules below (`src/games/trivia/rules.ts`; pasted and
  wizard lines are tidied first: each part trimmed with its spaces squeezed, a bar with or without
  spaces read as the separator, and a closing full stop dropped from each answer unless it ends an
  abbreviation: a last word with another full stop inside it, or a capitalised word of at most
  three letters, as in "Washington D.C." and "Martin Luther King Jr."; nothing is reordered), and the wizard's are also new to every Smarty Pants pack on the phone; anything else
  is dropped unseen. The wizard is asked for facts that are certain and will not change, exactly
  one right answer, wrong answers of the same kind and length as the right one, and a spread of
  categories. Community: wizard packs and Add more are shared; questions a built-in has (the same
  question text, whatever its category and answers) are left out on import.
- **Content** (`src/content/trivia/*.json`): `{"id", "name", "blurb", "added"?, "questions": [...]}`.
  A question is one line of six parts split by " | ": category, question, the right answer, three
  wrong answers; none empty after trimming (an answer may be only a sign, "%") and none holding a
  bar. Category 1–3 words, at most 24 characters; question 3–30 words, at most 140 characters; in
  both the first letter or digit is not a lowercase letter, in any alphabet ("Édith Piaf…" and a
  leading quotation mark are fine). Each answer at most 6 words and 40 characters; the four
  answers differ, ignoring only case and spacing ("C", "C++", "C#"; "40" and "-40" differ). Questions are new across packs. The longest line the rules allow is 339 characters;
  pack files and the Community library take a whole line.
- Demos at `#/trivia/host?demo=` with `lobby|category|answer|answer-long|reveal|reveal-full|over|paused`
  and `#/trivia/join?demo=` with `join|wait|category|answer|answer-long|answered|reveal|reveal-full|over`
  (`answer-long` and `reveal-full` the longest a question and its answers may be, and `reveal-full`
  twelve players with 20-character names).
- **Bots** (see Shared room link): answer once a question after 2–8 s, right about 55% of the time
  (*house*). A bot's view never says which answer is right; the host screen running it tells it,
  only to play at that rate.
