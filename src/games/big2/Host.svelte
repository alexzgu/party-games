<script lang="ts">
  import { untrack } from 'svelte';
  import { gameName } from '../../app.config';
  import Button from '../../components/Button.svelte';
  import HowTo from '../../components/HowTo.svelte';
  import Popup from '../../components/Popup.svelte';
  import Connection from '../../components/room/Connection.svelte';
  import SeatAsk from '../../components/room/SeatAsk.svelte';
  import NewPhone from '../../components/room/NewPhone.svelte';
  import { ELSEWHERE } from '../../lib/room/owner';
  import { back, route } from '../../lib/router.svelte';
  import { sfx } from '../../lib/sound';
  import { keepAwake } from '../../lib/wakelock';
  import { host } from './host.svelte';
  import { demo } from './demo';
  import { view } from './view';
  import { active } from './logic';
  import HostLobby from './HostLobby.svelte';
  import HostStage from './HostStage.svelte';
  import Rules from './Rules.svelte';

  const fixed = $derived(route.params.get('demo'));
  const game = $derived(host.game);
  const v = $derived(fixed ? demo(fixed, false) : game ? view(game, host.now) : null);
  const code = $derived(fixed ? 'BGTW' : game?.code ?? '');
  const playing = $derived(!!v && v.phase !== 'lobby' && v.phase !== 'over');
  let confirm = $state(false);
  let connection = $state(false);
  let showPlayers = $state(false);
  let brokerChanged = $state(0);
  let kicking = $state<{ pid: string; name: string } | null>(null);
  function rebroker() { brokerChanged++; if (!fixed) host.rebroker(); }
  function askKick(pid: string) {
    const p = game && active(game).find((x) => x.pid === pid);
    if (p) kicking = p;
  }

  $effect(() => {
    if (fixed) return;
    untrack(() => host.open());
    keepAwake(true);
    return () => keepAwake(false);
  });

  let previous = '';
  $effect(() => {
    if (!v || fixed) return;
    const key = `${v.phase}:${v.at}`;
    if (previous && key !== previous && v.phase === 'turn' && v.table) sfx.tap();
    if (previous && key !== previous && v.phase === 'result') sfx.correct();
    if (previous && key !== previous && v.phase === 'over') sfx.win();
    previous = key;
  });

  function shortcuts(e: KeyboardEvent) {
    if (fixed || e.code !== 'Space' || e.repeat || e.target !== document.body || confirm || connection || kicking || showPlayers || !playing) return;
    e.preventDefault();
    host.pause();
  }
</script>

<svelte:window onkeydown={shortcuts} />
<div class="host">
  <header class="bar">
    <div class="where">
      <Button size="sm" variant="ghost" label="Back to {gameName('big2')} (the room stays open)" onclick={() => back('/big2')}>←</Button>
      <b>{gameName('big2')}</b>
      {#if v && v.phase !== 'lobby'}<span>Room {code}</span>{/if}
    </div>
    <div class="controls">
      {#if playing}
        <Button size="sm" variant="secondary" onclick={() => { if (!fixed) host.pause(); }} tip={v?.paused ? 'Starts the clock again on every phone' : 'Stops the clock on every phone'}>{v?.paused ? 'Resume' : 'Pause'}</Button>
        <Button size="sm" variant="secondary" onclick={() => { if (!fixed) host.skip(); }} tip={v?.phase === 'turn' ? 'Passes for the player whose turn it is, or plays their lowest card when they lead' : 'Deals the next deal without waiting'}>{v?.phase === 'turn' ? 'Play for them' : 'Next'}</Button>
        <Button size="sm" variant="ghost" onclick={() => (showPlayers = true)} tip="Remove a player from the room">Players</Button>
      {/if}
      {#if !fixed && game}<NewPhone link={host.link} players={game.players} />{/if}
      <HowTo><Rules /></HowTo>
      {#if v}<Button size="sm" variant="ghost" onclick={() => (confirm = true)} tip={playing ? 'Ends the game and sends every phone back, after asking' : 'Sends every phone back to the start, after asking'}>Close</Button>{/if}
    </div>
  </header>
  {#if !fixed && host.status !== 'open'}
    <p class="connection" role="status">{host.trouble || (host.link.elsewhere ? ELSEWHERE : `Opening room ${code}…`)}
      {#if host.trouble}<Button size="sm" variant="secondary" onclick={() => (connection = true)} tip="See how phones connect, or use a backup server">Trouble connecting?</Button>{/if}</p>
  {/if}
  {#if v}
    {#if v.phase === 'lobby'}
      <HostLobby {v} {code} demo={!!fixed} {brokerChanged} online={fixed ? undefined : host.online} onkick={fixed ? undefined : askKick} onrebroker={rebroker} />
    {:else}
      <HostStage {v} online={fixed ? undefined : host.online}
        onnext={() => { if (!fixed) host.skip(); }} onagain={() => { if (!fixed) host.rematch(); }} onclose={() => (confirm = true)} />
    {/if}
  {:else}<p>{host.link.elsewhere ? ELSEWHERE : 'Opening room…'}</p>{/if}
</div>

{#if confirm}
  <Popup title="Close the room?" onclose={() => (confirm = false)}>
    <p>This closes room {code} and sends everyone’s phone back to the start.{playing ? ' The game ends.' : ''}</p>
    <Button variant="danger" onclick={() => { if (!fixed) host.close(); back('/big2'); }}>Close</Button>
    <Button variant="secondary" onclick={() => (confirm = false)}>{playing ? 'Keep playing' : 'Stay'}</Button>
  </Popup>
{/if}
{#if connection}<Connection onclose={() => (connection = false)} onchange={rebroker} />{/if}
{#if showPlayers && v}
  <Popup title="Players" onclose={() => (showPlayers = false)}>
    <p>A removed player’s cards are set aside and their turn passes on. They can’t rejoin this room.</p>
    {#each v.players.filter((x) => !x.out) as p (p.pid)}
      <Button size="sm" variant="secondary" onclick={() => { showPlayers = false; askKick(p.pid); }}>Remove {p.name}</Button>
    {/each}
  </Popup>
{/if}
{#if kicking}
  {@const p = kicking}
  <Popup title="Remove {p.name}?" onclose={() => (kicking = null)}>
    <p>Their phone leaves the game and can’t rejoin this room.</p>
    <Button variant="danger" onclick={() => { host.kick(p.pid); kicking = null; }}>Remove {p.name}</Button>
    <Button variant="secondary" onclick={() => (kicking = null)}>Cancel</Button>
  </Popup>
{/if}

{#if !fixed}<SeatAsk link={host.link} />{/if}

<style>
  .host {
    width: min(100%, 1600px); min-height: 100dvh; margin: 0 auto; display: flex; flex-direction: column; gap: var(--s-2);
    padding: calc(var(--safe-top) + var(--s-2)) calc(var(--safe-right) + var(--s-4)) calc(var(--safe-bottom) + var(--s-3)) calc(var(--safe-left) + var(--s-4));
  }
  .bar, .where, .controls, .connection { display: flex; align-items: center; gap: var(--s-2); flex-wrap: wrap; }
  .bar { justify-content: space-between; }
  .where span { color: var(--text-dim); }
  .bar .controls { justify-content: flex-end; }
  .connection { justify-content: space-between; padding: var(--s-2) var(--s-3); background: var(--surface); border-radius: var(--r-md); }
</style>
