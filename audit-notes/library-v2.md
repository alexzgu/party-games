1. **Earlier blockers**
   - **Unpaged export — fixed.** Each response contains at most 16 packs. The next page starts after the last pack’s creation time and ID, and the outer Worker forwards the response body directly (`worker/src/libraryObject.ts:43`, `worker/src/libraryObject.ts:104`, `worker/src/libraryObject.ts:111`, `worker/src/libraryRoutes.ts:123`).
   - **Arbitrary stored fields and deep snapshots — fixed.** The Worker and app rebuild items and extras from bounded, per-game fields before storage or preview. Import uses the validated pack directly (`src/lib/libraryShape.ts:77`, `src/lib/libraryShape.ts:93`, `worker/src/library.ts:67`, `src/lib/library.ts:122`, `src/components/Community.svelte:125`).
   - **Host-key Big Board draft — fixed for resume and first save.** Generation records which credential it used, the draft retains that decision, and first save checks it (`src/games/quiz/MakeBoard.svelte:70`, `src/games/quiz/MakeBoard.svelte:77`, `src/games/quiz/BoardEditor.svelte:137`).

2. **Blocking privacy regression.** Saving a Big Board discards its `byPass` flag. A later pass-funded **Add more** checks only the new clues and publishes the entire board, including the original host-key clues. Brain Freeze likewise publishes existing private prompts when merging into a saved pack. Both violate `SPEC.md:145–148` (`src/games/quiz/BoardEditor.svelte:134–137`, `src/components/AddMore.svelte:69`, `src/games/quiz/BoardEditor.svelte:109–110`, `src/games/quick/Make.svelte:105–109`).

   Both 401 handlers clear only the rejected pass (`src/lib/library.ts:79`, `src/lib/claude.ts:64`). No additional blocker found in export paging, field validation, or single-character icons (`src/lib/icon.ts:31`). Dependency installation succeeded, all 520 tests passed, and both requested type checks passed locally.

3. **SAFE TO DEPLOY THE WORKER AND PUSH THE APP: No.** A pass-funded edit can make a previously private pack public.
