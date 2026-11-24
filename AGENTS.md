# Jerk Box — instructions for coding agents

Party games web app (Svelte 5 + TypeScript + Vite PWA), published to
https://alexzgu.github.io/party-games/ by `.github/workflows/deploy.yml` on every push to `main`.
How the games work: `SPEC.md`. Names shown to players: `src/app.config.ts` only.

Checks: `npm run check` (types), `npm test` (unit tests + content gate), `npm run build`.
Content only: `npm run test:content`; list a game's existing items: `npm run list -- <folder>`.

## Making a new pack (the main live-content route)

Odd One Out plays Heads Down. packs and has none of its own: a pack for it is a Heads Down. pack.

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

- `safety`: a stock answer per prompt, keyed by the prompt exactly as written; players tap "Suggest" when stuck (half points if sent as is). Decent and mildly funny, never the best answer
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
`{"id": "<id>", "name": "...", "blurb": "...", "added": "...", "titles": ["World's okayest roommate"]}`. Use 2–8 words (60 characters at most) in sentence case, no closing . ! or ?, and write
something specific and funny a player can draw. Titles must be unique across packs. A pack
needs at least 24 titles to run a full eight-player game on its own (fewer players need fewer:
13 for three); a room with too few asks the host before adding titles from other packs. After Dark is cheeky.
Run `npm run test:content`.

### Would You Rather packs (`rather/`)

Questions with two choices; everyone picks a side. Default size 60 questions. List what exists
first (`npm run list -- rather`): a question must be new across *all* Would You Rather packs, and
the same two choices in the other order count as the same question. The app shows "Would you
rather" in front of each question, so store only the rest:

```json
{"id": "college-life", "name": "College Life", "blurb": "Dorms, finals and dining halls", "added": "2026-11-24T15:10", "prompts": ["live in the library or live in the dining hall", "retake your hardest final or redo freshman year"]}
```

Quality bar (`src/games/rather/rules.ts`): exactly one " or " joining two different choices,
each 1–12 words and 60 characters at most, the whole question 130 at most; starts lowercase
(names keep their capitals inside); never starts with "Would you rather"; no closing . ! or ?.
Both choices tempting or both awful, so the room splits about in half; specific and funny
beats vague; original wording, never copied from a commercial game. "After Dark": cheeky,
never explicit. Run `npm run test:content`.

### Smarty Pants packs (`trivia/`)

Multiple-choice trivia: everyone answers on their own phone, faster scores more. Default size 60
questions over at least 4 categories. List what exists first (`npm run list -- trivia`, which also
counts the categories in use): a question must be new across *all* Smarty Pants packs (the same
question text, ignoring case, spacing and punctuation, counts as the same question). Each question
is one line of six parts split by " | ": category, question, the right answer, three wrong answers
(the app shuffles the four):

```json
{"id": "college-life", "name": "College Life", "blurb": "Dorms, finals and dining halls", "added": "2026-11-24T18:30", "questions": ["Science | What gas do plants take in from the air? | Carbon dioxide | Oxygen | Nitrogen | Helium"]}
```

Quality bar (`src/games/trivia/rules.ts`): exactly six parts, none empty, and no part contains a
bar. Category 1–3 words, 24 characters at most, capital first (reuse a category already in use where
it fits). Question 3–30 words, 140 characters at most, capital first. Each answer 1–6 words and 40
characters at most, no closing full stop; the four answers all different. Exactly one right answer;
the wrong ones of the same kind and about the same length as the right one, so it never stands out.
Things most of the room could know or guess, easy to hard. Check every fact; leave out anything you
are not sure of or that may change (records, "current" holders, populations, prices, rankings).
Original wording, never copied from a quiz show or a commercial game. Run `npm run test:content`.

### Sketchy packs (`sketch/`)

Two lists for the drawing game. List what exists first (`npm run list -- sketch`): words and
ideas must be new across *all* Sketchy packs. Default size 100 words and 30 ideas.

```json
{"id": "college-life", "name": "College Life", "blurb": "Dorms, finals and dining halls", "added": "2026-11-21T15:40", "words": ["Bunk bed", "Ramen"], "ideas": ["A raccoon cramming for finals"]}
```

- `words` (Draw & guess: one player draws, the rest type guesses): 1–3 words, letters, spaces,
  hyphens and apostrophes only, 24 characters at most; things most of the room knows and could
  draw in 80 seconds on a phone (objects, animals, places, actions, famous things); ~60% easy,
  30% medium, 10% hard.
- `ideas` (Telephone: the line that starts a chain): 3–10 words, capital first, no end
  punctuation; a funny, specific scene someone can draw ("A cat filing its taxes").
- "After Dark": cheeky, never explicit. Run `npm run test:content`.

### Bad Hand packs (`hand/`)

Fill-in-the-blank cards: a judge reads a prompt and picks the funniest answer card played.
List what exists first (`npm run list -- hand`): prompts and answers must be new across *all*
Bad Hand packs. Default size 30 prompts and 120 answers (about four answers per prompt): 120
answers run a full room of ten on their own; a room with too few asks the host before adding
cards from other packs.

```json
{"id": "college-life", "name": "College Life", "blurb": "Dorms, finals and dining halls", "added": "2026-11-21T15:40", "prompts": ["My RA wrote me up for ___", "What got me through finals?", "___ and ___: the two pillars of dorm life"], "answers": ["A suspiciously large rice cooker", "Crying in the library stairwell"]}
```

Quality bar: original wording (never Cards Against Humanity's cards). A blank is exactly `___`;
at most two per prompt (about one prompt in six has two); a prompt with no blank is a question
ending "?". Answers are 1–10 words, sentence case, no closing full stop, 60 characters at most,
mostly noun phrases ("My dad's fantasy football league") so one answer fits many prompts. Edgy
and cheeky for adults, never explicit, no slurs and no punching down at groups. Run
`npm run test:content`.

## Other changes

`worker/` is the wizard server for the magic words (Cloudflare Worker; `worker/README.md`). It
holds no secrets: the real phrases and its Anthropic key live only in Cloudflare, entered by the
owner. Never ask for them or put real ones anywhere; tests use obvious fakes. Check it with
`npm run worker:check` and `npm test`; the owner deploys it.

Follow `SPEC.md`. Keep each game in `src/games/<id>/`, shared code in `src/lib/` and
`src/components/`, colours and sizes in `src/styles/tokens.css`. Run all three checks before
pushing; every push goes live.
