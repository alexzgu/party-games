<script lang="ts">
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import Segmented from '../../components/Segmented.svelte';
  import PackPicker from './PackPicker.svelte';
  import { snarkPacks } from '../../lib/content';
  import { ANSWER_CHOICES, VOTE_CHOICES, type FinalStyle } from './logic';
  import { loadSettings, saveSettings } from './store';
  import { host } from './host.svelte';

  // The room's settings, changed from the lobby: rounds, timers and prompt packs. Saved on
  // this device for next time; a game already started keeps the settings it started with.
  let { onback, onedit, onmake }: { onback: () => void; onedit: (id: string) => void; onmake: () => void } = $props();

  let packs = $state.raw(snarkPacks());
  const s = host.game?.settings ?? loadSettings();
  let rounds = $state<2 | 3>(s.rounds);
  let answerSecs = $state(s.answerSecs);
  let voteSecs = $state(s.voteSecs);
  let final = $state<FinalStyle>(s.final ?? 'everyone');
  // svelte-ignore state_referenced_locally
  let selected = $state(s.packIds.filter((id) => packs.some((p) => p.id === id)));
  const locked = host.game !== null && host.game.phase !== 'lobby';

  $effect(() => {
    const next = { rounds, answerSecs, voteSecs, packIds: $state.snapshot(selected), final };
    saveSettings(next);
    host.settings(next);
  });
  // Duels need finals; packs without any borrow Classic's (logic falls back to the 3-vote final if there are none at all).
  const ownFinals = $derived(packs.some((p) => selected.includes(p.id) && p.finals?.length));
  const prompts = $derived(packs.filter((p) => selected.includes(p.id)).reduce((n, p) => n + p.prompts.length, 0));
</script>

<Screen title="Game settings" {onback}>
  {#if locked}<p class="note">A game is running: these apply to the next one.</p>{/if}
  <section class="opts">
    <div class="opt">
      <span class="label">Rounds</span>
      <Segmented label="Rounds" bind:value={rounds} options={[{ value: 2, label: '2' }, { value: 3, label: '3' }]} />
      <span class="hint">{rounds === 3 ? 'Round 1, round 2 (double points), then the final.' : 'Round 1, then the final.'}</span>
    </div>
    <div class="opt">
      <span class="label">Seconds to write</span>
      <Segmented label="Seconds to write" bind:value={answerSecs} options={ANSWER_CHOICES.map((v) => ({ value: v as number, label: `${v}` }))} />
    </div>
    <div class="opt">
      <span class="label">Seconds to vote</span>
      <Segmented label="Seconds to vote" bind:value={voteSecs} options={VOTE_CHOICES.map((v) => ({ value: v as number, label: `${v}` }))} />
      <span class="hint">The final vote gets twice as long.</span>
    </div>
    <div class="opt">
      <span class="label">Final round</span>
      <Segmented label="Final round" bind:value={final} options={[{ value: 'everyone', label: 'Everyone, 3 votes' }, { value: 'duels', label: 'Three-line duels' }]} />
      <span class="hint">{final === 'duels'
        ? `Players pair off and each writes up to three short lines; with an odd number, last place takes on the house.${ownFinals ? '' : ' The picked packs have no duel prompts, so Classic’s are used.'}`
        : 'One prompt for everyone; each player spreads 3 votes over the other answers.'}</span>
    </div>
  </section>
  <PackPicker {packs} bind:selected {onmake} {onedit} onimported={() => (packs = snarkPacks())} />
  <p class="faint">{prompts} prompts picked. Each game deals ones this device has not shown lately.</p>
  {#snippet actions()}
    <Button size="lg" onclick={onback} disabled={selected.length === 0}>{selected.length ? 'Done' : 'Pick at least one pack'}</Button>
  {/snippet}
</Screen>

<style>
  .opts { display: flex; flex-direction: column; gap: var(--s-3); }
  .opt { display: flex; flex-direction: column; gap: var(--s-2); background: var(--surface); border-radius: var(--r-md); padding: var(--s-3) var(--s-3) var(--s-3) var(--s-4); }
  .label { font-weight: 700; }
  .hint { color: var(--text-faint); font-size: 0.88rem; }
  .note { padding: var(--s-3) var(--s-4); border-radius: var(--r-md); background: color-mix(in srgb, var(--c-pass) 14%, var(--surface)); font-weight: 600; }
</style>
