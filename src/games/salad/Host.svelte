<script lang="ts">
  import { onMount } from 'svelte';
  import { gameName } from '../../app.config';
  import Button from '../../components/Button.svelte';
  import HowTo from '../../components/HowTo.svelte';
  import Popup from '../../components/Popup.svelte';
  import Avatar from '../../components/room/Avatar.svelte';
  import Connection from '../../components/room/Connection.svelte';
  import Confetti from '../../components/room/Confetti.svelte';
  import TapToFinish from '../../components/room/TapToFinish.svelte';
  import SeatAsk from '../../components/room/SeatAsk.svelte';
  import NewPhone from '../../components/room/NewPhone.svelte';
  import { ELSEWHERE } from '../../lib/room/owner';
  import Timer from '../../components/room/Timer.svelte';
  import { route, go, back } from '../../lib/router.svelte';
  import { brokerSetting } from '../../lib/room/broker';
  import { joinLink } from '../../lib/room/look';
  import { keepAwake } from '../../lib/wakelock';
  import { sfx } from '../../lib/sound';
  import { host, packNames } from './host.svelte';
  import { awayWords, playerView } from './view';
  import { demoHost } from './demo';
  import Rules from './Rules.svelte';
  import HostLobby from './HostLobby.svelte';
  import Clues from './Clues.svelte';
  import Guesses from './Guesses.svelte';
  import Reveal from './Reveal.svelte';
  import Standings from './Standings.svelte';

  const demo = route.params.get('demo');
  const fixed = demo === null ? null : demoHost(demo);
  const game = $derived(fixed?.game ?? host.game);
  const online = $derived(fixed?.online ?? host.online);
  const now = $derived(fixed?.now ?? host.now);
  const view = $derived(game && playerView(game, '', now));
  const presenter = $derived(view?.players.find((p) => p.pid === view?.presenter));
  const selectedPacks = $derived(game ? packNames(game.packIds) : []);
  const playing = $derived(!!game && game.phase !== 'lobby' && game.phase !== 'over');
  const timed = $derived(view && view.left !== null);
  const roundSize = $derived(game?.players.filter((p) => !p.kicked && game.order.includes(p.pid)).length ?? 0);
  const roundPlayers = $derived(view?.players.filter((p) => !p.kicked && game?.order.includes(p.pid)) ?? []);
  const ready = $derived(roundPlayers.filter((p) => view?.progress.includes(p.pid)).length);
  const skipLabel = $derived(view?.phase === 'pick' ? 'End picking'
    : view?.phase === 'prepare' ? 'End preparation' : view?.phase === 'present' ? 'Skip turn' : '');
  let connection = $state(false);
  let brokerChanged = $state(0);
  const link = $derived.by(() => { void brokerChanged; return view ? joinLink('salad', view.code, brokerSetting()) : ''; });
  // The host's own pause; `view.paused` is also on while a presenter's turn is on hold.
  const hostPaused = $derived(view?.hostPaused ?? false);
  let ending = $state(false);
  let showPlayers = $state(false);
  let kicking = $state<{ pid: string; name: string } | null>(null);
  let stepAt = 0;

  onMount(() => {
    if (fixed) return;
    host.open();
    keepAwake(true);
    return () => keepAwake(false);
  });

  let previous = '';
  $effect(() => {
    if (!view || fixed) return;
    const key = `${view.round}:${view.phase}:${view.at}`;
    if (key === previous) return;
    stepAt = performance.now();
    if (previous && view.phase === 'reveal') sfx.reveal();
    if (previous && view.phase === 'over') sfx.win();
    previous = key;
  });

  function skip() {
    if (fixed || performance.now() - stepAt < 800) return;
    stepAt = performance.now();
    host.skip();
  }

  function togglePause() {
    if (fixed || !timed) return;
    if (hostPaused) host.resume();
    else host.pause();
  }

  function keyboard(e: KeyboardEvent) {
    if (e.code !== 'Space' || !timed || ending || connection || showPlayers ||
      e.target instanceof HTMLElement && e.target.closest('button,input,textarea,a,select,[contenteditable]')) return;
    e.preventDefault();
    togglePause();
  }

  function end() {
    if (!fixed) host.end();
    back('/salad');
  }

  function rebroker() {
    brokerChanged++;
    if (!fixed) host.rebroker();
  }
</script>

<svelte:window onkeydown={keyboard} />

<div class="host" inert={hostPaused}>
  <header class="bar">
    <div class="where">
      <Button size="sm" variant="ghost" label="Back to game menu" onclick={() => back('/salad')}>←</Button>
      <b>{gameName('salad')}</b>
      {#if view && view.phase !== 'lobby'}<span>Room {view.code} · Round {view.round} of 2</span>{/if}
    </div>
    <div class="controls">
      {#if timed}<Button size="sm" variant="secondary" onclick={togglePause} tip={hostPaused ? 'Starts the clock again on every phone' : 'Stops the clock on every phone'}>{hostPaused ? 'Resume' : 'Pause'}</Button>{/if}
      {#if view && view.phase !== 'lobby' && view.phase !== 'over'}
        {#if skipLabel}<Button size="sm" variant="secondary" onclick={skip} tip={view?.phase === 'pick' ? 'Stops waiting; undecided players get one of their secrets' : view?.phase === 'prepare' ? 'Stops waiting; unfinished opening clues are filled in' : 'Ends this turn now and shows the secret'}>{skipLabel}</Button>{/if}
        <Button size="sm" variant="ghost" onclick={() => (showPlayers = true)} tip="Remove a player from the room">Players</Button>
      {/if}
      {#if !fixed && game}<NewPhone link={host.link} players={game.players} />{/if}
      <HowTo><Rules /></HowTo>
      {#if game}<Button size="sm" variant="ghost" onclick={() => (ending = true)} tip={playing ? 'Ends the game and sends every phone back, after asking' : 'Sends every phone back to the start, after asking'}>Close</Button>{/if}
    </div>
  </header>

  {#if !fixed && host.status !== 'open'}
    <div class="connection" role="status">
      {host.trouble || (host.link.elsewhere ? ELSEWHERE : `Opening room ${game?.code ?? ''}…`)}
      {#if host.trouble}<Button size="sm" variant="secondary" onclick={() => (connection = true)} tip="See how phones connect, or use a backup server">Trouble connecting?</Button>{/if}
    </div>
  {/if}

  <main>
    <TapToFinish>
      {#if view && game}
        {#if view.phase === 'lobby'}
          <HostLobby players={view.players} {online} code={view.code} {link}
            packNames={selectedPacks} onstart={() => { if (!fixed) host.start(); }} onkick={(pid) => { if (!fixed) host.kick(pid); }}
            onsettings={() => go('/salad/settings')} onrebroker={rebroker} />
        {:else if view.phase === 'pick' || view.phase === 'prepare'}
          <section class="progress" aria-label="Round progress">
            <div class="headline">
              <div><h2>{view.phase === 'pick' ? 'Pick a secret' : 'Build your opening clue'}</h2>
                <p class="muted">{ready} of {roundPlayers.length} ready</p></div>
              <Timer left={view.left} total={view.span} paused={view.paused} />
            </div>
            <ul>
              {#each roundPlayers as p (p.pid)}
                {@const complete = view.progress.includes(p.pid)}
                <li class:ready={complete}>
                  <Avatar name={p.name} color={p.seat} dim={!online.has(p.pid)} />
                  <b>{p.name}</b><span>{complete ? 'Ready' : online.has(p.pid) ? 'Thinking' : 'Away'}</span>
                </li>
              {/each}
            </ul>
          </section>
        {:else if view.phase === 'present'}
          {#key view.serial}
            <section class="turn" aria-label="Current turn">
              <div class="headline">
                <div><h2>{presenter?.name ?? 'Player'} is presenting</h2>
                  <p class="muted" class:away={view.held}>{view.held ? `Waiting for ${presenter?.name ?? 'the presenter'} to reconnect · clock stopped (up to ${awayWords(view.awayMs)})` : 'Guess on your phone'}</p></div>
                <Timer left={view.left} total={view.span} paused={view.paused} />
              </div>
              <div class="turn-body">
                <Clues sentences={view.sentences} />
                <Guesses guesses={view.guesses} players={view.players} />
              </div>
            </section>
          {/key}
        {:else if view.phase === 'reveal' && view.result}
          <div class="result">
            <Reveal result={view.result} players={view.players} presenter={view.presenter} />
            <Button onclick={skip}>Next</Button>
          </div>
        {:else if view.phase === 'scores' || view.phase === 'over'}
          {@const final = view.phase === 'over'}
          <section class="scores">
            <div class="headline">
              <div>
                <h2>{final ? 'Final standings' : `Round ${view.round} scores`}</h2>
                {#if final}<p class="muted">The room solved {view.solved} of {view.total} secrets</p>{/if}
              </div>
              <Timer left={view.left} total={view.span} paused={view.paused} />
            </div>
            <Standings players={view.players} {final} />
            {#if final}
              <div class="controls">
                <Button onclick={() => { if (!fixed) host.rematch(); }} tip="Back to the lobby with the same players, scores at zero">Lobby</Button>
                <Button variant="secondary" onclick={() => (ending = true)} tip="Sends every phone back to the start, after asking">Close</Button>
              </div>
              <Confetti colors={['var(--accent)', 'var(--c-good)', 'var(--c-dial)']} />
            {:else}
              <Button onclick={skip}>{view.round === 1 ? 'Round 2' : 'Final standings'}</Button>
            {/if}
          </section>
        {/if}
      {/if}
    </TapToFinish>
  </main>
</div>

{#if hostPaused}
  <div class="paused" role="status">
    <div><h2>Paused</h2><p>The timer has stopped on every phone.</p><Button onclick={togglePause}>Resume</Button></div>
  </div>
{/if}

{#if connection}
  <Connection onclose={() => (connection = false)} onchange={rebroker} />
{/if}

{#if ending}
  <Popup title="Close the room?" onclose={() => (ending = false)}>
    <div class="actions">
      <p>This closes room {game?.code} and sends everyone’s phone back to the start.{playing ? ' The game ends.' : ''}</p>
      <Button variant="danger" onclick={end}>Close</Button>
      <Button variant="secondary" onclick={() => (ending = false)}>{playing ? 'Keep playing' : 'Stay'}</Button>
    </div>
  </Popup>
{/if}

{#if showPlayers && view}
  <Popup title="Players" onclose={() => { showPlayers = false; kicking = null; }}>
    <div class="actions">
      {#if kicking}
        {@const player = kicking}
        <p>Remove {player.name} from this room?</p>
        <Button variant="danger" onclick={() => { if (!fixed) host.kick(player.pid); kicking = null; }}>Remove {player.name}</Button>
        <Button variant="secondary" onclick={() => (kicking = null)}>Cancel</Button>
      {:else}
        {#each view.players.filter((p) => !p.kicked) as player (player.pid)}
          <Button size="sm" variant="secondary" onclick={() => (kicking = player)}>Remove {player.name}</Button>
        {/each}
      {/if}
    </div>
  </Popup>
{/if}

{#if !fixed}<SeatAsk link={host.link} />{/if}

<style>
  .host {
    width: min(100%, 1440px); min-height: 100dvh; margin: 0 auto; display: flex; flex-direction: column;
    padding: calc(var(--safe-top) + var(--s-2)) calc(var(--safe-right) + var(--s-4))
      calc(var(--safe-bottom) + var(--s-4)) calc(var(--safe-left) + var(--s-4));
  }
  .bar, .where, .controls, .headline, .connection { display: flex; align-items: center; gap: var(--s-2); }
  .bar, .headline, .connection { justify-content: space-between; }
  .bar, .controls, .where { flex-wrap: wrap; }
  .where span { color: var(--text-dim); }
  .connection { padding: var(--s-2) var(--s-3); background: var(--surface); border-radius: var(--r-md); }
  .away { color: var(--c-pass); font-weight: 700; }
  main { flex: 1; width: 100%; display: grid; justify-items: center; align-content: center; padding: var(--s-4) 0; }
  .progress, .turn, .result, .scores, .actions { width: 100%; display: grid; gap: var(--s-3); min-width: 0; }
  .progress, .scores { max-width: 820px; }
  .result { max-width: 860px; --answer-size: clamp(calc(2.7 * var(--rem-far)), 8vw, calc(6 * var(--rem-far))); }
  .headline h2 { font-size: clamp(calc(1.6 * var(--rem-far)), 4vw, calc(3.7 * var(--rem-far))); overflow-wrap: anywhere; line-height: 1.08; }
  .progress ul { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: var(--s-2); }
  .progress li { display: flex; align-items: center; gap: var(--s-2); padding: var(--s-2) var(--s-3); border: 2px solid var(--line); border-radius: var(--r-lg); background: var(--surface); }
  .progress li b { flex: 1; overflow-wrap: anywhere; }
  .progress li span { color: var(--text-dim); }
  .progress li.ready { border-color: var(--accent); }
  .turn { align-self: start; }
  .turn-body { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); align-items: start; gap: var(--s-4); --clue-size: clamp(calc(1.65 * var(--rem-far)), 3.1vw, calc(3.7 * var(--rem-far))); --clues-height: 64dvh; --guesses-height: 56dvh; --guess-size: clamp(var(--rem-far), 1.55vw, calc(1.55 * var(--rem-far))); }
  .scores { --standing-size: clamp(var(--rem-far), 2vw, calc(1.35 * var(--rem-far))); }
  .scores .controls { flex-wrap: nowrap; }
  .paused { position: fixed; inset: 0; z-index: var(--z-overlay); display: grid; place-items: center; background: color-mix(in srgb, var(--bg) 85%, transparent); }
  .paused > div { display: grid; gap: var(--s-3); text-align: center; padding: var(--s-5); background: var(--surface); border: 2px solid var(--line); border-radius: var(--r-lg); }
  @media (max-width: 760px) { .turn-body { grid-template-columns: 1fr; --clues-height: 50dvh; --guesses-height: 40dvh; } }
</style>
