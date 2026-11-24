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
  import { ordinal } from '../../lib/room/look';
  import { sfx } from '../../lib/sound';
  import { keepAwake } from '../../lib/wakelock';
  import { demo } from './demo';
  import { answer, phone, refusals } from './player.svelte';
  import { gain } from './labels';
  import type { Choice } from './logic';
  import Answers from './Answers.svelte';
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
   * The answer this phone has just tapped in this phase (`at`) of this seat's room: shown at once,
   * before the host answers. A phase counter starts again in a new room, so the tap belongs to its seat.
   */
  let sent = $state<{ seat: string; at: number; choice: Choice } | null>(null);
  const me = $derived(v?.players.find((p) => p.pid === pid));
  const mine = $derived(v && seat && sent?.seat === seat && sent.at === v.at ? sent.choice : v?.mine);
  const gained = $derived(v?.result?.gains.find((g) => g.pid === pid)?.points ?? 0);
  const place = $derived(me && v ? ordinal(1 + v.players.filter((p) => p.score > me.score).length) : '');

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

  function pick(choice: Choice) {
    if (!v || v.paused || v.phase !== 'answer' || mine !== undefined) return;
    sfx.tap();
    sent = { seat, at: v.at, choice };
    if (!fixed) answer(v.at, v.n, choice);
  }

  /** What the reveal means for this phone. */
  function verdict(): string {
    const r = v?.result;
    if (!r || !v?.answers) return '';
    if (v.mine === undefined) return 'Time’s up!';
    return v.mine === r.right ? `Right! ${gain(gained)}` : 'Not quite.';
  }
</script>

{#if !fixed}<SeatWait link={phone} />{/if}

{#if !v || (!fixed && phone.stopped)}
  {#key code}<Join code={code || phone.me?.code || ''} fixed={!!fixed} />{/key}
{:else}
  <Screen title={gameName('trivia')} onback={() => fixed ? back('/trivia') : (leaving = true)}>
    {#snippet trailing()}<HowTo><Rules /></HowTo>{/snippet}
    <div class="play" inert={v.paused}>
      {#if !fixed && phone.link !== 'live'}<p class="lost" role="status">{phone.trouble || 'Reconnecting…'}</p>{/if}
      <div class="me">
        <p>{#if me}<b>{me.name}</b> · {me.score} {me.score === 1 ? 'point' : 'points'}{' · '}{/if}{v.n ? `Question ${v.n} of ${v.count}` : `Room ${fixed ? 'SMRT' : phone.me?.code ?? ''}`}</p>
        <Timer left={remaining} total={v.total} paused={v.paused} size={46} />
      </div>
      {#if v.phase === 'lobby'}
        <h2>You’re in!</h2>
        <p class="muted">The game starts from the host screen. Keep this screen open.</p>
        <Seats {v} />
      {:else if v.phase === 'category' && v.category}
        <p class="muted center">Get ready…</p>
        <p class="category">{v.category}</p>
      {:else if v.phase === 'answer' && v.question && v.answers}
        <p class="cat">{v.category}</p>
        <h2 class="question">{v.question}</h2>
        <Answers answers={v.answers} size="md" picked={mine} onpick={pick} disabled={v.paused} />
        <p class="hint" role="status">{mine === undefined ? 'Tap your answer: your first tap is final.' : 'Locked in. Waiting for the others…'}
          {v.answered?.length ?? 0} of {v.players.length} answered.</p>
      {:else if v.phase === 'reveal' && v.question && v.answers && v.result}
        <h2 class:win={v.mine === v.result.right}>{verdict()}</h2>
        <p class="answer-line">The answer: <b>{v.answers[v.result.right]}</b></p>
        <Answers answers={v.answers} size="sm" picked={v.mine} right={v.result.right} counts={v.result.counts} />
        {#if me}<p class="muted center">You’re {place} with {me.score} {me.score === 1 ? 'point' : 'points'}.</p>{/if}
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
    <Button variant="danger" onclick={() => { if (!fixed) phone.leave(); back('/trivia'); }}>Leave</Button>
    <Button variant="secondary" onclick={() => (leaving = false)}>Stay</Button>
  </Popup>
{/if}

<style>
  .play { display: grid; gap: var(--s-3); padding-bottom: var(--s-4); }
  .me { display: flex; align-items: center; justify-content: space-between; gap: var(--s-2); color: var(--text-dim); }
  .me p { overflow-wrap: anywhere; }
  .me b { color: var(--accent); font-family: var(--font-display); }
  h2 { overflow-wrap: anywhere; }
  .question { font-size: 1.3rem; line-height: 1.25; }
  .cat { color: var(--accent); font: 800 0.95rem / 1.2 var(--font-display); text-transform: uppercase; letter-spacing: 0.04em; }
  .category { color: var(--accent); text-align: center; overflow-wrap: anywhere; font: 800 clamp(2.2rem, 11vw, 3.4rem) / 1.1 var(--font-display); margin-block: var(--s-5); }
  .center { text-align: center; }
  .answer-line { overflow-wrap: anywhere; }
  .win { color: var(--accent); }
  .hint { color: var(--text-dim); text-align: center; }
  .lost { padding: var(--s-2) var(--s-3); text-align: center; border-radius: var(--r-md); background: var(--surface); }
  .paused { position: fixed; inset: 0; z-index: var(--z-overlay); display: grid; place-items: center; background: color-mix(in srgb, var(--bg) 85%, transparent); }
  .paused > div { display: grid; gap: var(--s-2); text-align: center; padding: var(--s-5); background: var(--surface); border-radius: var(--r-lg); }
</style>
