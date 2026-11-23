<script lang="ts">
  import { gameName } from '../../app.config';
  import Button from '../../components/Button.svelte';
  import Popup from '../../components/Popup.svelte';
  import Avatar from '../../components/room/Avatar.svelte';
  import Qr from '../../components/room/Qr.svelte';
  import ConnectionLink from '../../components/room/ConnectionLink.svelte';
  import type { PlayerView } from './view';
  import AddBot from '../../components/room/AddBot.svelte';
  import { route } from '../../lib/router.svelte';
  import { MAX_PLAYERS } from './logic';
  import { host } from './host.svelte';

  let { players, online, code, link, packNames, onstart, onkick, onsettings, onrebroker }: {
    players: PlayerView['players']; online: ReadonlySet<string>; code: string; link: string; packNames: string[];
    onstart: () => void; onkick: (pid: string) => void; onsettings: () => void; onrebroker: () => void;
  } = $props();
  const seated = $derived(players.filter((p) => !p.kicked));
  const connected = $derived(seated.filter((p) => online.has(p.pid)).length);
  let kicking = $state<{ pid: string; name: string } | null>(null);
</script>

<div class="lobby">
  <section class="join" aria-label="Join on your phone">
    <h2>Join on your phone</h2>
    <div class="qr"><Qr text={link} label="QR code to join room {code}" size={240} /></div>
    <p class="code" aria-label="Room code {code.split('').join(' ')}">{code}</p>
    <p class="muted">Or open <b>{location.host + location.pathname}</b> and choose {gameName('salad')}.</p>
  </section>

  <section class="room" aria-label="Players">
    <div class="head"><h2>Players</h2><b>{connected} / 8 connected</b></div>
    {#if seated.length}
      <ul>
        {#each seated as p (p.pid)}
          <li>
            <Avatar name={p.name} color={p.seat} dim={!online.has(p.pid)} />
            <b>{p.name}{#if !online.has(p.pid)} <small>Away</small>{/if}</b>
            <button class="remove" aria-label="Remove {p.name}" onclick={() => (kicking = p)}>✕</button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="empty muted">Waiting for players. Scan the code or type it on the join screen.</p>
    {/if}

    {#if !route.params.has('demo')}<AddBot onadd={() => host.addBot()} full={seated.length >= MAX_PLAYERS} />{/if}
    <div class="head settings">
      <span>2 rounds · {packNames.join(', ')}</span>
      <Button size="sm" variant="secondary" onclick={onsettings} tip="Pick the packs and how long to wait for a dropped presenter">Settings</Button>
    </div>
    <Button size="lg" disabled={connected < 2} onclick={onstart}>
      {connected < 2 ? `Need ${2 - connected} more ${connected === 1 ? 'player' : 'players'}` : `Start with ${connected} players`}
    </Button>
    <ConnectionLink onchange={onrebroker} />
  </section>
</div>

{#if kicking}
  {@const player = kicking}
  <Popup title="Remove {player.name}?" onclose={() => (kicking = null)}>
    <div class="room">
      <p>Their phone will leave this room.</p>
      <Button variant="danger" onclick={() => { onkick(player.pid); kicking = null; }}>Remove player</Button>
      <Button variant="secondary" onclick={() => (kicking = null)}>Cancel</Button>
    </div>
  </Popup>
{/if}

<style>
  .lobby { width: 100%; display: grid; grid-template-columns: 1fr 1fr; gap: clamp(var(--s-4), 6vw, 5rem); align-items: center; }
  .join, .room { display: grid; gap: var(--s-3); }
  .join { text-align: center; justify-items: center; overflow-wrap: anywhere; }
  .qr { display: grid; place-items: center; max-width: 100%; padding: var(--s-2); border-radius: var(--r-lg); background: white; }
  .code { font: 800 clamp(2.7rem, 8vw, 5rem) / 1 var(--font-display); color: var(--accent); letter-spacing: 0.12em; }
  .head { display: flex; align-items: center; justify-content: space-between; gap: var(--s-2); }
  .settings, .empty { padding: var(--s-3) var(--s-4); border-radius: var(--r-md); background: var(--bg-sunk); color: var(--text-dim); }
  ul { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 170px), 1fr)); gap: var(--s-2); list-style: none; padding: 0; margin: 0; }
  li { display: flex; align-items: center; gap: var(--s-2); padding: var(--s-1) var(--s-2); border-radius: var(--r-lg); background: var(--surface); min-width: 0; }
  li b { flex: 1; overflow-wrap: anywhere; }
  li small { display: block; color: var(--text-dim); }
  .remove { background: transparent; color: var(--text-dim); min-width: var(--tap); min-height: var(--tap); border-radius: var(--r-pill); }
  @media (max-width: 760px) { .lobby { grid-template-columns: 1fr; } }
</style>
