<script lang="ts">
  import { untrack } from 'svelte';
  import { gameName } from '../../app.config';
  import Button from '../../components/Button.svelte';
  import HowTo from '../../components/HowTo.svelte';
  import Popup from '../../components/Popup.svelte';
  import Qr from '../../components/room/Qr.svelte';
  import Connection from '../../components/room/Connection.svelte';
  import ConnectionLink from '../../components/room/ConnectionLink.svelte';
  import TapToFinish from '../../components/room/TapToFinish.svelte';
  import Timer from '../../components/room/Timer.svelte';
  import { back, go, route } from '../../lib/router.svelte';
  import { brokerSetting } from '../../lib/room/broker';
  import { joinLink } from '../../lib/room/look';
  import { keepAwake } from '../../lib/wakelock';
  import { host } from './host.svelte';
  import { demo, demoArt } from './demo';
  import { view } from './view';
  import { active, MAX_PLAYERS } from './core';
  import { canStart } from './logic';
  import { phaseLabel, progress } from './labels';
  import { modeName, settingsSummary } from './summary';
  import { loadSettings } from './store';
  import HostStage from './HostStage.svelte';
  import Players from './Players.svelte';
  import Rules from './Rules.svelte';

  const fixed = $derived(route.params.get('demo'));
  const game = $derived(host.game);
  const v = $derived(fixed ? demo(fixed, false) : game ? view(game, host.now, undefined, host.online) : null);
  const code = $derived(fixed ? 'SKCH' : game?.code ?? '');
  const steps = $derived(v?.phase === 'write' || v?.phase === 'draw' || v?.phase === 'describe');
  const skipLabel = $derived(steps ? 'End step' : v?.phase === 'pick' || v?.phase === 'guess' ? 'End turn' : 'Next');
  const timed = $derived(!!v && v.phase !== 'lobby' && v.phase !== 'over' && v.phase !== 'album');
  const playing = $derived(!!v && v.phase !== 'lobby' && v.phase !== 'over' && !(v.phase === 'album' && v.album?.end));
  const need = $derived(v ? Math.max(0, 3 - v.players.length) : 3);
  let confirm = $state(false);
  let connection = $state(false);
  let brokerChanged = $state(0);
  let kicking = $state<{ pid: string; name: string } | null>(null);
  function rebroker() { brokerChanged++; if (!fixed) host.rebroker(); }
  function askKick(pid: string) {
    const p = game && active(game).find((x) => x.pid === pid);
    if (p) kicking = p;
  }
  const link = $derived.by(() => {
    void brokerChanged;
    return joinLink('sketch', code, brokerSetting());
  });
  const summary = $derived.by(() => {
    const s = fixed ? loadSettings() : game?.settings ?? loadSettings();
    return `${modeName(s)} · ${settingsSummary(s)}`;
  });

  $effect(() => {
    if (fixed) return;
    untrack(() => host.open());
    keepAwake(true);
    return () => keepAwake(false);
  });

  function page(dir: 1 | -1) { if (!fixed) host.page(dir); }

  function shortcuts(e: KeyboardEvent) {
    if (fixed || e.repeat || e.target !== document.body || confirm || connection || kicking || !v) return;
    if (v.phase === 'album' && ['Space', 'ArrowRight', 'ArrowLeft'].includes(e.code)) {
      e.preventDefault();
      page(e.code === 'ArrowLeft' ? -1 : 1);
    } else if (e.code === 'Space' && timed) {
      e.preventDefault();
      host.pause();
    }
  }
</script>

<svelte:window onkeydown={shortcuts} />
<div class="host">
  <header class="bar">
    <div class="where">
      <Button size="sm" variant="ghost" label="Back to {gameName('sketch')} (the room stays open)" onclick={() => back('/sketch')}>←</Button>
      <b>{gameName('sketch')}</b>
      {#if v && v.phase !== 'lobby'}<span>Room {code}{progress(v) ? ` · ${progress(v)}` : ''}</span>{/if}
    </div>
    <div class="controls">
      {#if v && timed}
        <Button size="sm" variant="secondary" onclick={() => { if (!fixed) host.pause(); }}>{v.paused ? 'Resume' : 'Pause'}</Button>
        <Button size="sm" variant="secondary" onclick={() => { if (!fixed) host.skip(); }}>{skipLabel}</Button>
      {:else if v?.phase === 'album'}
        <Button size="sm" variant="secondary" disabled={!v.album?.chain && !v.album?.entry} onclick={() => page(-1)} label="Previous entry">← Back</Button>
        {#if !v.album?.end}<Button size="sm" onclick={() => page(1)} label="Next entry">Next →</Button>{/if}
      {:else if v?.phase === 'over'}
        <Button size="sm" onclick={() => { if (!fixed) host.rematch(); }}>Play again</Button>
      {/if}
      <HowTo><Rules /></HowTo>
      {#if v}<Button size="sm" variant="ghost" onclick={() => (confirm = true)}>{playing ? 'End game' : 'Close room'}</Button>{/if}
    </div>
  </header>
  {#if v}
    {#if v.phase === 'lobby'}
      <main class="lobby">
        <div class="qr">
          <h3>Join on your phone</h3>
          <Qr text={link} label="Scan to join" size={200} />
          <strong>{code}</strong>
          <p>Scan the code or choose Join in {gameName('sketch')}.</p>
        </div>
        <section>
          <h3>Players · {v.players.length} / {MAX_PLAYERS}</h3>
          <Players players={v.players} online={fixed ? undefined : host.online} onkick={fixed ? undefined : askKick} />
          {#if host.trouble && !fixed}
            <p role="status">{host.trouble} <Button size="sm" variant="secondary" onclick={() => (connection = true)}>Trouble connecting?</Button></p>
          {/if}
          <p class="summary">{summary}</p>
          <div class="controls">
            <Button disabled={fixed ? v.players.length < 3 : !game || !canStart(game)} onclick={() => { if (!fixed) host.start(); }}>
              {need ? `Need ${need} more ${need === 1 ? 'player' : 'players'}` : `Start with ${v.players.length} players`}
            </Button>
            <Button variant="secondary" onclick={() => go('/sketch/settings')}>Settings</Button>
          </div>
          <ConnectionLink onchange={rebroker} />
        </section>
      </main>
    {:else}
      <main class="play">
        <div class="heading">
          <p>{phaseLabel(v)}</p>
          <Timer left={v.left} total={v.total} paused={v.paused} size={52} />
        </div>
        <div class="stage"><TapToFinish><HostStage {v} art={fixed ? demoArt : host.art} online={fixed ? undefined : host.online} /></TapToFinish></div>
        {#if v.phase === 'album' && v.album?.end}
          <div class="controls end">
            <Button onclick={() => { if (!fixed) host.rematch(); }}>Play again</Button>
            <Button variant="secondary" onclick={() => (confirm = true)}>Close the room</Button>
          </div>
        {/if}
      </main>
    {/if}
  {:else}<p>Opening room…</p>{/if}
</div>

{#if confirm}
  <Popup title={playing ? 'End the game?' : 'Close the room?'} onclose={() => (confirm = false)}>
    <p>This closes room {code} and sends everyone’s phone back to the start.</p>
    <Button variant="danger" onclick={() => { if (!fixed) host.close(); back('/sketch'); }}>{playing ? 'End game' : 'Close room'}</Button>
    <Button variant="secondary" onclick={() => (confirm = false)}>{playing ? 'Keep playing' : 'Keep it open'}</Button>
  </Popup>
{/if}
{#if connection}
  <Connection onclose={() => (connection = false)} onchange={rebroker} />
{/if}
{#if kicking}
  {@const p = kicking}
  <Popup title="Remove {p.name}?" onclose={() => (kicking = null)}>
    <p>Their phone leaves the game and can’t rejoin this room.</p>
    <Button variant="danger" onclick={() => { host.kick(p.pid); kicking = null; }}>Remove {p.name}</Button>
    <Button variant="secondary" onclick={() => (kicking = null)}>Cancel</Button>
  </Popup>
{/if}

<style>
  .host {
    width: min(100%, 1440px); height: 100dvh; margin: 0 auto; display: flex; flex-direction: column; gap: var(--s-2);
    padding: calc(var(--safe-top) + var(--s-2)) calc(var(--safe-right) + var(--s-4)) calc(var(--safe-bottom) + var(--s-3)) calc(var(--safe-left) + var(--s-4));
  }
  .bar, .where, .controls, .heading { display: flex; align-items: center; gap: var(--s-2); }
  .bar { justify-content: space-between; flex-wrap: wrap; }
  .where span { color: var(--text-dim); }
  .controls { flex-wrap: wrap; justify-content: center; }
  .bar .controls { justify-content: flex-end; }
  main { flex: 1; min-height: 0; display: grid; }
  .heading { justify-content: center; text-align: center; color: var(--text-dim); font-size: 1.1rem; }
  .play { grid-template-rows: auto minmax(0, 1fr) auto; gap: var(--s-2); }
  .stage { min-height: 0; overflow: auto; display: grid; align-content: center; width: min(100%, 1100px); margin-inline: auto; }
  .lobby { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: center; gap: var(--s-5); }
  section, .qr { display: grid; gap: var(--s-3); }
  .qr { text-align: center; justify-items: center; }
  .qr strong { color: var(--accent); font: 800 clamp(2rem, 6vw, 4rem)/1 var(--font-display); letter-spacing: 0.18em; }
  .summary { color: var(--text-dim); text-align: center; }
  .end { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); width: min(100%, 560px); margin-inline: auto; }
  @media (max-width: 720px) { .lobby { grid-template-columns: 1fr; } .host { height: auto; min-height: 100dvh; } }
</style>
