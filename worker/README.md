# The wizard server (magic words)

A small Cloudflare Worker that lets a friend use Fizzwick the Wizard by typing the party's
magic words in Settings, instead of opening an invite link. The phone gets a 30-day pass; the
Anthropic key stays on the server. Invite links keep working as before, with their own key.

What it does:

- `POST /redeem` with `{"phrase": "..."}` checks the words against the `PARTY_PHRASES` secret and
  answers with a pass. Case, punctuation and extra spaces don't matter.
- `POST /v1/messages` acts like the Anthropic API for the app: it checks the pass, allows only
  what the app sends (the models in `src/lib/wizard.ts`, plain text, at most 8,000 output
  tokens, at most 64 KB, no betas and no model fallback, so each request is one model run),
  counts the request against the daily allowance, then forwards it with the server's key
  (never following a redirect) and streams the answer back.
- Everything else is 404. Only the published site and local dev may call it from a browser.
- It logs nothing: no words, passes, keys or request bodies.

Limits (in `src/limits.ts`; edit and redeploy to change):

| Limit | Value |
|---|---|
| Wrong guesses from one address | 10 per 15 minutes |
| Wrong guesses from everyone together | 300 per hour |
| Right phrases from one address | 20 per day (UTC) |
| Wizard requests, everyone together | 300 per day (UTC): the real cap |
| Wizard requests from one phone's pass | 60 per day (UTC): a soft cap |
| Pass lifetime | 30 days |

Every guess is counted before it is checked, and right ones are given back. So strangers'
wrong guesses can slow friends down too; the guess limits are set high enough that this takes
real effort, and a phrase of 3 dice words still takes centuries to guess at 300 an hour.
The per-phone cap is soft: saying the words again gives a fresh pass with a fresh 60, which is
why right phrases are capped per address and the party-wide 300 is what really limits spending.
A party on one Wi-Fi shares one address, hence the room for 20. Requests the API refuses are
given back, on the day they were reserved only.

## Setting it up (the owner, once)

No secret ever goes into this repo or to an AI chat. You type them into Cloudflare yourself.

1. **Cloudflare account.** Sign up free at <https://dash.cloudflare.com/sign-up>. The free
   Workers plan is enough.
2. **A separate Anthropic key with a spending cap.** In the Claude Console
   (<https://platform.claude.com>): Settings → Workspaces → Create workspace (e.g. "Jerk Box
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
   - `PARTY_PHRASES`: the magic words, one phrase per line, or several on one line separated by commas (see below).

   Save and deploy. (Or in your own terminal: `npx wrangler@4.165.0 secret put ANTHROPIC_API_KEY`,
   which asks for the value without showing it. The phrase list has several lines, so the
   dashboard is easier for that one.)
5. **Tell the app where the server is.** Put the address from step 3 (no slash at the end) in
   `WIZARD_SERVER` in `src/lib/wizardServer.ts`, or tell a chat the address and ask it to do it,
   then push. The address is not secret. Until it is set, the magic words appear nowhere in the app.

## Choosing the magic words

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
pass expired. Say the magic words again." Replacing `ANTHROPIC_API_KEY` ends every pass at once.

## When the app changes

The server takes its model list and token cap from `src/lib/wizard.ts` when it is
deployed. After those change (e.g. a new effort level), run `npx wrangler@4.165.0 deploy` again
from this folder, or the new choice gets "That model is not available here."

If you open the dev site from a phone on your Wi-Fi (`http://192.168.x.x:5173`), add that
address to `ALLOWED_ORIGINS` in `wrangler.toml` and redeploy.

## For developers

- Code: `src/index.ts` (routes), `phrase.ts`, `token.ts`, `validate.ts`, `http.ts` (CORS,
  errors), `limits.ts` (pure counters), `limitsObject.ts` (the Durable Object storing them).
- Checks from the repo root: `npm run worker:check` (types) and `npm test` (the worker's tests
  run with the app's, against a fake env, fake key and fake phrases, with no network).
- The phone uses the Anthropic SDK with this server as `baseURL`. SDK 1.10 sends the pass as
  `Authorization: Bearer <pass>`; `x-api-key` is accepted too. The server forwards with
  `x-api-key: <server key>` and drops the phone's pass.
- On 401 and 429 the server sets `x-wizard-reason` (401: `expired`, `revoked`, `invalid`;
  429: `guesses`, `redeems`, `phone`, `party`) so the app can say which it was.
