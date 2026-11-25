<script lang="ts">
  import { untrack } from 'svelte';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import Segmented from '../../components/Segmented.svelte';
  import PackList from '../../components/PackList.svelte';
  import RulesCard from '../../components/RulesCard.svelte';
  import { settingsSummary } from './settingsSummary';
  import { packEntry } from './find';
  import { snarkPacks } from '../../lib/content';
  import { ANSWER_CHOICES, DEFAULT_SETTINGS, MIN_PLAYERS, VOTE_CHOICES, present, type FinalStyle } from './logic';
  import { roomPrompts } from './room';
  import { keptPicks, nameList } from '../../lib/lend';
  import { loadSettings } from './store';
  import { host } from './host.svelte';

  // The room's settings, changed from the lobby: prompt packs on the page, rounds and timers behind
  // the Rules row over Done (the same shape as every setup). Saved on this device for next time; a
  // game already started keeps the settings it started with.
  let { onback, onedit, onmake }: { onback: () => void; onedit: (id: string) => void; onmake: () => void } = $props();

  let packs = $state.raw(snarkPacks());
  const s = host.game?.settings ?? loadSettings();
  let rounds = $state<2 | 3>(s.rounds);
  let answerSecs = $state(s.answerSecs);
  let voteSecs = $state(s.voteSecs);
  let final = $state<FinalStyle>(s.final ?? 'everyone');
  // svelte-ignore state_referenced_locally
  let selected = $state(keptPicks(packs, s.packIds, DEFAULT_SETTINGS.packIds));
  const locked = host.game !== null && host.game.phase !== 'lobby';

  // Saves (on this device, and into the lobby's game) whenever a choice changes. host.settings
  // reads and writes host.game, so it runs untracked: tracking it would re-run this on its own write.
  $effect(() => {
    const next = { rounds, answerSecs, voteSecs, packIds: $state.snapshot(selected), final };
    untrack(() => host.settings(next));
  });
  // What the room would deal with these picks for the players in the lobby (at least three): the
  // same prompts and finals Start uses, and the packs Start would ask to borrow from when they are too few.
  const players = Math.max(MIN_PLAYERS, host.game ? present(host.game).length : 0);
  const room = $derived(roomPrompts(packs, { packIds: selected, rounds, final }, players));
  /** Why the room cannot start with these packs, or ''. */
  const missing = $derived(!selected.length ? 'Pick packs' : room.problem);
</script>

<Screen fill title="Game settings" {onback}>
  <PackList game="snark" entries={packs.map(packEntry)} bind:selected title="Prompt packs" noun="prompts" placeholder="Search packs and prompts"
    makeHint="Paste a list or ask the wizard" keepOnImport {onedit} {onmake} onimported={() => (packs = snarkPacks())}>
    {#snippet notice()}
      {#if locked}<p class="note">A game is running: these apply to the next one.</p>{/if}
      {#if !missing && room.ask}<p class="note">{room.ask.short} The game will ask before adding {room.ask.noun} from {nameList(room.ask.lenders)}.</p>{/if}
    {/snippet}
  </PackList>
  {#snippet actions()}
    <RulesCard compact summary={settingsSummary(rounds, answerSecs, voteSecs, final)}>
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
        <Segmented label="Final round" bind:value={final} options={[{ value: 'everyone', label: 'Everyone, 3 votes', tip: 'One prompt for all; each player gives three votes' }, { value: 'duels', label: 'Three-line duels', tip: 'Players pair off and each writes three short lines' }]} />
        <span class="hint">{final === 'duels'
          ? 'Players pair off and each writes up to three short lines; with an odd number, last place takes on the house.'
          : 'One prompt for everyone; each player spreads 3 votes over the other answers.'}</span>
      </div>
      <p class="faint">Each game deals prompts this device has not shown lately.</p>
    </RulesCard>
    <Button size="lg" onclick={onback} disabled={!!missing}>{missing || 'Done'}</Button>
  {/snippet}
</Screen>

<style>
  .opt { display: flex; flex-direction: column; gap: var(--s-2); background: var(--surface); border-radius: var(--r-md); padding: var(--s-3) var(--s-3) var(--s-3) var(--s-4); }
  .label { font-weight: 700; }
  .hint { color: var(--text-faint); font-size: 0.88rem; }
  .note { margin-bottom: var(--s-3); padding: var(--s-3) var(--s-4); border-radius: var(--r-md); background: color-mix(in srgb, var(--c-pass) 14%, var(--surface)); font-weight: 600; }
</style>
