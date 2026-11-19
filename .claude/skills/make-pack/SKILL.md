---
name: make-pack
description: Make a new card pack for Jerk Box (Heads Down., Spectrum or Inn Co Hear Ant) or a new Big Board quiz board from a theme or topic, and publish it to the live site. Use when someone asks for a new deck, pack, cards, words or quiz board for one of the party games.
---

Follow "Making a new pack" in AGENTS.md at the repository root, all seven steps, end to end:
pick the game, write `src/content/<folder>/<id>.json`, meet the quality bar, pass `npm run test:content`,
commit, push, and confirm the deploy went live. Arguments, if given, are the request
(game, theme, size), e.g. `/make-pack spectrum: our college, 40 cards`.
