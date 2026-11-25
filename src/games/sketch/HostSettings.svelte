<script lang="ts">
  import { untrack } from 'svelte';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import Segmented from '../../components/Segmented.svelte';
  import PackList from '../../components/PackList.svelte';
  import RulesCard from '../../components/RulesCard.svelte';
  import { sketchPacks } from '../../lib/content';
  import { active, DRAW_TIMES, GUESS_TIMES, ROUND_CHOICES, WRITE_TIMES, type Mode } from './core';
  import { roomItems } from './room';
  import { nameList } from '../../lib/lend';
  import { loadSettings } from './store';
  import { host } from './host.svelte';
  import { settingsSummary } from './summary';
  import { packEntry } from './find';

  // The room's settings, a pack page: the mode over the packs (built-in, made, imported or from the
  // Community; each counts what the mode deals), the mode's timers behind the Rules row over Done.
  // Saved on this device at once and into the lobby's game; a game already running keeps its own.
  let { onback, onedit, onmake }: { onback: () => void; onedit: (id: string) => void; onmake: () => void } = $props();

  let packs = $state.raw(sketchPacks());
  const s = loadSettings();
  let mode = $state<Mode>(s.mode);
  let writeSecs = $state(s.writeSecs);
  let drawSecs = $state(s.drawSecs);
  let rounds = $state(s.rounds);
  let guessSecs = $state(s.guessSecs);
  // svelte-ignore state_referenced_locally
  let selected = $state(s.packs.filter((id) => packs.some((p) => p.id === id)));
  const settings = $derived({ mode, writeSecs, drawSecs, rounds, guessSecs, packs: [...selected] });
  const locked = host.game !== null && host.game.phase !== 'lobby';
  const options = (xs: readonly number[]) => xs.map((x) => ({ value: x, label: `${x}` }));

  $effect(() => {
    const next = $state.snapshot(settings);
    untrack(() => { if (next.packs.length) host.settings(next); });
  });

  // What the room would deal with these picks for the players in the lobby (at least three): the
  // same words or ideas Start uses, and the packs Start would ask to borrow from when they are too few.
  const players = Math.max(3, host.game ? active(host.game).length : 0);
  const room = $derived(roomItems(packs, settings, players));
  /** Why the room cannot start with these packs, or ''. */
  const missing = $derived(!selected.length ? 'Pick packs' : room.problem);
</script>

<Screen fill title="Room settings" {onback}>
  <PackList game="sketch" entries={packs.map((p) => packEntry(p, mode))} bind:selected noun={mode === 'telephone' ? 'ideas' : 'words'}
    placeholder="Search packs, words and ideas" makeHint="Paste a list or ask the wizard" keepOnImport {onedit} {onmake} onimported={() => (packs = sketchPacks())}>
    {#snippet notice()}
      {#if locked}<p class="note">A game is running: these apply to the next one.</p>{/if}
      <div class="mode">
        <Segmented label="Mode" bind:value={mode} options={[{ value: 'telephone', label: 'Telephone', tip: 'Write, draw, describe, pass it on' }, { value: 'guess', label: 'Draw & guess', tip: 'One draws a word, the rest race to guess it' }]} />
        <span class="hint">{mode === 'telephone' ? 'Write, draw, describe, pass it on.' : 'One draws a word, the rest race to guess it.'}</span>
      </div>
      {#if !missing && room.ask}<p class="note">{room.ask.short} The game will ask before adding {room.ask.noun} from {nameList(room.ask.lenders)}.</p>{/if}
    {/snippet}
  </PackList>
  {#snippet actions()}
    <RulesCard compact summary={settingsSummary(settings)}>
      {#if mode === 'telephone'}
        <div class="opt">
          <span class="label">Seconds to write</span>
          <Segmented label="Seconds to write" bind:value={writeSecs} options={options(WRITE_TIMES)} />
          <span class="hint">For the first line and every description.</span>
        </div>
        <div class="opt">
          <span class="label">Seconds to draw</span>
          <Segmented label="Seconds to draw" bind:value={drawSecs} options={options(DRAW_TIMES)} />
        </div>
        <p class="hint">As many steps as players.</p>
      {:else}
        <div class="opt">
          <span class="label">Rounds</span>
          <Segmented label="Rounds" bind:value={rounds} options={options(ROUND_CHOICES)} />
          <span class="hint">Each round everyone draws once.</span>
        </div>
        <div class="opt">
          <span class="label">Seconds to draw</span>
          <Segmented label="Seconds to draw" bind:value={guessSecs} options={options(GUESS_TIMES)} />
        </div>
      {/if}
    </RulesCard>
    <Button size="lg" onclick={onback} disabled={!!missing}>{missing || 'Done'}</Button>
  {/snippet}
</Screen>

<style>
  .opt { display: flex; flex-direction: column; gap: var(--s-2); background: var(--surface); border-radius: var(--r-md); padding: var(--s-3) var(--s-3) var(--s-3) var(--s-4); margin-bottom: var(--s-3); }
  .label { font-weight: 700; }
  .mode { display: flex; flex-direction: column; gap: var(--s-1); margin-bottom: var(--s-3); }
  .hint { color: var(--text-faint); font-size: 0.88rem; }
  .note { margin-bottom: var(--s-3); padding: var(--s-3) var(--s-4); border-radius: var(--r-md); background: color-mix(in srgb, var(--c-pass) 14%, var(--surface)); font-weight: 600; }
</style>
