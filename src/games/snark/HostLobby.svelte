<script lang="ts">
  import Button from '../../components/Button.svelte';
  import Popup from '../../components/Popup.svelte';
  import Avatar from '../../components/room/Avatar.svelte';
  import Qr from '../../components/room/Qr.svelte';
  import { MAX_PLAYERS, MIN_PLAYERS, canStart, present, type Game } from './logic';
  import { host, content } from './host.svelte';
  import AddBot from '../../components/room/AddBot.svelte';
  import StartButton from '../../components/room/StartButton.svelte';
  import { route } from '../../lib/router.svelte';
  import ConnectionLink from '../../components/room/ConnectionLink.svelte';
  import LendAsk from '../../components/room/LendAsk.svelte';
  import { nameList, onScreen } from '../../lib/lend';

  // The room before the game: how to join (QR, address, code), who is in, settings, Start.
  let { game, online, link, onstart, onkick, onsettings, onrebroker }: {
    game: Game;
    online: ReadonlySet<string>;
    link: string;
    onstart: () => void;
    onkick: (pid: string) => void;
    onsettings: () => void;
    onrebroker: () => void;
  } = $props();

  const players = $derived(present(game));
  const need = $derived(Math.max(0, MIN_PLAYERS - players.length));
  const site = location.host + location.pathname.replace(/\/$/, '');
  const s = $derived(game.settings);
  // The same prompts Start deals from: Start is off when even the lenders have none, and asks
  // before other packs lend (src/lib/lend.ts).
  const room = $derived(content(s, players.length));
  const agreed = $derived(!!room.ask && host.agreed === room.ask.key);
  const packLine = $derived(room.packs.map((p) => p.name).join(', ') +
    (!room.ask ? '' : agreed ? ` (+ ${room.ask.noun} from ${nameList(room.ask.lenders)})` : ` (too few ${room.ask.noun} for this room)`));
  const summary = $derived(`${s.rounds} rounds${s.final === 'duels' ? ' (three-line duel final)' : ''} · ${s.answerSecs} s to write · ${s.voteSecs} s to vote · ${packLine}`);
  /** The question on screen: the room's while it is the one put to the host after Start (host.svelte.ts). */
  const shown = $derived(route.params.get('demo') ? null : onScreen(host.asked, room.ask));
  let kicking = $state<{ pid: string; name: string } | null>(null);
  // A tile that has just appeared ignores taps for 400 ms, so a double tap never kicks.
  const shownAt = new Map<string, number>();
  $effect(() => { for (const p of players) if (!shownAt.has(p.pid)) shownAt.set(p.pid, performance.now()); });
  function askKick(pid: string, name: string) {
    if (performance.now() - (shownAt.get(pid) ?? 0) < 400) return;
    kicking = { pid, name };
  }
</script>

<div class="lobby">
  <section class="join" aria-label="How to join">
    <p class="lead">Join on your phone</p>
    <div class="qr"><Qr text={link} label="QR code to join room {game.code}" size={260} /></div>
    <p class="addr">or open <b>{site}</b> → Snark Tank → Join</p>
    <p class="code" aria-label="Room code {game.code.split('').join(' ')}">
      {#each game.code.split('') as c, i (i)}<span>{c}</span>{/each}
    </p>
  </section>

  <section class="room" aria-labelledby="who-h">
    <div class="head">
      <h3 id="who-h">Players</h3>
      <span class="count">{players.length} / {MAX_PLAYERS}</span>
    </div>
    {#if players.length}
      <ul class="players">
        {#each players as p (p.pid)}
          {@const here = online.has(p.pid)}
          <li class="pop-in">
            <Avatar name={p.name} color={p.color} size={40} dim={!here} />
            <span class="name">{p.name}{#if !here}<small>away</small>{/if}</span>
            <button class="kick" aria-label="Remove {p.name}" onclick={() => askKick(p.pid, p.name)}>✕</button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="empty muted">Waiting for players. Scan the code with a phone camera, or type the code on the join screen.</p>
    {/if}

    {#if !route.params.get('demo')}<AddBot onadd={() => host.addBot()} full={players.length >= MAX_PLAYERS} />{/if}
    <div class="settings">
      <span class="sum">{summary}</span>
      <Button size="sm" variant="secondary" onclick={onsettings} tip="Pick packs, rounds, times and the kind of final">Settings</Button>
    </div>
    <StartButton size="lg" {players} {online} disabled={!canStart(game) || !!room.problem} {onstart}>
      {need ? `Need ${need} more ${need === 1 ? 'player' : 'players'}` : room.problem ? `${room.problem}: pick packs in Settings` : `Start with ${players.length} players`}
    </StartButton>
    <ConnectionLink onchange={onrebroker} />
  </section>
</div>

{#if shown}
  <LendAsk ask={shown} onclose={() => host.dismiss()} onpacks={() => { host.dismiss(); onsettings(); }} onyes={() => host.start(shown.key)} />
{/if}
{#if kicking}
  {@const k = kicking}
  <Popup title="Remove {k.name}?" onclose={() => (kicking = null)}>
    <div class="confirm">
      <p>Their phone leaves the game and can't rejoin this room.</p>
      <Button variant="danger" onclick={() => { onkick(k.pid); kicking = null; }}>Remove {k.name}</Button>
      <Button variant="secondary" onclick={() => (kicking = null)}>Keep them</Button>
    </div>
  </Popup>
{/if}

<style>
  .lobby {
    flex: 1; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); gap: clamp(16px, 4vw, 64px);
    align-items: center; width: min(100%, 1200px); margin: 0 auto; padding: var(--s-3) 0;
  }
  .join { display: flex; flex-direction: column; align-items: center; gap: var(--s-3); text-align: center; }
  .lead { font-family: var(--font-display); font-weight: 800; font-size: clamp(calc(1.3 * var(--rem-far)), 3.4vmin, calc(2.2 * var(--rem-far))); }
  .qr { width: clamp(180px, 36vmin, 300px); padding: 6px; border-radius: var(--r-md); background: var(--bg-raised); box-shadow: var(--shadow); }
  .qr :global(svg) { width: 100%; height: auto; }
  .addr { color: var(--text-dim); font-size: clamp(calc(0.9 * var(--rem-far)), 2vmin, calc(1.15 * var(--rem-far))); overflow-wrap: anywhere; }
  .addr b { color: var(--text); }
  .code { display: flex; gap: clamp(6px, 1.2vmin, 14px); }
  .code span {
    width: clamp(52px, 11vmin, 104px); height: clamp(64px, 13.5vmin, 124px); display: grid; place-items: center;
    font-family: var(--font-display); font-weight: 800; font-size: clamp(calc(2.4 * var(--rem-far)), 9vmin, calc(5.4 * var(--rem-far))); line-height: 1;
    color: var(--accent); background: var(--surface); border: 2px solid color-mix(in srgb, var(--accent) 45%, transparent); border-radius: var(--r-md);
    box-shadow: 0 0 28px color-mix(in srgb, var(--accent) calc(22% * var(--glow)), transparent);
  }
  .room { display: flex; flex-direction: column; gap: var(--s-3); min-width: 0; }
  .head { display: flex; align-items: baseline; justify-content: space-between; }
  h3 { color: var(--text-dim); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.08em; font-family: var(--font-body); font-weight: 700; }
  .count { font-family: var(--font-display); font-weight: 800; color: var(--text-dim); }
  .players { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s-2); }
  li { display: flex; align-items: center; gap: var(--s-2); padding: 6px 4px 6px 8px; border-radius: var(--r-pill); background: var(--surface); min-width: 0; }
  .name { flex: 1; min-width: 0; font-weight: 700; font-size: clamp(var(--rem-far), 2.4vmin, calc(1.3 * var(--rem-far))); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .name small { color: var(--text-faint); font-weight: 600; margin-left: 0.5em; font-size: 0.8em; }
  .kick { flex: none; width: 44px; height: 44px; border-radius: 50%; background: transparent; color: var(--text-faint); font-size: 0.95rem; }
  .kick:active { background: var(--overlay); }
  .empty { padding: var(--s-4); border-radius: var(--r-md); border: 2px dashed var(--line-strong); line-height: var(--leading); }
  .settings { display: flex; align-items: center; gap: var(--s-3); padding: var(--s-2) var(--s-2) var(--s-2) var(--s-4); background: var(--bg-sunk); border-radius: var(--r-md); }
  .sum { flex: 1; color: var(--text-dim); font-size: 0.92rem; line-height: 1.35; }
  .confirm { display: flex; flex-direction: column; gap: var(--s-2); }
  .confirm p { margin-bottom: var(--s-2); }
  @media (max-width: 760px), (max-aspect-ratio: 1/1) {
    .lobby { grid-template-columns: 1fr; align-items: start; }
    .code span { width: 60px; height: 72px; font-size: calc(2.8 * var(--rem-far)); }
  }
</style>
