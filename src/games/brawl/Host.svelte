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
  import { active, canStart } from './logic';
  import Stage from './Stage.svelte';
  import AddBot from '../../components/room/AddBot.svelte';
  import StartButton from '../../components/room/StartButton.svelte';
  import Rules from './Rules.svelte';
  import { phaseLabel } from './labels';

  const fixed = $derived(route.params.get('demo'));
  const game = $derived(host.game);
  const v = $derived(fixed ? demo(fixed, false) : game ? view(game, host.now) : null);
  const skipLabel = $derived(v?.phase === 'draw' || v?.phase === 'challenge' ? 'End drawing' : v?.phase === 'vote' ? 'End voting' : 'Next');
  let confirm = $state(false);
  let connection = $state(false);
  let brokerChanged = $state(0);
  let kicking = $state<{ pid: string; name: string } | null>(null);
  const playing = $derived(!!v && v.phase !== 'lobby' && v.phase !== 'over');
  const need = $derived(v ? Math.max(0, 3 - v.players.length) : 3);
  function rebroker() { brokerChanged++; if (!fixed) host.rebroker(); }
  function askKick(pid: string) {
    const p = game && active(game).find((x) => x.pid === pid);
    if (p) kicking = p;
  }
  const link = $derived.by(() => {
    void brokerChanged;
    return joinLink('brawl', fixed ? 'BRWK' : game?.code ?? '', brokerSetting());
  });

  $effect(() => {
    if (fixed) return;
    untrack(() => host.open());
    keepAwake(true);
    return () => keepAwake(false);
  });

  function shortcuts(e: KeyboardEvent) {
    if (fixed || e.code !== 'Space' || e.repeat || e.target !== document.body || confirm || connection || kicking) return;
    e.preventDefault();
    host.pause();
  }
</script>

<svelte:window onkeydown={shortcuts} />
<div class="host">
  <header class="bar">
    <div class="where">
      <Button size="sm" variant="ghost" label="Back to {gameName('brawl')} (the room stays open)" onclick={() => back('/brawl')}>←</Button>
      <b>{gameName('brawl')}</b>
      {#if v && v.phase !== 'lobby'}<span>Room {fixed ? 'BRWK' : game?.code} · Round {v.round}</span>{/if}
    </div>
    <div class="controls">
      {#if v && v.phase !== 'lobby' && v.phase !== 'over'}
        <Button size="sm" variant="secondary" onclick={() => { if (!fixed) host.pause(); }} tip={v.paused ? 'Starts the clock again on every phone' : 'Stops the clock on every phone'}>{v.paused ? 'Resume' : 'Pause'}</Button>
        <Button size="sm" variant="secondary" onclick={() => { if (!fixed) host.skip(); }} tip={v.phase === 'draw' || v.phase === 'challenge' ? 'Stops the drawing now; missing fighters stay blank' : v.phase === 'vote' ? 'Counts the votes so far now' : 'Moves on without waiting for the timer'}>{skipLabel}</Button>
      {:else if v?.phase === 'over'}
        <Button size="sm" onclick={() => { if (!fixed) host.rematch(); }} tip="Back to the lobby with the same players, scores at zero">Back to lobby</Button>
      {/if}
      <HowTo><Rules /></HowTo>
      {#if v}<Button size="sm" variant="ghost" onclick={() => (confirm = true)} tip={playing ? 'Ends the game and sends every phone back, after asking' : 'Sends every phone back to the start, after asking'}>Close room</Button>{/if}
    </div>
  </header>
  {#if v}
    {#if v.phase === 'lobby'}
      <main class="lobby">
        <div class="qr">
          <h3>Join on your phone</h3>
          <Qr text={link} label="Scan to join" size={200} />
          <strong>{fixed ? 'BRWK' : game?.code}</strong>
          <p>Scan the code or choose Join in {gameName('brawl')}.</p>
        </div>
        <section>
          <h3>Players · {v.players.length} / 8</h3>
          <Stage {v} art={{}} online={fixed ? undefined : host.online} onkick={fixed ? undefined : askKick} />
          {#if !fixed}<AddBot onadd={() => host.addBot()} full={v.players.length >= 8} />{/if}
          {#if host.trouble && !fixed}
            <p role="status">{host.trouble} <Button size="sm" variant="secondary" onclick={() => (connection = true)} tip="See how phones connect, or use a backup server">Trouble connecting?</Button></p>
          {/if}
          <div class="controls">
            <StartButton players={v.players} online={fixed ? undefined : host.online} disabled={fixed ? v.players.length < 3 : !game || !canStart(game)} onstart={() => { if (!fixed) host.start(); }}>
              {need ? `Need ${need} more ${need === 1 ? 'player' : 'players'}` : `Start with ${v.players.length} players`}
            </StartButton>
            <Button variant="secondary" onclick={() => go('/brawl/settings')} tip="Pick the packs and the drawing time">Settings</Button>
          </div>
          <ConnectionLink onchange={rebroker} />
        </section>
      </main>
    {:else}
      <main class="play">
        <div class="heading">
          <div>
            <p>{phaseLabel(v)}</p>
            {#if v.title}<h3 class="title">{v.title}</h3>{/if}
          </div>
          <Timer left={v.left} total={v.total} paused={v.paused} size={52} />
        </div>
        <div class="stage"><TapToFinish><Stage {v} art={fixed ? demoArt : host.art} online={fixed ? undefined : host.online} /></TapToFinish></div>
      </main>
    {/if}
  {:else}<p>Opening room…</p>{/if}
</div>

{#if confirm}
  <Popup title="Close the room?" onclose={() => (confirm = false)}>
    <p>This closes room {fixed ? 'BRWK' : game?.code} and sends everyone’s phone back to the start.{playing ? ' The game ends.' : ''}</p>
    <Button variant="danger" onclick={() => { if (!fixed) host.close(); back('/brawl'); }}>Close room</Button>
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
  .heading { justify-content: center; text-align: center; }
  .heading p { color: var(--text-dim); }
  .title { font-size: clamp(1.3rem, 4.5vmin, 3rem); overflow-wrap: anywhere; }
  .play { grid-template-rows: auto minmax(0, 1fr); gap: var(--s-2); }
  .stage { min-height: 0; overflow: hidden; display: grid; align-content: center; width: min(100%, 960px); margin-inline: auto; }
  .stage > :global(div) > :global(p), .stage > :global(div) > :global(h3) { text-align: center; }
  .lobby { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: center; gap: var(--s-5); }
  section, .qr { display: grid; gap: var(--s-3); }
  .qr { text-align: center; justify-items: center; }
  .qr strong { color: var(--accent); font: 800 clamp(2rem, 6vw, 4rem)/1 var(--font-display); letter-spacing: 0.18em; }
  @media (max-width: 720px) { .lobby { grid-template-columns: 1fr; } .host { height: auto; min-height: 100dvh; } }
</style>
