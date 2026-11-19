# Jerk Box — instructions for coding agents

Party games web app (Svelte 5 + TypeScript + Vite PWA), published to
https://alexzgu.github.io/party-games/ by `.github/workflows/deploy.yml` on every push to `main`.
How the games work: `SPEC.md`. Names shown to players: `src/app.config.ts` only.

Checks: `npm run check` (types), `npm test` (unit tests + content gate), `npm run build`.
Content only: `npm run test:content`; list a game's existing items: `npm run list -- <folder>`.

## Making a new pack (the main live-content route)

The owner, or a friend at the party, asks a chat for a pack, e.g. "make a Spectrum pack about
our college" or "Heads Down. deck: 2000s cartoons, 60 words". You write it as a built-in pack,
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
2. **Size** if not given: Heads Down. 60 words, Spectrum 40 cards, Inn Co Hear Ant 40 cards.
   **List what exists first**: `npm run list -- <folder>` prints every word, scale or answer
   already in that game (and, for Inn Co Hear Ant, the hint categories in use). Spectrum
   scales and Inn Co Hear Ant answers must be new across *all* packs of that game, not just
   similar ones; Heads Down. words only need to be new within the deck.
3. **Write** `src/content/<folder>/<id>.json`. `id` is a new lowercase slug (`college-life`),
   never an existing file's id. Exact shapes:

   ```json
   {"id": "cartoons-2000s", "name": "2000s Cartoons", "emoji": "📺", "blurb": "Saturday mornings, 2000–2009", "added": "2026-11-21T15:40", "words": ["SpongeBob", "..."]}
   {"id": "college-life", "name": "College Life", "blurb": "Dorms, finals and dining halls", "added": "2026-11-21T15:40", "cards": [{"left": "Easy class", "right": "Hard class"}]}
   {"id": "tv-mix", "name": "TV Mix", "blurb": "Shows everyone watched", "added": "2026-11-21T15:40", "cards": [{"phrase": "Grey Sat Tommy", "answer": "Grey's Anatomy", "hint": "TV Show"}]}
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
   - "After Dark" style requests: cheeky, never explicit.
5. **Check**: `npm run test:content` (the content gate in `src/lib/content.test.ts` rejects
   bad shapes, repeats within a deck, any Spectrum scale or Inn Co Hear Ant answer that already
   exists in another pack, and phrases containing the answer's words; it lists every problem in
   one run). Fix them all and rerun until it passes. A pack-only change needs nothing else.
6. **Publish**: `git add src/content && git commit -m "Add <game> pack: <name>"` then `git push`.
   If the push is refused for lack of GitHub credentials, ask the owner to run `! git push`
   in the chat.
7. **Confirm** it went live: poll
   `curl -s https://api.github.com/repos/alexzgu/party-games/actions/runs` until the newest run
   for your commit is `completed` / `success` (about 1–2 minutes), then tell the asker:
   "Live. Go back to the main menu, wait a moment, then open <game> and tick <pack name> in
   the pack list." Mention the 3 to 5 items you are least sure about.

## Other changes

Follow `SPEC.md`. Keep each game in `src/games/<id>/`, shared code in `src/lib/` and
`src/components/`, colours and sizes in `src/styles/tokens.css`. Run all three checks before
pushing; every push goes live.
