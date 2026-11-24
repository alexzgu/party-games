<script lang="ts">
  import SeatWait from '../../components/room/SeatWait.svelte';
  import { untrack } from 'svelte';
  import { gameName } from '../../app.config';
  import Screen from '../../components/Screen.svelte';
  import HowTo from '../../components/HowTo.svelte';
  import Popup from '../../components/Popup.svelte';
  import Button from '../../components/Button.svelte';
  import Timer from '../../components/room/Timer.svelte';
  import { back, route } from '../../lib/router.svelte';
  import { sfx } from '../../lib/sound';
  import { keepAwake } from '../../lib/wakelock';
  import { demo } from './demo';
  import { phone, refusals, vote } from './player.svelte';
  import { nameIn, outcome } from './labels';
  import type { Side } from './logic';
  import Choices from './Choices.svelte';
  import Join from './Join.svelte';
  import Rules from './Rules.svelte';
  import Seats from './Seats.svelte';
  import Standings from './Standings.svelte';

  const fixed = $derived(route.params.get('demo'));
  const code = $derived(route.params.get('code') ?? '');
  const v = $derived(fixed ? fixed === 'join' ? null : demo(fixed, true) : phone.view);
  let now = $state(Date.now());
  const remaining = $derived(fixed ? v?.left ?? null : phone.left(now));
  let leaving = $state(false);
  const pid = $derived(fixed ? 'a' : phone.me?.pid ?? '');
  /** The room and player this phone is seated as ('' when it is not seated in a room). */
  const seat = $derived(fixed ? 'demo' : phone.me?.code && phone.me.joined && !phone.stopped ? `${phone.me.code}/${phone.me.pid}` : '');
  /**
   * The side this phone has just tapped in this phase (`at`) of this seat's room: shown at once,
   * before the host answers. A phase counter starts again in a new room, so the tap belongs to its seat.
   */
  let sent = $state<{ seat: string; at: number; side: Side } | null>(null);
  const me = $derived(v?.players.find((p) => p.pid === pid));
  const name = $derived(v ? nameIn(v) : () => '');
  const mine = $derived(v && seat && sent?.seat === seat && sent.at === v.at ? sent.side : v?.mine);
  const scored = $derived(!!v?.tally && v.tally.winner !== null && v.tally.voters[v.tally.winner].includes(pid));

  $effect(() => {
    if (fixed) return;
    const requested = code;
    untrack(() => {
      if (requested && phone.me?.code !== requested) phone.leave();
      if (phone.me?.joined) phone.rejoin();
    });
  });
  $effect(() => {
    if (fixed) return;
    const interval = setInterval(() => { now = Date.now(); }, 250);
    return () => clearInterval(interval);
  });
  // A tap the host turned down (the question had moved on, say): show the host's own record.
  $effect(() => {
    if (refusals.count) untrack(() => { sent = null; });
  });
  // Not seated in that room any more (left, removed, the room closed, another room joined): the tap goes.
  $effect(() => {
    const now = seat;
    untrack(() => { if (sent && sent.seat !== now) sent = null; });
  });
  $effect(() => {
    keepAwake(!fixed && ['live', 'joining', 'lost'].includes(phone.link));
    return () => keepAwake(false);
  });

  function pick(side: Side) {
    if (!v || v.paused || v.phase !== 'vote' || side === mine) return;
    sfx.tap();
    sent = { seat, at: v.at, side };
    if (!fixed) vote(v.at, v.n, side);
  }

  /** What the reveal means for this phone. */
  function verdict(): string {
    const t = v?.tally;
    if (!t || t.counts[0] + t.counts[1] === 0 || t.winner === null) return outcome(v!);
    if (scored) return 'You were on the bigger side: +1 point!';
    return v?.mine === undefined ? 'You didn’t vote this time.' : 'Most of the room went the other way.';
  }
</script>

{#if !fixed}<SeatWait link={phone} />{/if}

{#if !v || (!fixed && phone.stopped)}
  {#key code}<Join code={code || phone.me?.code || ''} fixed={!!fixed} />{/key}
{:else}
  <Screen title={gameName('rather')} onback={() => fixed ? back('/rather') : (leaving = true)}>
    {#snippet trailing()}<HowTo><Rules /></HowTo>{/snippet}
    <div class="play" inert={v.paused}>
      {#if !fixed && phone.link !== 'live'}<p class="lost" role="status">{phone.trouble || 'Reconnecting…'}</p>{/if}
      <div class="me">
        <p>{#if me}<b>{me.name}</b> · {me.score} {me.score === 1 ? 'point' : 'points'}{' · '}{/if}{v.n ? `Question ${v.n} of ${v.count}` : `Room ${fixed ? 'WYRZ' : phone.me?.code ?? ''}`}</p>
        <Timer left={remaining} total={v.total} paused={v.paused} size={46} />
      </div>
      {#if v.phase === 'lobby'}
        <h2>You’re in!</h2>
        <p class="muted">The game starts from the host screen. Keep this screen open.</p>
        <Seats {v} />
      {:else if v.phase === 'vote' && v.prompt}
        <h2>Would you rather…</h2>
        <Choices prompt={v.prompt} size="md" picked={mine} onpick={pick} disabled={v.paused} />
        <p class="hint" role="status">{mine === undefined ? 'Tap the one you’d pick.' : 'Changed your mind? Tap the other one: your last tap counts.'}
          {v.voted?.length ?? 0} of {v.players.length} voted.</p>
      {:else if v.phase === 'reveal' && v.prompt && v.tally}
        <h2 class:win={scored}>{verdict()}</h2>
        <Choices prompt={v.prompt} size="sm" picked={v.mine} tally={v.tally} {name} />
      {:else if v.phase === 'over'}
        <Standings {v} you={pid} />
      {/if}
      <Button variant="ghost" onclick={() => (leaving = true)} tip="Leaves after asking; the same code lets you back in">Leave room</Button>
    </div>
    {#if v.paused}<div class="paused" role="status"><div><h2>Paused</h2><p>Waiting for the host to resume.</p></div></div>{/if}
  </Screen>
{/if}
{#if leaving}
  <Popup title="Leave the room?" onclose={() => (leaving = false)}>
    <p>{v && v.phase !== 'lobby' && v.phase !== 'over' ? 'You can rejoin with the same code and keep your points.' : 'You can rejoin with the same code.'}</p>
    <Button variant="danger" onclick={() => { if (!fixed) phone.leave(); back('/rather'); }}>Leave</Button>
    <Button variant="secondary" onclick={() => (leaving = false)}>Stay</Button>
  </Popup>
{/if}

<style>
  .play { display: grid; gap: var(--s-3); padding-bottom: var(--s-4); }
  .me { display: flex; align-items: center; justify-content: space-between; gap: var(--s-2); color: var(--text-dim); }
  .me p { overflow-wrap: anywhere; }
  .me b { color: var(--accent); font-family: var(--font-display); }
  h2 { overflow-wrap: anywhere; }
  .win { color: var(--accent); }
  .hint { color: var(--text-dim); text-align: center; }
  .lost { padding: var(--s-2) var(--s-3); text-align: center; border-radius: var(--r-md); background: var(--surface); }
  .paused { position: fixed; inset: 0; z-index: var(--z-overlay); display: grid; place-items: center; background: color-mix(in srgb, var(--bg) 85%, transparent); }
  .paused > div { display: grid; gap: var(--s-2); text-align: center; padding: var(--s-5); background: var(--surface); border-radius: var(--r-lg); }
</style>
