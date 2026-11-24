<script lang="ts">
  import { untrack } from 'svelte';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import Segmented from '../../components/Segmented.svelte';
  import PackList from '../../components/PackList.svelte';
  import RulesCard from '../../components/RulesCard.svelte';
  import { triviaPacks } from '../../lib/content';
  import { ANSWER_TIMES, COUNTS } from './logic';
  import { loadSettings } from './store';
  import { host } from './host.svelte';
  import { packEntry } from './find';
  import { roomQuestions } from './pack';

  // The room's settings, a pack page: question packs on the page (built-in, made or imported),
  // questions per game and seconds to answer behind the Rules row over Done. Saved on this device
  // at once and into the lobby's game; a game already running keeps its own. Solo reads the same
  // picks and seconds.
  let { onback, onedit, onmake }: { onback: () => void; onedit: (id: string) => void; onmake: () => void } = $props();

  let packs = $state.raw(triviaPacks());
  const s = loadSettings();
  let count = $state(s.count);
  let seconds = $state(s.seconds);
  // svelte-ignore state_referenced_locally
  let selected = $state(s.packs.filter((id) => packs.some((p) => p.id === id)));
  const locked = host.game !== null && host.game.phase !== 'lobby';

  $effect(() => {
    const next = { count, seconds, packs: $state.snapshot(selected) };
    untrack(() => { if (next.packs.length) host.settings(next); });
  });

  // What a game would ask from: the picks' questions, none twice.
  const questions = $derived(selected.length ? roomQuestions(packs, selected).length : 0);
  const summary = $derived(`${count} questions · ${seconds} s to answer`);
</script>

<Screen fill title="Room settings" {onback}>
  <PackList game="trivia" entries={packs.map(packEntry)} bind:selected title="Question packs" noun="questions" placeholder="Search packs and questions"
    makeHint="Paste questions or ask the wizard" keepOnImport {onedit} {onmake} onimported={() => (packs = triviaPacks())}>
    {#snippet notice()}
      {#if locked}<p class="note">A game is running: these apply to the next one.</p>{/if}
      {#if selected.length && questions < count}<p class="note">{questions} {questions === 1 ? 'question' : 'questions'} picked: a game will have {questions}.</p>{/if}
    {/snippet}
  </PackList>
  {#snippet actions()}
    <RulesCard compact {summary}>
      <div class="opt">
        <span class="label">Questions per game</span>
        <Segmented label="Questions per game" bind:value={count} options={COUNTS.map((v) => ({ value: v as number, label: `${v}` }))} />
      </div>
      <div class="opt">
        <span class="label">Seconds to answer</span>
        <Segmented label="Seconds to answer" bind:value={seconds} options={ANSWER_TIMES.map((v) => ({ value: v as number, label: `${v}` }))} />
        <span class="hint">Faster right answers score more, so a longer time is kinder.</span>
      </div>
    </RulesCard>
    <Button size="lg" onclick={onback} disabled={!selected.length}>{selected.length ? 'Done' : 'Pick packs'}</Button>
  {/snippet}
</Screen>

<style>
  .opt { display: flex; flex-direction: column; gap: var(--s-2); background: var(--surface); border-radius: var(--r-md); padding: var(--s-3) var(--s-3) var(--s-3) var(--s-4); }
  .label { font-weight: 700; }
  .hint { color: var(--text-faint); font-size: 0.88rem; }
  .note { margin-bottom: var(--s-3); padding: var(--s-3) var(--s-4); border-radius: var(--r-md); background: color-mix(in srgb, var(--c-pass) 14%, var(--surface)); font-weight: 600; }
</style>
