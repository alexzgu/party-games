# The wizard server (magic words)

A small Cloudflare Worker that lets a friend use Fizzwick the Wizard by typing the party's
magic words where the app asks for them (Settings, or any make page), instead of opening an
invite link. The phone gets a 30-day pass; the Anthropic key stays on the server. Invite links
keep working as before, with their own key.

What it does:

- `POST /redeem` with `{"phrase": "..."}` checks the words against the `PARTY_PHRASES` secret and
  answers with a pass. Case, punctuation, symbols and extra spaces don't matter. Each word typed
  is its own guess, and so is the whole phrase when there are two or more words: "I aM noT!!!??
  drunk." is checked as "i am not drunk", "i", "am", "not" and "drunk", and gets in if any one
  of them is a magic word. A repeated word counts once; past 12 guesses the rest are ignored.
  A phrase of several words in the secret still works when typed whole, but never by one of its
  words.
- `POST /v1/messages` acts like the Anthropic API for the app: it checks the pass, allows only
  what the app sends (the models in `src/lib/wizard.ts`, plain text, at most 8,000 output
  tokens, at most 64 KB, no betas and no model fallback, so each request is one model run),
  counts the request against the daily allowance, then forwards it with the server's key
  (never following a redirect) and streams the answer back.
- `/library/…` is the Community pack library (below).
- Everything else is 404. Only the published site and local dev may call it from a browser.
- It logs nothing: no words, passes, keys or request bodies.

Limits (in `src/limits.ts`; edit and redeploy to change):

| Limit | Value |
|---|---|
| Guesses checked from one try (each word, plus the whole phrase) | 12 at most |
| Guesses from one address (an IPv4 address, or an IPv6 /64) | 60 per minute |
| Guesses from everyone together | 600 per minute |
| Once those 600 are used: guesses from addresses that made none in the last minute | 100 per minute in all, at most 10 per network (IPv6 /48 or IPv4 /24) |
| Right phrases from one address | 20 per day (UTC) |
| Wizard requests, everyone together | 300 per day (UTC): a request allowance, not a money cap |
| Wizard requests from one phone's pass | 60 per day (UTC): a soft cap |
| Pass lifetime | 30 days |

Guessing the words is meant to be a party game of its own, so the guess limits sit far above
any human pace (one guess a second from one address, kept up for a whole minute) and only stop
scripts. Every guess is counted before it is checked, so a try of four words uses five (the
four words and the whole phrase); a right try gives back all of its guesses. An address with
fewer guesses left than its try holds gets only that many checked, in order (the whole phrase
first, then the words). An address past its own 60 a minute gets nothing checked until the
minute has passed. A stranger can use up everyone's 600 a minute, but a phone whose address has
made no guess in the last minute still gets its words checked, out of a separate 100 a minute
(at most 10 from one network, so a try of four words uses five of that network's ten); right
words given that way are given back too. The wait the server gives is when a limit that applies
to that address opens again, at most a minute.

At the maximum, everyone together can try 700 guesses a minute, about a million a day; packing
many words into one try gains a script nothing, since each word is a guess. Because each word
is checked on its own, a magic word that is a single word is found by a script within hours;
the owner accepts that for a one-day party (change the words after it, or use a phrase of two
or three random words, typed whole, if they must hold for longer). Guessing at that rate would
also use up the free Cloudflare plan's daily Durable Object allowance, which stops the wizard
until the next UTC day; the owner accepts that too.

Phrase strength at about a million guesses a day: every word of a 100,000-word dictionary falls
within hours, a common word much sooner; two dice words typed whole (about 60 million phrases)
take up to about two months; three (about 470 billion) over a thousand years.

The per-phone cap is soft: saying the words again gives a fresh pass with a fresh 60, which is
why right phrases are capped per address and the party-wide 300 limits requests. It is not a
money cap: the Anthropic workspace spend limit (setup step 2) is. Only answers known to cost
nothing are given back (the API refused the request, a 4xx, or was overloaded, a 529), on the
day they were reserved only; a connection that failed after sending, or another 5xx, stays
counted, since the API may have run it. A party on one Wi-Fi shares one address, hence the
room for 20.

Refused guesses and requests write nothing to the counters' storage. On the free plan,
Cloudflare caps a whole account's Worker requests (100,000 a day) and Durable Object requests
and writes per day, resetting at 00:00 UTC; someone sending that much traffic stops the wizard
for everyone until then, passes included. Nothing in the Worker prevents that; the Workers
Paid plan, or turning the wizard off, does.

## The Community library

Packs Fizzwick makes on a phone with a pass are published here automatically, and a player can
share any of their own packs by hand from its editor (with a pass, through the same publish
route); anyone can browse them, preview one and import it; starring needs a pass. They are kept for good, in a second
SQLite-backed Durable Object, `Library` (`src/libraryObject.ts`, migration `v2`; the counters'
`Limits` object is untouched). It stores each pack's game, name, description, item count, items,
times, stars, a hidden flag and the sharing phone's username (when it sent a good one), plus a one-way label of the pass that published it and that
phone's id for the pack (so an "Add more" updates the same entry); stars are kept as
(pack, pass label) pairs, one per pass per pack. Nothing else about the phone is stored.

| Route | Who | What |
|---|---|---|
| `POST /library/packs` | pass | Publish `{game, name, blurb, localId, items, extra, username}`, or update the entry this pass made with that `localId`. Other fields are ignored. `game`: forehead, dial, gibberish, quick, quiz, taboo or snark; name 1–60 characters, description up to 140; items rebuilt from that game's own fields only (`src/lib/libraryShape.ts`, shared with the app; anything else is dropped), at most 400 (Big Board: 8 categories of 10 tiles) and 64 KB with `extra` (a Heads Down. icon, kept only when it is exactly one character of at most 32 UTF-16 units, `src/lib/icon.ts`; Snark Tank stock answers for its own prompts and finals of exactly three house lines, both checked). A broken item is a 400. `username` is optional: control and invisible characters dropped, spaces collapsed and trimmed, then kept only when 1–24 characters (`src/lib/usernameShape.ts`, shared with the app); anything else (missing, not text, too long, empty) is dropped, never a reason to refuse the pack. An update stores the username it was sent with. |
| `GET /library/packs?game=&q=&sort=stars\|new&page=` | anyone | 30 a page, hidden packs left out: id, game, name, description, count, stars, times, `username` (only on packs that have one), and `more`. `q` matches the name or description (never the username) (any case, plain text), looking through the first 2,000 packs of the order; pages stop at 100. Most stars first, newest among equals; `sort=new` newest first. With a pass, each pack also says whether that pass starred it. |
| `GET /library/packs/:id` | anyone | The whole pack, for preview and import, with its `username` when it has one. |
| `POST` / `DELETE /library/packs/:id/star` | pass | Star it, or take the star back; answers the new count. The same vote again writes nothing. |
| `GET /library/export?after=` | anyone | Every pack not hidden, with its items (and username, when it has one), for your backups (everything in it is public anyway), 16 a page in the order they were first shared: `{"packs": [...], "next": "<cursor>"}`; ask again with `after=<next>` until `next` is `null`. A page stays near 1 MB at most. |
| `POST /library/packs/:id/hide` | `LIBRARY_ADMIN` | Body exactly `{"hidden": true}`, or `{"hidden": false}` to show it again; any other body changes nothing (over 256 bytes: 413). |

Limits: 40 publishes (new or updated) per pass per UTC day, and 600 per day from everyone
together; past either the server answers 429 with `x-wizard-reason: library`. A pass label is
per pass, so a friend who says the words again gets a new one (and their next "Add more"
starts a new entry); the 20 passes a day per address keep that bounded, and the same holds for
stars.

**Backups.** The export comes a page at a time; this, in your own terminal, follows every page
and writes one file (put the server's address in place of `<the server's address>`):

```sh
node -e '
const base = process.argv[1], packs = [];
(async () => {
  let after = "";
  do {
    const page = await (await fetch(base + "/library/export" + (after ? "?after=" + after : ""))).json();
    packs.push(...page.packs);
    after = page.next || "";
  } while (after);
  console.log(JSON.stringify({ packs }));
})();' https://<the server's address> > partybox-library-$(date +%F).json
```

**Hiding a pack.** Hiding is off until you add the optional secret `LIBRARY_ADMIN`: in
`~/Projects/party_games/worker`, run `npx wrangler@4.165.0 secret put LIBRARY_ADMIN` and type a
long random value (one word, no spaces; your password manager can make one) when it asks. Keep it
in your password manager; never paste it into a chat. Then, in your own terminal, with the pack's
id (from the export):

```sh
bash -c 'IFS= read -rsp "LIBRARY_ADMIN: " s; echo; printf "Authorization: Bearer %s\n" "$s" |
  curl -s -H @- -d "{\"hidden\": true}" "https://SERVER/library/packs/PACK/hide"'
```

Put the server's address for SERVER and the pack's id for PACK. It asks for the secret without showing it, so it stays out of the shell history and the list of running commands.
Put `{\"hidden\": false}` there instead to show it again. Without the secret, every hide is refused. A hidden
pack disappears from the list, the preview and the export, and stays hidden when its phone
updates it.

## Setting it up (the owner, once)

No secret ever goes into this repo or to an AI chat. You type them into Cloudflare yourself.

1. **Cloudflare account.** Sign up free at <https://dash.cloudflare.com/sign-up>. The free
   Workers plan is enough.
2. **A separate Anthropic key with a spending cap.** In the Claude Console
   (<https://platform.claude.com>): Settings → Workspaces → Create workspace (e.g. "Party Box
   wizard"). Open that workspace's limits and set a monthly spend limit you are happy to lose
   (e.g. $10). Then Settings → API keys → Create key, and pick that workspace. Copy the key into
   your password manager; don't paste it into any chat. Use this key only here, never in an
   invite link, so the server's limits can't be bypassed with it.
3. **Deploy the server.** In your own terminal:

   ```sh
   cd ~/Projects/party_games/worker
   npx wrangler@4.165.0 login
   npx wrangler@4.165.0 deploy
   ```

   It prints the server's address, like `https://jerkbox-wizard.<your-name>.workers.dev`.
4. **Add the two secrets.** In the Cloudflare dashboard: Workers & Pages → `jerkbox-wizard` →
   Settings → Variables and Secrets → Add. Choose type **Secret** each time:
   - `ANTHROPIC_API_KEY`: the key from step 2.
   - `PARTY_PHRASES`: the magic words, one per line, or several on one line separated by commas (see below). A single word works: it matches any one word a friend types. Case and punctuation don't matter.

   Save and deploy. (Or in your own terminal: `npx wrangler@4.165.0 secret put ANTHROPIC_API_KEY`,
   which asks for the value without showing it. The phrase list has several lines, so the
   dashboard is easier for that one.)
5. **Tell the app where the server is.** Put the address from step 3 (no slash at the end) in
   `WIZARD_SERVER` in `src/lib/wizardServer.ts`, or tell a chat the address and ask it to do it,
   then push. The address is not secret. Until it is set, the app asks for no magic words: the box only takes the host's own key.

## Choosing the magic words

Single words are the easy party choice: a friend gets in by saying any sentence with one of them
in it. They are also easy for a script to find (see above). For words that must hold longer:

- Use dice and the EFF large word list
  (<https://www.eff.org/files/2016/07/18/eff_large_wordlist.txt>): roll five dice, read them as
  a five-digit number, and take that word. Do it 3 times for a phrase (4 if it will travel far),
  e.g. the made-up example "otter velvet lantern".
- Don't invent words, use lyrics or inside jokes: those are what a guesser tries first.
- Keep to a few phrases: each extra one is another chance for a guesser.
- Share them in person or privately. Never put them in a link, a screenshot or a chat with an AI.

## Changing or removing words

Edit `PARTY_PHRASES` in the dashboard (Variables and Secrets → edit → save and deploy). Phones
that came in with a removed phrase stop working on their next request and are told "The magic
words have changed. Ask the host for the new ones." A pass older than 30 days gets "Fizzwick's
pass expired. Say the magic words again." Replacing `ANTHROPIC_API_KEY` ends every pass at once
(passes are signed with a key made from it), but the words stay the same: each phone is told
"Fizzwick forgot this phone. Say the magic words again.", forgets its pass, and the
same words give it a new one.

## When the app changes

The server takes its model list and token cap from `src/lib/wizard.ts` when it is
deployed. After those change (e.g. a new effort level), run `npx wrangler@4.165.0 deploy` again
from this folder, or the new choice gets "That model is not available here."

Usernames on Community packs need a deploy from after they were added; either order is safe.
The live server ignores fields it does not know, so the new app's `username` is simply not kept
until then (its packs show no name). The new server, on its first request, adds a `username`
column to the stored packs (no migration step to run; existing packs get none) and takes packs
from older apps, which send no username, as before; older apps ignore the username in listings.

The Community library exists only once a deploy that includes it has run (it creates the
`Library` object, migration `v2`). Until then the app's Community list says the library is
having trouble, and each wizard pack saved through a pass leaves the note "Couldn't share to the
library".

If you open the dev site from a phone on your Wi-Fi (`http://192.168.x.x:5173`), add that
address to `ALLOWED_ORIGINS` in `wrangler.toml` and redeploy.

## For developers

- Code: `src/index.ts` (routes), `pass.ts` (checking a pass), `library.ts` (what a shared pack
  may hold, list requests), `libraryRoutes.ts` (the `/library` routes), `libraryObject.ts` (the
  Durable Object storing packs and stars in SQLite), `phrase.ts` (normalising, splitting a try into guesses, matching), `token.ts`, `validate.ts`, `http.ts` (CORS,
  errors), `address.ts` (which address and network a guess counts against, from
  `cf-connecting-ip`, stored only as one-way labels), `limits.ts` (pure counters),
  `limitsObject.ts` (the Durable Object storing them; it runs one request at a time, so each
  check-and-count is atomic).
- Checks from the repo root: `npm run worker:check` (types) and `npm test` (the worker's tests
  run with the app's, against a fake env, fake key and fake phrases, with no network; the
  library runs on Node's own in-memory SQLite in place of the Durable Object's).
- The phone uses the Anthropic SDK with this server as `baseURL`. SDK 1.10 sends the pass as
  `Authorization: Bearer <pass>`; `x-api-key` is accepted too. The server forwards with
  `x-api-key: <server key>` and drops the phone's pass.
- On 401 and 429 from its own checks the server sets `x-wizard-reason` (401: `expired`,
  `revoked`, `invalid`; 429: `guesses`, `redeems`, `phone`, `party`, `library`) so the app can say which
  it was. A 429 from Anthropic itself is passed on without one, and the app says Fizzwick is
  busy, not that the allowance is used up. Only `revoked`
  means the words changed; `invalid` (a pass signed with a replaced key, or junk) and `expired`
  mean "say the words again".
- Anything that fails unexpectedly (the Durable Object, say) is answered with a JSON 500 that
  carries the usual CORS headers and `x-wizard-reason: server` and no details, so the phone says
  "Fizzwick's tower is having trouble. Try again in a little while." instead of blaming its
  internet connection.
