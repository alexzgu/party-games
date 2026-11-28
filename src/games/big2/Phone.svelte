<script lang="ts">
  import SeatWait from '../../components/room/SeatWait.svelte';
  import { untrack } from 'svelte';
  import { gameName } from '../../app.config';
  import Screen from '../../components/Screen.svelte';
  import HowTo from '../../components/HowTo.svelte';
  import Popup from '../../components/Popup.svelte';
  import Button from '../../components/Button.svelte';
  import Timer from '../../components/room/Timer.svelte';
  import CardFan from '../../components/cards/CardFan.svelte';
  import JoinRoom from '../../components/room/JoinRoom.svelte';
  import LobbySeats from '../../components/room/LobbySeats.svelte';
  import type { Card } from '../../lib/cards/deck';
  import { back, route } from '../../lib/router.svelte';
  import { haptic } from '../../lib/haptics';
  import { sfx } from '../../lib/sound';
  import { keepAwake } from '../../lib/wakelock';
  import { demo, demoPick } from './demo';
  import { needIn } from './bot';
  import { fault } from './moves';
  import { NAME_MAX } from './logic';
  import { pass, phone, playCards, refusals } from './player.svelte';
  import { nameIn, selectionLine } from './labels';
  import DealResult from './DealResult.svelte';
  import Rules from './Rules.svelte';
  import Standings from './Standings.svelte';
  import TablePlay from './TablePlay.svelte';

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
   * The cards tapped in this seat's hand (any time, to plan ahead), and the turn (`at`) a play or
   * pass was sent on: shown at once, before the host answers. They belong to the seat, since a
   * turn counter starts again in a new room.
   */
  // svelte-ignore state_referenced_locally
  let choice = $state<{ seat: string; cards: Card[]; sent?: number }>({ seat: fixed ? 'demo' : '', cards: demoPick(fixed) });
  const me = $derived(v?.players.find((p) => p.pid === pid));
  const name = $derived(v ? nameIn(v) : () => '');
  const hand = $derived(v?.hand ?? []);
  const myTurn = $derived(!!v && v.phase === 'turn' && v.turn === pid && !!v.hand);
  /** The tapped cards still in the hand. */
  const picked = $derived(choice.seat === seat ? choice.cards.filter((c) => hand.includes(c)) : []);
  const sent = $derived(choice.seat === seat && !!v && choice.sent === v.at);
  const need = $derived(v ? needIn(v) : { table: null, first: null });
  const canPlay = $derived(myTurn && !sent && !v?.paused && fault(picked, need) === null);
  const canPass = $derived(myTurn && !sent && !v?.paused && !!v?.table);
  /** The first word of a name that is not a mark like the bots' 🤖. */
  const firstName = (n: string) => n.split(' ').find((w) => /[\p{L}\p{N}]/u.test(w)) ?? n;
  const others = $derived(v ? v.players.filter((p) => p.pid !== pid && !p.out && !p.watching) : []);

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
  // A move the host turned down (the turn had moved on, say): choose again.
  $effect(() => {
    if (refusals.count) untrack(() => { choice = { ...choice, sent: undefined }; });
  });
  // Not seated in that room any more (left, removed, the room closed, another room joined): the tapped cards go.
  $effect(() => {
    const now = seat;
    untrack(() => { if (choice.seat !== now) choice = { seat: now, cards: [] }; });
  });
  // A new deal: the cards tapped in the last one go, even one dealt again.
  let dealAt = 0;
  $effect(() => {
    const deal = v?.deal ?? 0;
    untrack(() => {
      if (!fixed && dealAt && deal && deal !== dealAt) choice = { seat: choice.seat, cards: [] };
      if (deal) dealAt = deal;
    });
  });
  // A buzz when this phone's turn starts.
  let turnAt = 0;
  $effect(() => {
    if (fixed || !v || !myTurn || v.at === turnAt) return;
    turnAt = v.at;
    untrack(() => { haptic.correct(); sfx.go(); });
  });
  $effect(() => {
    keepAwake(!fixed && ['live', 'joining', 'lost'].includes(phone.link));
    return () => keepAwake(false);
  });

  function tap(card: Card) {
    if (!v || v.paused || sent) return;
    sfx.tap();
    choice = { seat, cards: picked.includes(card) ? picked.filter((c) => c !== card) : [...picked, card] };
  }
  function play() {
    if (!v || !canPlay) return;
    choice = { seat, cards: picked, sent: v.at };
    if (!fixed) playCards(v.at, picked);
  }
  function skip() {
    if (!v || !canPass) return;
    choice = { seat, cards: [], sent: v.at };
    if (!fixed) pass(v.at);
  }
  const line = $derived(sent ? 'Sent…' : myTurn ? selectionLine(picked, need) : picked.length ? selectionLine(picked, { table: null, first: null }) : 'Tap cards to pick them ahead');
</script>

{#snippet moveBar()}
  <div class="moves">
    <Button size="lg" onclick={play} disabled={!canPlay}>Play</Button>
    <Button size="lg" variant="secondary" onclick={skip} disabled={!canPass} tip={v?.table ? 'Sits you out until this trick ends' : 'The player leading a trick cannot pass'}>Pass</Button>
  </div>
{/snippet}

{#if !fixed}<SeatWait link={phone} />{/if}

{#if !v || (!fixed && phone.stopped)}
  {#key code}<JoinRoom game="big2" {phone} nameMax={NAME_MAX} rules={Rules} code={code || phone.me?.code || ''} fixed={!!fixed} />{/key}
{:else}
  <Screen title={gameName('big2')} onback={() => fixed ? back('/big2') : (leaving = true)} actions={v.phase === 'turn' && v.hand ? moveBar : undefined}>
    {#snippet trailing()}<HowTo><Rules /></HowTo>{/snippet}
    <div class="play" inert={v.paused}>
      {#if !fixed && phone.link !== 'live'}<p class="lost" role="status">{phone.trouble || 'Reconnecting…'}</p>{/if}
      <div class="me">
        <p>{#if me}<b>{me.name}</b><span>&nbsp;·&nbsp;</span>{/if}<span>{v.phase === 'lobby' ? `Room ${fixed ? 'BGTW' : phone.me?.code ?? ''}` : v.phase === 'over' ? 'Game over' : `Deal ${v.deal} of ${v.deals}${me ? ` · ${me.points} ${me.points === 1 ? 'pt' : 'pts'}` : ''}`}</span></p>
        <Timer left={remaining} total={v.total} paused={v.paused} size={40} />
      </div>
      {#if v.phase === 'lobby'}
        <h2>You’re in!</h2>
        <p class="muted">The cards are dealt from the host screen. Keep this screen open.</p>
        <LobbySeats players={v.players} />
      {:else if v.phase === 'over'}
        <Standings {v} you={pid} />
      {:else if v.phase === 'result'}
        <DealResult {v} {name} you={pid} />
        <p class="muted">The next deal starts in a moment.</p>
      {:else}
        <div class="status" role="status">
          {#if me?.watching}<p class="muted">You’re watching: you’ll be dealt in at the next {me.watching}.</p>{/if}
          {#if myTurn}<h2 class="you">Your turn!</h2>
          {:else if v.turn}<p class="said">{name(v.turn)} is playing…</p>{/if}
        </div>
        {#if others.length}
          <p class="others">{#each others as p, i (p.pid)}{i ? ' · ' : ''}<span title={p.name}>{firstName(p.name)} {p.cards}{p.passed ? ' (passed)' : ''}</span>{/each}</p>
        {/if}
        <TablePlay {v} {name} size="md" />
        {#if v.hand}
          <p class="line" class:ok={canPlay}>{line}</p>
          <CardFan cards={hand} selected={picked} size="lg" onpick={sent ? undefined : tap} label="Your hand, {hand.length} cards" />
        {/if}
      {/if}
      <!-- While holding cards in play the back arrow leaves (after asking), so the hand stays in view. -->
      {#if !(v.phase === 'turn' && v.hand)}<Button variant="ghost" size="sm" onclick={() => (leaving = true)} tip="Leaves after asking; the same code lets you back in">Leave room</Button>{/if}
    </div>
    {#if v.paused}<div class="paused" role="status"><div><h2>Paused</h2><p>Waiting for the host to resume.</p></div></div>{/if}
  </Screen>
{/if}
{#if leaving}
  <Popup title="Leave the room?" onclose={() => (leaving = false)}>
    <p>{v && v.phase !== 'lobby' && v.phase !== 'over' ? 'Your cards are set aside and still count against you. You can rejoin with the same code and keep your points.' : 'You can rejoin with the same code.'}</p>
    <Button variant="danger" onclick={() => { if (!fixed) phone.leave(); back('/big2'); }}>Leave</Button>
    <Button variant="secondary" onclick={() => (leaving = false)}>Stay</Button>
  </Popup>
{/if}

<style>
  .play { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--s-2); padding-bottom: var(--s-2); }
  .me { display: flex; align-items: center; justify-content: space-between; gap: var(--s-2); color: var(--text-dim); }
  .me p { display: flex; min-width: 0; white-space: nowrap; }
  .me b { min-width: 0; overflow: hidden; text-overflow: ellipsis; color: var(--accent); font-family: var(--font-display); }
  h2 { overflow-wrap: anywhere; }
  .status { display: grid; gap: var(--s-1); }
  .you { color: var(--accent); }
  .said { font: 700 1.05rem / 1.3 var(--font-display); overflow-wrap: anywhere; }
  .others { color: var(--text-dim); font-size: 0.88rem; overflow-wrap: anywhere; }
  .line { text-align: center; font-weight: 700; color: var(--text-dim); }
  .line.ok { color: var(--accent); }
  .moves { display: grid; grid-template-columns: 2fr 1fr; gap: var(--s-2); }
  .lost { padding: var(--s-2) var(--s-3); text-align: center; border-radius: var(--r-md); background: var(--surface); }
  .paused { position: fixed; inset: 0; z-index: var(--z-overlay); display: grid; place-items: center; background: color-mix(in srgb, var(--bg) 85%, transparent); }
  .paused > div { display: grid; gap: var(--s-2); text-align: center; padding: var(--s-5); background: var(--surface); border-radius: var(--r-lg); }
</style>
