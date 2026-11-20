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

### Earworm song packs (`song/`), made only by a Claude Code chat on this laptop

Earworm plays a few seconds of each song from YouTube on the host phone; a pack holds only
titles, artists, YouTube video ids and start seconds (never audio or video files). These packs
need `yt-dlp` and network access, so they are made by a chat on the owner's laptop, not on a
phone. Default size 35 songs (30–40). Run `npm run list -- song` first: a video id, or the same
title by the same lead artist, may appear in only one song pack.

```json
{"id": "pop-2020s", "name": "2020s Pop", "blurb": "The last few summers", "added": "2026-11-20", "songs": [{"title": "Levitating", "artist": "Dua Lipa", "youtube": "VIDEO_ID_11", "start": 52}]}
```

- **Songs**: ones most US 20-somethings would name from a few seconds of the hook. Title as
  the artist releases it; `artist` the main artist, features as "A ft. B".
- **Video id**: `yt-dlp --flat-playlist --print "%(id)s %(title)s %(channel)s" "ytsearch5:<artist> <title> official"`.
  Prefer the artist's own channel or VEVO (official video), else the official audio ("- Topic").
  Never lyric, live, cover, sped-up, fan or re-upload videos.
- **Start** (`start`, whole seconds): the hook, normally the first chorus. Read the "most
  replayed" heatmap: `yt-dlp --skip-download --print "%(heatmap)j" -- <id>` gives bins of
  `start_time` and `value`. Ignore the first ~10% of the video (everyone starts there, so it is
  always high) and take the start of the clearest rise to a peak after it (the chorus starts
  where the replays jump), not the bin where the value is highest. No heatmap: estimate the
  first chorus and say so. YouTube rate-limits metadata requests: look videos up one at a time
  with a few seconds between them.
- **Check**: `npm run test:content` (ids are 11 characters, starts are whole seconds, no repeats
  across song packs), then `npm run check:songs` (asks YouTube whether every video may play
  inside another site; replace each one it lists and rerun until none are left). Then publish
  and confirm as in steps 6 and 7, and name the songs whose start you estimated.

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

## Other changes

`worker/` is the wizard server for the magic words (Cloudflare Worker; `worker/README.md`). It
holds no secrets: the real phrases and its Anthropic key live only in Cloudflare, entered by the
owner. Never ask for them or put real ones anywhere; tests use obvious fakes. Check it with
`npm run worker:check` and `npm test`; the owner deploys it.

Follow `SPEC.md`. Keep each game in `src/games/<id>/`, shared code in `src/lib/` and
`src/components/`, colours and sizes in `src/styles/tokens.css`. Run all three checks before
pushing; every push goes live.
