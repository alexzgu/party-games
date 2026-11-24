<script lang="ts">
  import { gameName } from '../../app.config';
  import Button from '../../components/Button.svelte';
  import Qr from '../../components/room/Qr.svelte';
  import ConnectionLink from '../../components/room/ConnectionLink.svelte';
  import { go } from '../../lib/router.svelte';
  import { brokerSetting } from '../../lib/room/broker';
  import { joinLink } from '../../lib/room/look';
  import { host, chosenPacks } from './host.svelte';
  import { DEFAULT_SETTINGS, MAX_PLAYERS, MIN_PLAYERS } from './logic';
  import Seats from './Seats.svelte';
  import AddBot from '../../components/room/AddBot.svelte';
  import StartButton from '../../components/room/StartButton.svelte';
  import type { View } from './view';

  let { v, code, demo, brokerChanged, online, onkick, onrebroker }: {
    v: View; code: string; demo: boolean; brokerChanged: number; online?: ReadonlySet<string>;
    onkick?: (pid: string) => void; onrebroker: () => void;
  } = $props();
  const link = $derived.by(() => { void brokerChanged; return joinLink('trivia', code, brokerSetting()); });
  const s = $derived(host.game?.settings ?? DEFAULT_SETTINGS);
  const rules = $derived(`${s.count} questions · ${s.seconds} s to answer`);
  const need = $derived(Math.max(0, MIN_PLAYERS - v.players.length));
  // The packs Start asks from, so Start is off exactly when they hold no question.
  const chosen = $derived(chosenPacks(s.packs));
  const none = $derived(!chosen.some((p) => p.questions.length));
  const packLine = $derived(chosen.map((p) => p.name).join(', '));
</script>

<main class="lobby">
  <section class="qr" aria-label="Join on your phone">
    <h2>Join on your phone</h2>
    <div class="code-box"><Qr text={link} label="QR code to join room {code}" size={220} /></div>
    <strong aria-label="Room code {code.split('').join(' ')}">{code}</strong>
    <p class="muted">Scan the code or choose Join in {gameName('trivia')}.</p>
  </section>
  <section class="room">
    <h2>Players · {v.players.length} / {MAX_PLAYERS}</h2>
    {#if v.players.length}<Seats {v} {online} {onkick} />
    {:else}<p class="empty muted">Waiting for players. Scan the code or type it on the join screen.</p>{/if}
    {#if !demo}<AddBot onadd={() => host.addBot()} full={v.players.length >= MAX_PLAYERS} />{/if}
    <div class="summary">
      <span>{packLine || 'No packs'} · {rules}</span>
      <Button size="sm" variant="secondary" onclick={() => go('/trivia/settings')} tip="Pick question packs, questions per game and time to answer">Settings</Button>
    </div>
    <StartButton size="lg" players={v.players} {online} disabled={need > 0 || none} onstart={() => { if (!demo) host.start(); }}>
      {need ? `Need ${need} more ${need === 1 ? 'player' : 'players'}` : none ? 'No questions: pick packs in Settings' : `Start with ${v.players.length} players`}
    </StartButton>
    <ConnectionLink onchange={onrebroker} />
  </section>
</main>

<style>
  .lobby { flex: 1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: center; gap: clamp(var(--s-4), 5vw, 5rem); }
  section { display: grid; gap: var(--s-3); min-width: 0; }
  .qr { text-align: center; justify-items: center; }
  .code-box { display: grid; place-items: center; max-width: 100%; padding: var(--s-2); border-radius: var(--r-lg); background: white; }
  .qr strong { color: var(--accent); font: 800 clamp(2.6rem, 7vw, 5rem)/1 var(--font-display); letter-spacing: 0.14em; }
  .summary, .empty { display: flex; align-items: center; justify-content: space-between; gap: var(--s-2); padding: var(--s-3) var(--s-4); border-radius: var(--r-md); background: var(--bg-sunk); color: var(--text-dim); }
  @media (max-width: 760px) { .lobby { grid-template-columns: 1fr; } }
</style>
