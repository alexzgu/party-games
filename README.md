# Jerk Box

Party games for one phone and a loud room: **Heads Down.** (forehead word guessing),
**Spectrum** (team dial guessing) and **Inn Co Hear Ant** (gibberish phrases). A web app that
installs to the home screen on iPhone and Android and works offline once loaded.

Play: https://alexzgu.github.io/party-games/

## Develop

```sh
npm install
npm run dev        # http://localhost:5173, also on your LAN
npm run check      # types
npm test           # unit tests
npm run build      # static site in dist/
```

Every push to `main` builds, tests and publishes to GitHub Pages (`.github/workflows/deploy.yml`).

## Content

Built-in packs are JSON in `src/content/` (formats in `src/lib/content.ts`). Players can make
their own packs on the phone, by hand or with Claude: paste an Anthropic API key in Settings.
The key stays in that phone's browser storage and is sent only to Anthropic.

See [SPEC.md](SPEC.md) for how each game works.
