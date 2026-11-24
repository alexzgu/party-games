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
  import PlayingCard from '../../components/cards/PlayingCard.svelte';
  import { cardName, rankOf, rankPlural, type Card, type Rank } from '../../lib/cards/deck';
  import { back, route } from '../../lib/router.svelte';
  import { haptic } from '../../lib/haptics';
  import { sfx } from '../../lib/sound';
  import { keepAwake } from '../../lib/wakelock';
  import { demo, demoPick } from './demo';
  import { ask, phone, refusals } from './player.svelte';
  import { nameIn, said } from './labels';
  import Books from './Books.svelte';
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
   * The rank and player tapped on this turn (`at`) of this seat's room, and whether Ask was sent:
   * shown at once, before the host answers. A turn counter starts again in a new room, so the
   * choice belongs to its seat.
   */
  // svelte-ignore state_referenced_locally
  let choice = $state<{ seat: string; at: number; rank?: Rank; to?: string; sent?: boolean } | null>(demoPick(fixed) && v ? { seat: 'demo', at: v.at, ...demoPick(fixed) } : null);
  const mine = $derived(v && seat && choice?.seat === seat && choice.at === v.at ? choice : null);
  const me = $derived(v?.players.find((p) => p.pid === pid));
  const name = $derived(v ? nameIn(v) : () => '');
  const hand = $derived(v?.hand ?? []);
  const myTurn = $derived(!!v && v.phase === 'turn' && v.turn === pid && !!v.hand);
  const asking = $derived(!!mine?.sent);
  const targets = $derived(v ? v.players.filter((p) => p.pid !== pid && !p.out && !p.watching) : []);
  const picked = $derived(mine?.rank ? hand.filter((c) => rankOf(c) === mine.rank) : []);

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
  // An ask the host turned down (the turn had moved on, say): pick again.
  $effect(() => {
    if (refusals.count) untrack(() => { if (choice) choice = { ...choice, sent: false }; });
  });
  // Not seated in that room any more (left, removed, the room closed, another room joined): the choice goes.
  $effect(() => {
    const now = seat;
    untrack(() => { if (choice && choice.seat !== now) choice = null; });
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

  function choose(patch: { rank?: Rank; to?: string }) {
    if (!v || v.paused || !myTurn || asking) return;
    sfx.tap();
    choice = { ...(mine ?? { seat, at: v.at }), ...patch };
  }
  const tapCard = (card: Card) => choose({ rank: rankOf(card) });

  function send() {
    if (!v || !mine?.rank || !mine.to || asking || !myTurn) return;
    choice = { ...mine, sent: true };
    if (!fixed) ask(v.at, mine.to, mine.rank);
  }
  const askLabel = $derived(asking ? 'Asking…' : mine?.rank && mine.to ? `Ask ${name(mine.to)} for ${rankPlural(mine.rank)}` : mine?.rank ? 'Now tap a player' : 'Tap a card first');
</script>

{#snippet askBar()}
  <Button size="lg" onclick={send} disabled={!mine?.rank || !mine.to || asking || v?.paused}>{askLabel}</Button>
{/snippet}

{#if !fixed}<SeatWait link={phone} />{/if}

{#if !v || (!fixed && phone.stopped)}
  {#key code}<Join code={code || phone.me?.code || ''} fixed={!!fixed} />{/key}
{:else}
  <Screen title={gameName('fish')} onback={() => fixed ? back('/fish') : (leaving = true)} actions={myTurn ? askBar : undefined}>
    {#snippet trailing()}<HowTo><Rules /></HowTo>{/snippet}
    <div class="play" inert={v.paused}>
      {#if !fixed && phone.link !== 'live'}<p class="lost" role="status">{phone.trouble || 'Reconnecting…'}</p>{/if}
      <div class="me">
        <p>{#if me}<b>{me.name}</b>{' · '}{/if}{v.phase === 'lobby' ? `Room ${fixed ? 'GFSH' : phone.me?.code ?? ''}` : v.phase === 'over' ? 'Game over' : `Pool ${v.pool}`}</p>
        <Timer left={remaining} total={v.total} paused={v.paused} size={46} />
      </div>
      {#if v.phase === 'lobby'}
        <h2>You’re in!</h2>
        <p class="muted">The cards are dealt from the host screen. Keep this screen open.</p>
        <Seats {v} />
      {:else if v.phase === 'over'}
        <Standings {v} you={pid} />
      {:else}
        <div class="status" role="status">
          {#if me?.watching}<p class="muted">You’re watching: you’ll be dealt in at the next deal.</p>{/if}
          {#if v.phase === 'show' && v.shown}
            {#each v.shown as e (e.n)}<p class="said">{said(e, name)}</p>{/each}
          {:else if myTurn}
            <h2 class="you">Your turn!</h2>
            <p class="muted">{asking ? 'Asking…' : 'Tap a card to ask for its rank, then a player.'}</p>
          {:else if v.turn}
            <h2>{name(v.turn)} is asking…</h2>
          {/if}
        </div>
        {#if v.drew !== undefined}
          <p class="drew"><PlayingCard card={v.drew} size="sm" named={false} /> You drew the {cardName(v.drew)}.</p>
        {/if}
        {#if v.hand}
          {#if hand.length}
            <CardFan cards={hand} selected={picked} onpick={myTurn && !asking ? tapCard : undefined} label="Your hand, {hand.length} cards" />
          {:else}<p class="muted">No cards in your hand. On your turn you draw one from the pool.</p>{/if}
        {/if}
        {#if myTurn}
          <div class="targets" role="group" aria-label="Ask a player">
            {#each targets as p (p.pid)}
              <button aria-pressed={mine?.to === p.pid} disabled={!p.cards || asking} onclick={() => choose({ to: p.pid })}>
                <b>{p.name}</b><span>{p.cards ? `${p.cards} ${p.cards === 1 ? 'card' : 'cards'}` : 'No cards'}</span>
              </button>
            {/each}
          </div>
        {/if}
        {#if me && !me.watching}<div class="books"><span>Your books</span><Books books={me.books} /></div>{/if}
      {/if}
      <Button variant="ghost" onclick={() => (leaving = true)} tip="Leaves after asking; the same code lets you back in">Leave room</Button>
    </div>
    {#if v.paused}<div class="paused" role="status"><div><h2>Paused</h2><p>Waiting for the host to resume.</p></div></div>{/if}
  </Screen>
{/if}
{#if leaving}
  <Popup title="Leave the room?" onclose={() => (leaving = false)}>
    <p>{v && v.phase !== 'lobby' && v.phase !== 'over' ? 'Your cards go back into the pool. You can rejoin with the same code and keep your books.' : 'You can rejoin with the same code.'}</p>
    <Button variant="danger" onclick={() => { if (!fixed) phone.leave(); back('/fish'); }}>Leave</Button>
    <Button variant="secondary" onclick={() => (leaving = false)}>Stay</Button>
  </Popup>
{/if}

<style>
  .play { display: grid; gap: var(--s-3); padding-bottom: var(--s-4); }
  .me { display: flex; align-items: center; justify-content: space-between; gap: var(--s-2); color: var(--text-dim); }
  .me p { overflow-wrap: anywhere; }
  .me b { color: var(--accent); font-family: var(--font-display); }
  h2 { overflow-wrap: anywhere; }
  .status { display: grid; gap: var(--s-1); }
  .you { color: var(--accent); }
  .said { font: 700 1.1rem / 1.3 var(--font-display); overflow-wrap: anywhere; }
  .drew { display: flex; align-items: center; gap: var(--s-2); font-weight: 600; }
  .targets { display: grid; gap: var(--s-2); grid-template-columns: repeat(auto-fill, minmax(min(100%, 140px), 1fr)); }
  .targets button { display: grid; gap: 2px; min-height: var(--tap-min); padding: var(--s-2) var(--s-3); text-align: left; border: 2px solid var(--line-strong); border-radius: var(--r-md); background: var(--surface); color: var(--text); }
  .targets button b { overflow-wrap: anywhere; line-height: 1.2; }
  .targets button span { color: var(--text-dim); font-size: 0.85rem; }
  .targets button[aria-pressed='true'] { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 18%, var(--surface)); }
  .targets button:disabled { opacity: 0.45; }
  .books { display: flex; align-items: center; gap: var(--s-2); flex-wrap: wrap; color: var(--text-dim); font-weight: 600; }
  .lost { padding: var(--s-2) var(--s-3); text-align: center; border-radius: var(--r-md); background: var(--surface); }
  .paused { position: fixed; inset: 0; z-index: var(--z-overlay); display: grid; place-items: center; background: color-mix(in srgb, var(--bg) 85%, transparent); }
  .paused > div { display: grid; gap: var(--s-2); text-align: center; padding: var(--s-5); background: var(--surface); border-radius: var(--r-lg); }
</style>
