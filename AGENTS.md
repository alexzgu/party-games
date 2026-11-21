# Jerk Box — instructions for coding agents

Party games web app (Svelte 5 + TypeScript + Vite PWA), published to
https://alexzgu.github.io/party-games/ by `.github/workflows/deploy.yml` on every push to `main`.
How the games work: `SPEC.md`. Names shown to players: `src/app.config.ts` only.

Checks: `npm run check` (types), `npm test` (unit tests + content gate), `npm run build`.
Content only: `npm run test:content`; list a game's existing items: `npm run list -- <folder>`.

## Making a new pack (the main live-content route)

The owner, or a friend at the party, asks a chat for a pack, e.g. "make a Spectrum pack about
our college", "Heads Down. pack: 2000s cartoons, 60 words" or "a Big Board about Marvel"
(a Big Board pack is a whole quiz board made from a topic; a request for a Heads Down. "deck"
or a Big Board "board" means a pack). You write it as a built-in pack,
check it, and publish it. Phones get it within a minute of the site rebuilding, the next time
they are on the main menu. Do the whole thing without asking questions unless the game or
theme is unclear; pick sensible defaults and say what you chose.

1. **Which game** (folder in `src/content/`):
   - Heads Down. (`forehead/`): one player holds the phone to their forehead; friends shout
     clues. Items: things to guess.
   - Spectrum (`dial/`): a scale between two opposites; one player gives a clue for a secret
     spot on it. Items: scales.
   - Inn Co Hear Ant (`gibberish/`): a phrase of real words that, read aloud quickly, sounds
     like something well known. Items: phrase + answer + category.
   - Big Board (`quiz/`): a team quiz board a host reads aloud. Items: categories, each a
     column of clue + answer, easiest first.
2. **Size** if not given: Heads Down. 60 words, Spectrum 40 cards, Inn Co Hear Ant 40 cards,
   Big Board 5 categories × 5 clues (any 3–6 × 3–5 works; every category the same length; the
   phone's own pack maker allows 1–8 × 1–10, but a built-in Big Board pack in the repo stays 3–6 × 3–5).
   **List what exists first**: `npm run list -- <folder>` prints every word, scale or answer
   already in that game (and, for Inn Co Hear Ant, the hint categories in use). Spectrum
   scales and Inn Co Hear Ant answers must be new across *all* packs of that game, not just
   similar ones; Heads Down. words only need to be new within the pack. Big Board clues must be
   new within the pack; avoid reusing another Big Board pack's answers.
3. **Write** `src/content/<folder>/<id>.json`. `id` is a new lowercase slug (`college-life`),
   never an existing file's id. Exact shapes:

   ```json
   {"id": "cartoons-2000s", "name": "2000s Cartoons", "emoji": "📺", "blurb": "Saturday mornings, 2000–2009", "added": "2026-11-21T15:40", "words": ["SpongeBob", "..."]}
   {"id": "college-life", "name": "College Life", "blurb": "Dorms, finals and dining halls", "added": "2026-11-21T15:40", "cards": [{"left": "Easy class", "right": "Hard class"}]}
   {"id": "tv-mix", "name": "TV Mix", "blurb": "Shows everyone watched", "added": "2026-11-21T15:40", "cards": [{"phrase": "Grey Sat Tommy", "answer": "Grey's Anatomy", "hint": "TV Show"}]}
   {"id": "marvel", "name": "Marvel", "blurb": "Heroes, villains and infinity stones", "added": "2026-11-21T15:40", "categories": [{"name": "Villains", "clues": [{"clue": "This purple Titan snapped away half of all life.", "answer": "Thanos"}]}]}
   ```

   (`emoji` is for Heads Down. only. `added` is the local date and time now, `date +%FT%R`; it
   sorts the pack under "Newest".) Read one existing file of that game first to match its style.
4. **Quality bar** (players are adults in their 20s at a US house party; original content, never
   copied from commercial games):
   - Heads Down.: things most of the room would recognise; Title Case; at most 4 words; no
     trailing punctuation; mix of easy (60%), medium (30%), hard (10%).
   - Spectrum: the two sides are true opposites of one scale, 1–5 words each, sentence case
     ("Bad movie"); subjective scales that spark debate and allow clues along their whole length.
   - Inn Co Hear Ant: every phrase word is a real English word or very common name; the phrase
     never contains the answer's words; said aloud at normal speed in a General American accent
     it clearly sounds like the answer (compare syllable by syllable, drop anything that needs a
     stretch); answers widely known; `hint` is a 1–3 word category, reusing one already in use
     where it fits. Answers keep a leading "The" ("The Little Mermaid"); small words like
     "the" or "and" may appear in the phrase. Avoid near-giveaways: no phrase word that is the
     start of an answer word ("Dumb" for Dumbo) unless nothing better sounds right. Write ~1.5×
     the count and keep the best.
   - Big Board: 3–6 categories with short, fun names (1–3 words); each column runs easiest (top
     row) to hardest (bottom row): the top row most of the room gets, the bottom row a real
     stretch. Each clue is one or two sentences the host can read aloud in one breath, in your
     own words (never copied from a quiz show or game, no show-style framing), with exactly one
     right answer that is short (1–5 words) and never named or spelled out in its own clue or a
     neighbouring one. Check every fact; leave out anything you are not sure of or that may have
     changed recently. Write ~1.5× the clues and keep the best.
   - "After Dark" style requests: cheeky, never explicit.
5. **Check**: `npm run test:content` (the content gate in `src/lib/content.test.ts` rejects
   bad shapes, repeats within a pack, any Spectrum scale or Inn Co Hear Ant answer that already
   exists in another pack, phrases containing the answer's words, and Big Board packs with the wrong
   number of categories or clues, uneven categories, empty answers or a repeated clue; it lists
   every problem in one run). Fix them all and rerun until it passes. A pack-only change needs nothing else.
6. **Publish**: `git add src/content && git commit -m "Add <game> pack: <name>"` then `git push`.
   If the push is refused for lack of GitHub credentials, ask the owner to run `! git push`
   in the chat.
7. **Confirm** it went live: poll
   `curl -s https://api.github.com/repos/alexzgu/party-games/actions/runs` until the newest run
   for your commit is `completed` / `success` (about 1–2 minutes), then tell the asker:
   "Live. Go back to the main menu, wait a moment, then open <game> and tick <pack name> in
   the pack list" (Big Board: "pick <pack name> in the Pack list"). Mention the 3 to 5 items you are least sure about.

### Earworm song packs (`song/`), made by a Claude Code chat on this laptop

Earworm plays a few seconds of each song's 30-second Apple Music preview on the host phone; a
pack holds only titles, artists and Apple track ids (plus, optionally, a clip start and a YouTube
video for the reveal), never audio. Matching songs to Apple needs network access, so these packs
are made by a chat on the owner's laptop. Default size 35 songs (30–40). Run `npm run list --
song` first: an Apple track, or the same title by the same lead artist, may appear in only one
song pack.

```json
{"id": "pop-2020s", "name": "2020s Pop", "blurb": "The last few summers", "added": "2026-11-21T15:40", "songs": [{"title": "Levitating", "artist": "Dua Lipa", "apple": 1234567890, "youtube": "VIDEO_ID_11"}]}
```

1. **List** about 1.2× the songs for the theme in a text file, one per line as `Title - Artist`
   (or YouTube links, which also give the reveal its video): ones most US 20-somethings would
   name from two seconds of the hook; studio originals only.
2. **Match**: `npm run match:songs -- <file>` (pass the network domains `itunes.apple.com`,
   `*.itunes.apple.com` and `www.youtube.com`). It prints the `songs` JSON on stdout and a report
   on stderr: ✓ sure, ? check it (with the other candidates), ✗ not found. Apple allows about 20
   calls a minute, so 40 songs take two or three minutes. For every `?` line, keep the right
   candidate or drop the song; never keep a live, karaoke, cover or remix version.
3. **Write** `src/content/song/<id>.json` with the songs. Keep `title` as the room would shout it
   and `artist` the main artist (features as "A ft. B"). Leave `start` out: the game picks the
   catchiest moment of each preview itself (set it, seconds into the preview, 0–19.5, only to
   fix a pick that is clearly wrong). `npm run match:songs -- --pack <file>` re-checks a pack in
   place and drops songs Apple has no preview for.
4. **Check**: `npm run test:content`, then `npm run check:songs` (every Apple id must still have
   a preview; every YouTube id must still be embeddable: remove a `youtube` it lists, or replace
   the song). Then publish and confirm as in steps 6 and 7, and name the songs you were least sure
   matched the right recording.

**Clip packs** (only when the owner asks for one): `npm run clip:songs -- <pack>` cuts a 12-second
clip of every song from its YouTube video (yt-dlp and ffmpeg, on this laptop) and writes one file,
`~/Data/party_games/clips/<pack-id>.clips.jerkbox.txt`, holding the pack and its clips. `<pack>` is
a built-in pack (`src/content/song/<id>.json`), an exported `.jerkbox.txt` pack file, or a
"Title - Artist" / link list. It finds a video when a song has none and starts each clip on the
moment the game would play from Apple's preview; `--at "Title=1:23"` sets a clip by hand. Network
domains: `www.youtube.com`, `*.youtube.com`, `*.googlevideo.com`, `i.ytimg.com`, `itunes.apple.com`,
`*.itunes.apple.com`, `*.mzstatic.com` (inside the agent sandbox also set `NODE_USE_ENV_PROXY=1`).
Check every `?` line of its report, then tell the owner the file's path: they import it on the host
phone with "Import packs" on Earworm setup, once. **A clip file holds copies of the recordings:
never commit it, put it in `public/` or the built site, or post it anywhere public.** It stays in
`~/Data`; `.gitignore` refuses `*.clips.jerkbox.txt` as a backstop.

### Don't Say It packs (`taboo/`)

Two teams; the describer gets their team to say the word without saying it or any of the five
banned words under it. Default size 60 cards. List what exists first (`npm run list -- taboo`):
a word must be new across *all* Don't Say It packs. Shape:

```json
{"id": "college-life", "name": "College Life", "blurb": "Dorms, finals and dining halls", "added": "2026-11-20", "cards": [{"word": "Dining hall", "banned": ["Food", "Eat", "Meal plan", "Cafeteria", "Tray"]}]}
```

Quality bar: words most of the room knows, 1–3 words, Title Case for names, sentence case
otherwise ("Road trip"); exactly 5 banned words of 1–3 words each, and they must be the
*obvious* clues (the first five things anyone would say), so the game is hard in the fun way.
No banned word may contain the word or sit inside it ("Pizza" cannot ban "Pizzas"); the gate
checks this with `src/games/taboo/cards.ts`. "After Dark": cheeky, never explicit.

### Brain Freeze packs (`quick/`)

A player has a few seconds to name 3 things that fit a prompt. Default size 60 prompts. List
what exists first (`npm run list -- quick`): a prompt must be new across *all* Brain Freeze
packs. The app shows "Name 3" in front of each prompt, so store only the rest:

```json
{"id": "college-life", "name": "College Life", "blurb": "Dorms, finals and dining halls", "added": "2026-11-20", "prompts": ["things in a dorm room", "excuses for missing class"]}
```

Quality bar: 2–8 words, starting lowercase (names keep their capitals inside: "songs by Taylor
Swift"), no "Name 3", no end punctuation. Easy to start, hard to finish in 5 seconds: everyone
knows at least three answers, but it is specific enough that people blank under pressure
("things you put on a hot dog", not "foods"; not "Oscar-nominated editors"). "After Dark":
cheeky, never explicit.

### Snark Tank packs (`snark/`)

Everyone writes a funny answer to a prompt on their own phone, then the room votes. Default
size 80 prompts. List what exists first (`npm run list -- snark`): a prompt must be new across
*all* Snark Tank packs. Shape:

```json
{"id": "college-life", "name": "College Life", "blurb": "Dorms, finals and dining halls", "added": "2026-11-20", "prompts": ["The worst thing to hear from your RA", "A terrible name for a dorm"]}
```

Quality bar: 3–14 words, sentence case, no end punctuation, original wording (never a
commercial game's prompts). Open-ended so there are a hundred funny answers, not one right one
("A terrible name for a boat", "What your dog is thinking during a thunderstorm"); nothing that
needs inside knowledge unless the pack is about the group. "After Dark": cheeky, never explicit.

Two optional fields (write both for a new pack unless asked not to; the game works without them):

```json
"safety": {"A terrible name for a dorm": "The Mold Hilton"},
"finals": [{"prompt": "Three things you should never say to your RA", "house": ["I live here now", "Smell that?", "Define fire hazard"]}]
```

- `safety`: a stock answer per prompt, keyed by the prompt exactly as written; players tap "Give
  me one" when stuck (half points if sent as is). Decent and mildly funny, never the best answer
  in the room; 1–8 words, sentence case, no end punctuation (80 characters at most).
- `finals`: prompts for the three-line duel final, each asking for three things ("Three …"),
  3–14 words, new across *all* Snark packs (the list shows existing finals) and never one of the
  regular prompts; `house` is exactly three lines the game plays against an odd player out, 1–6
  words each (40 characters at most), genuinely funny. About one final per five prompts.

### Word Salad packs (`salad/`)

Players describe a secret by filling blanks with word choices. Run `npm run list -- salad`
first. Answers and accepted variants must be unique across packs. The host can select built-in
packs in settings. Classic has 64 secrets, 16 in each category, with roughly a quarter easy,
half medium and a quarter hard. Use that mix for new packs so a room gets varied choices.

```json
{"id":"food-and-friends","name":"Food and Friends","blurb":"Familiar dishes and faces","added":"2026-11-20","secrets":[{"answer":"Taco","category":"thing","level":"easy","also":["Tacos"],"words":{"noun":["a shell","a tortilla","a handheld meal"],"adjective":["crunchy","folded","spicy"]}}]}
```

Categories are `person` (real or fictional), `place`, `thing` and `story` (film, show, book or
game). Write 3–8 fitting choices per slot you use, including every slot in that category's
opening frame in `src/games/salad/words.ts`. Include articles in nouns when needed, use base-form
verbs, and write places and times as phrases like “by a river” and “after dinner.” A clue choice
can never contain the answer or one of its words. Read your choices in the frames to hear how
they fit, and run `npm run test:content`.

### Doodle Brawl packs (`brawl/`)

Original titles for fighters in a drawing contest. List existing titles with
`npm run list -- brawl`. Put the pack in `src/content/brawl/<id>.json` as
`{"titles": ["World's okayest roommate"]}`. Use 2–8 words in sentence case and write
something specific and funny a player can draw. Titles must be unique across packs. A pack
needs at least 24 titles to run a full eight-player game on its own. After Dark is cheeky.
Run `npm run test:content`.

## Other changes

`worker/` is the wizard server for the magic words (Cloudflare Worker; `worker/README.md`). It
holds no secrets: the real phrases and its Anthropic key live only in Cloudflare, entered by the
owner. Never ask for them or put real ones anywhere; tests use obvious fakes. Check it with
`npm run worker:check` and `npm test`; the owner deploys it.

Follow `SPEC.md`. Keep each game in `src/games/<id>/`, shared code in `src/lib/` and
`src/components/`, colours and sizes in `src/styles/tokens.css`. Run all three checks before
pushing; every push goes live.
