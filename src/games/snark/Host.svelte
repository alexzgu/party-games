<script lang="ts">
  // The host screen: a top bar (back, round, room code, pause, skip, rules, end) over the
  // current step. Works as a TV/laptop screen and as a phone on the table.
  import { onMount } from 'svelte';
  import { route, go, back } from '../../lib/router.svelte';
  import { keepAwake } from '../../lib/wakelock';
  import { sfx } from '../../lib/sound';
  import HowTo from '../../components/HowTo.svelte';
  import Popup from '../../components/Popup.svelte';
  import Button from '../../components/Button.svelte';
  import Rules from './Rules.svelte';
  import Connection from '../../components/room/Connection.svelte';
  import TapToFinish from '../../components/room/TapToFinish.svelte';
  import HostLobby from './HostLobby.svelte';
  import HostWrite from './HostWrite.svelte';
  import HostDuel from './HostDuel.svelte';
  import HostFinal from './HostFinal.svelte';
  import HostLines from './HostLines.svelte';
  import HostScores from './HostScores.svelte';
  import HostOver from './HostOver.svelte';
  import { host } from './host.svelte';
  import { brokerSetting } from '../../lib/room/broker';
  import { timeLeft, timerLength, type Game } from './logic';
  import { anyScored } from './record';
  import { joinLink, roundName, secs } from './look';
  import { demoHost } from './demo';

  const demo = route.params.get('demo') ?? '';
  const fixed = demo ? demoHost(demo) : null;
  const game = $derived<Game | null>(fixed ? fixed.game : host.game);
  const online = $derived(fixed ? fixed.online : host.online);
  const now = $derived(fixed ? fixed.now : host.now);
  const left = $derived(game ? timeLeft(game, now) : null);
  const total = $derived(game ? timerLength(game) : 0);
  let brokerChanged = $state(0);
  const link = $derived.by(() => { void brokerChanged; return game ? joinLink(game.code, brokerSetting()) : ''; });
  function rebroker() { brokerChanged++; if (!fixed) host.rebroker(); }

  let confirmEnd = $state(false);
  let showConn = $state(false);

  onMount(() => {
    if (!fixed) host.open();
    keepAwake(true);
    return () => keepAwake(false);
  });


  // Cues for the room: a chime when writing starts, a pop for each vote, a fanfare at the end,
  // ticks in the last five seconds of writing and voting.
  let lastStep = '';
  $effect(() => {
    if (!game || fixed) return;
    const key = `${game.round}:${game.phase}:${game.at}`;
    if (key === lastStep) return;
    const first = lastStep === '';
    lastStep = key;
    if (first) return;
    if (game.phase === 'write') sfx.go();
    else if (game.phase === 'vote') sfx.count();
    else if (game.phase === 'reveal') sfx.reveal();
    else if (game.phase === 'over') sfx.win();
  });
  let lastTick: number | null = null;
  $effect(() => {
    const s = secs(left);
    if (!game || fixed || (game.phase !== 'write' && game.phase !== 'vote') || s === lastTick) return;
    lastTick = s;
    if (s !== null && s > 0 && s <= 5 && game.paused === null) sfx.tick();
  });

  // Skip moves the game a whole step; a double tap must not skip two.
  let stepAt = 0;
  $effect(() => { if (game) { void `${game.round}:${game.phase}:${game.at}`; stepAt = performance.now(); } });
  function skip() {
    if (performance.now() - stepAt < 800) return;
    stepAt = performance.now();
    host.skip();
  }

  function end() {
    confirmEnd = false;
    if (fixed) return;
    host.end();
    back('/snark');
  }

  const playing = $derived(!!game && game.phase !== 'lobby' && game.phase !== 'over');
  const timed = $derived(!!game && (game.deadline !== null || game.paused !== null));
  const skipLabel = $derived(game?.phase === 'write' ? 'End writing' : game?.phase === 'show' ? 'Start voting' : game?.phase === 'vote' ? 'End voting' : 'Next');
</script>

<svelte:window onkeydown={(e) => {
  if (fixed || !game || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  if (e.key === ' ' && timed) { e.preventDefault(); if (game.paused !== null) host.resume(); else host.pause(); }
}} />

<div class="host">
  <header class="bar">
    <button class="icon back" aria-label="Back to Snark Tank (the room stays open)" onclick={() => back('/snark')}>
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <div class="where">
      {#if game && game.phase !== 'lobby' && game.phase !== 'over'}
        <b class="round">{roundName(game.round, game.settings.rounds)}</b>
        <span class="chip" aria-label="Room code {game.code}"><span class="jl">Join: </span><b>{game.code}</b></span>
      {/if}
    </div>
    <div class="tools">
      {#if game && timed}
        {#if game.paused !== null}
          <button class="tool on" onclick={() => host.resume()} aria-label="Resume" data-tip="Starts the clock again on every phone">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M7 5l12 7-12 7z" fill="currentColor"/></svg><span class="lbl">Resume</span>
          </button>
        {:else}
          <button class="tool" onclick={() => host.pause()} aria-label="Pause" data-tip="Stops the clock on every phone">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg><span class="lbl">Pause</span>
          </button>
        {/if}
        {#if game.phase !== 'scores'}<button class="tool" onclick={skip} aria-label={skipLabel} data-tip={game.phase === 'write' ? 'Stops writing now; missing answers stay empty' : game.phase === 'show' ? 'Goes straight to the vote' : game.phase === 'vote' ? 'Counts the votes so far now' : 'Moves on without waiting for the timer'}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 5l9 7-9 7zM16 5h3v14h-3z" fill="currentColor"/></svg><span class="lbl">{skipLabel}</span>
        </button>{/if}
      {/if}
      <HowTo><Rules /></HowTo>
      {#if game}
        <Button size="sm" variant="ghost" onclick={() => (confirmEnd = true)} tip={playing ? 'Ends the game and sends every phone back, after asking' : 'Sends every phone back to the start, after asking'}>Close room</Button>
      {/if}
    </div>
  </header>

  {#if !fixed && host.status !== 'open'}
    <div class="trouble fade-in" role="alert">
      {#if host.trouble}
        <span>{host.trouble}</span>
        <Button size="sm" variant="secondary" onclick={() => (showConn = true)} tip="See how phones connect, or use a backup server">Trouble connecting?</Button>
      {:else}
        <span>Opening room {game?.code}…</span>
      {/if}
    </div>
  {/if}

  <main class="stage">
    {#if game}
      <TapToFinish>
        {#if game.phase === 'lobby'}
          <HostLobby {game} {online} {link} onstart={() => host.start()} onkick={(pid) => host.kick(pid)} onsettings={() => go('/snark/settings')} onrebroker={rebroker} />
        {:else if game.phase === 'write'}
          <HostWrite {game} {online} {left} {total} />
        {:else if game.phase === 'show' || game.phase === 'vote' || game.phase === 'reveal'}
          {#key `${game.round}:${game.at}`}
            {#if game.items[game.at]?.kind === 'final'}
              <HostFinal {game} {online} {left} {total} />
            {:else if game.items[game.at]?.kind === 'lines'}
              <HostLines {game} {online} {left} {total} />
            {:else}
              <HostDuel {game} {online} {left} {total} />
            {/if}
          {/key}
        {:else if game.phase === 'scores'}
          <HostScores {game} {left} onnext={skip} />
        {:else if game.phase === 'over'}
          <HostOver {game} onagain={() => host.rematch()} onclose={() => (confirmEnd = true)} />
        {/if}
      </TapToFinish>
    {/if}
  </main>

  {#if game?.paused !== null && game?.paused !== undefined}
    <div class="paused fade-in">
      <div class="pcard pop-in">
        <h2>Paused</h2>
        <p class="muted">The timer stops on every phone too.</p>
        <Button size="lg" onclick={() => host.resume()}>▶ Resume</Button>
      </div>
    </div>
  {/if}
</div>

{#if confirmEnd && game}
  <Popup title="Close the room?" onclose={() => (confirmEnd = false)}>
    <div class="confirm">
      <p>This closes room {game.code} and sends everyone's phone back to the start.{#if playing} The game ends.{/if}{#if playing && anyScored(game)} The scores so far go in History as ended early.{/if}</p>
      <Button variant="danger" onclick={end}>Close room</Button>
      <Button variant="secondary" onclick={() => (confirmEnd = false)}>{playing ? 'Keep playing' : 'Keep it open'}</Button>
    </div>
  </Popup>
{/if}

{#if showConn}<Connection onclose={() => (showConn = false)} onchange={rebroker} />{/if}

<style>
  .host {
    min-height: 100dvh; display: flex; flex-direction: column;
    padding: calc(var(--safe-top) + var(--s-2)) calc(var(--safe-right) + clamp(12px, 2.5vw, 40px)) calc(var(--safe-bottom) + var(--s-3)) calc(var(--safe-left) + clamp(12px, 2.5vw, 40px));
  }
  .bar { position: relative; z-index: 1; display: flex; align-items: center; gap: var(--s-2); min-height: 52px; }
  .where { flex: 1; min-width: 0; display: flex; align-items: center; gap: var(--s-3); white-space: nowrap; overflow: hidden; font-family: var(--font-display); font-size: clamp(1rem, 2.2vmin, 1.4rem); }
  .round { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .chip { flex: none; font-family: var(--font-body); font-size: 0.85em; color: var(--text-dim); padding: 4px 12px; border-radius: var(--r-pill); background: var(--overlay); }
  .chip b { color: var(--accent); letter-spacing: 0.12em; }
  .tools { display: flex; align-items: center; gap: var(--s-2); }
  .icon {
    flex: none; width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center;
    background: var(--overlay); color: var(--text); font-size: 1.05rem;
  }
  .trouble {
    display: flex; align-items: center; justify-content: space-between; gap: var(--s-3); flex-wrap: wrap;
    margin: var(--s-2) 0; padding: var(--s-3) var(--s-4); border-radius: var(--r-md);
    background: color-mix(in srgb, var(--c-pass) 16%, var(--surface)); border: 1.5px solid color-mix(in srgb, var(--c-pass) 50%, transparent);
    font-weight: 600;
  }
  .stage { flex: 1; display: flex; flex-direction: column; min-height: 0; }
  .paused { position: fixed; inset: 0; z-index: var(--z-overlay); display: grid; place-items: center; background: var(--scrim); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); padding: var(--s-4); }
  .pcard { width: min(420px, 100%); display: flex; flex-direction: column; gap: var(--s-3); text-align: center; background: var(--bg-raised); border-radius: var(--r-lg); padding: var(--s-6) var(--s-5); border: 1.5px solid var(--line-strong); }
  .confirm { display: flex; flex-direction: column; gap: var(--s-2); }
  .confirm p { margin-bottom: var(--s-2); }
  .tool {
    display: inline-flex; align-items: center; gap: var(--s-2); min-height: 44px; min-width: 44px; padding: 0 var(--s-4); justify-content: center;
    border-radius: var(--r-pill); background: var(--surface); color: var(--text); font-family: var(--font-display); font-weight: 700; font-size: 1rem;
  }
  .tool:active { transform: scale(0.96); }
  .tool.on { background: var(--accent); color: var(--on-accent); }
  @media (max-width: 560px) {
    .tool { padding: 0; }
    .lbl { display: none; }
    .where { font-size: 0.95rem; gap: var(--s-2); }
    .chip { padding: 2px 8px; }
    .jl { display: none; }
  }
  /* A phone as host: the room code matters more than the round's name. */
  @media (max-width: 400px) { .round { display: none; } }
</style>
