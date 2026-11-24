<script lang="ts">
  import { untrack } from 'svelte';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import Segmented from '../../components/Segmented.svelte';
  import Toggle from '../../components/Toggle.svelte';
  import PackList from '../../components/PackList.svelte';
  import RulesCard from '../../components/RulesCard.svelte';
  import { handPacks } from '../../lib/content';
  import { active, ANSWER_TIMES, MIN_PLAYERS, TARGETS } from './logic';
  import { roomCards } from './pack';
  import { loadSettings } from './store';
  import { host } from './host.svelte';
  import { packEntry } from './find';

  // The room's settings, a pack page: card packs on the page (built-in, made, imported or from the
  // Community), answer time, target and house rules behind the Rules row over Done. Saved on this
  // device at once and into the lobby's game; a game already running keeps its own.
  let { onback, onedit, onmake }: { onback: () => void; onedit: (id: string) => void; onmake: () => void } = $props();

  let packs = $state.raw(handPacks());
  const s = loadSettings();
  let seconds = $state(s.seconds);
  let target = $state(s.target);
  let trade = $state(s.trade);
  let house = $state(s.house);
  let blanks = $state(s.blanks);
  // svelte-ignore state_referenced_locally
  let selected = $state(s.packs.filter((id) => packs.some((p) => p.id === id)));
  const locked = host.game !== null && host.game.phase !== 'lobby';

  $effect(() => {
    const next = { seconds, target, trade, house, blanks, packs: $state.snapshot(selected) };
    untrack(() => { if (next.packs.length) host.settings(next); });
  });

  // What the room would deal with these picks for the players in the lobby (at least three):
  // the same cards Start uses, topped up from other packs when the picks alone would stall.
  const players = Math.max(MIN_PLAYERS, host.game ? active(host.game).length : 0);
  const cards = $derived(roomCards(packs, selected, players));
  /** Why the room cannot start with these packs, or ''. */
  const missing = $derived(!selected.length ? 'Pick packs' : cards.problem);
  const summary = $derived([seconds ? `${seconds} s to answer` : 'No time limit', `${target} points to win`,
    ...(trade ? ['trading'] : []), ...(house ? ['house player'] : []), ...(blanks ? ['blank cards'] : [])].join(' · '));
</script>

<Screen fill title="Room settings" {onback}>
  <PackList game="hand" entries={packs.map(packEntry)} bind:selected title="Card packs" noun="cards" placeholder="Search packs and cards"
    makeHint="Paste cards or ask the wizard" keepOnImport {onedit} {onmake} onimported={() => (packs = handPacks())}>
    {#snippet notice()}
      {#if locked}<p class="note">A game is running: these apply to the next one.</p>{/if}
      {#if !missing && cards.added.length}<p class="note">The picked packs alone would run short ({cards.packs.some((p) => p.prompts.length) ? 'hands of ten need more answer cards' : 'they have no prompts'}), so the game adds cards from {cards.added.join(', ')}.</p>{/if}
    {/snippet}
  </PackList>
  {#snippet actions()}
    <RulesCard compact {summary}>
      <div class="opt">
        <span class="label">Seconds to answer</span>
        <Segmented label="Seconds to answer" bind:value={seconds} options={ANSWER_TIMES.map((v) => ({ value: v as number, label: v ? `${v}` : 'No limit' }))} />
      </div>
      <div class="opt">
        <span class="label">Points to win</span>
        <Segmented label="Points to win" bind:value={target} options={TARGETS.map((v) => ({ value: v as number, label: `${v}` }))} />
      </div>
      <h3>House rules</h3>
      <Toggle bind:checked={trade} label="Trade point" hint="Give up a point to swap any of your cards for new ones, outside judging." />
      <Toggle bind:checked={house} label="House player" hint="Each round the house plays random cards from the deck, as many as the prompt takes. If the house reaches the target, everyone loses." />
      <Toggle bind:checked={blanks} label="Blank cards" hint="About one card in twenty is blank: write your own answer when you play it." />
    </RulesCard>
    <Button size="lg" onclick={onback} disabled={!!missing}>{missing || 'Done'}</Button>
  {/snippet}
</Screen>

<style>
  .opt { display: flex; flex-direction: column; gap: var(--s-2); background: var(--surface); border-radius: var(--r-md); padding: var(--s-3) var(--s-3) var(--s-3) var(--s-4); }
  .label { font-weight: 700; }
  .note { margin-bottom: var(--s-3); padding: var(--s-3) var(--s-4); border-radius: var(--r-md); background: color-mix(in srgb, var(--c-pass) 14%, var(--surface)); font-weight: 600; }
</style>
