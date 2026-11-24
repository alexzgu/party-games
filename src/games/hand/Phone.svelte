<script lang="ts">
  import { untrack } from 'svelte';
  import { gameName } from '../../app.config';
  import Screen from '../../components/Screen.svelte';
  import SeatNumber from '../../components/room/SeatNumber.svelte';
  import HowTo from '../../components/HowTo.svelte';
  import Popup from '../../components/Popup.svelte';
  import Button from '../../components/Button.svelte';
  import Timer from '../../components/room/Timer.svelte';
  import { back, route } from '../../lib/router.svelte';
  import { keepAwake } from '../../lib/wakelock';
  import { demo, demoStart } from './demo';
  import { phone, refusals } from './player.svelte';
  import { nameIn } from './labels';
  import type { ToHost } from './protocol';
  import Answers from './Answers.svelte';
  import Join from './Join.svelte';
  import PhoneHand from './PhoneHand.svelte';
  import PhonePick from './PhonePick.svelte';
  import PromptCard from './PromptCard.svelte';
  import Rules from './Rules.svelte';
  import Seats from './Seats.svelte';
  import Standings from './Standings.svelte';

  const fixed = $derived(route.params.get('demo'));
  const code = $derived(route.params.get('code') ?? '');
  const v = $derived(fixed ? fixed === 'join' ? null : demo(fixed, true) : phone.view);
  const start = $derived(demoStart(fixed));
  let now = $state(Date.now());
  const remaining = $derived(fixed ? v?.left ?? null : phone.left(now));
  let leaving = $state(false);
  /** The phase (`at`) this phone has just played, picked or voted in, with what it played: shown at once, before the host answers. */
  let sent = $state<{ at: number; texts?: string[] } | null>(null);
  const pid = $derived(fixed ? 'a' : phone.me?.pid ?? '');
  const me = $derived(v?.players.find((p) => p.pid === pid));
  const name = $derived(v ? nameIn(v) : () => '');
  const done = $derived(!!v && sent?.at === v.at);
  const played = $derived(v?.played ?? (done ? sent?.texts : undefined));
  const judging = $derived(!!v && v.judge === pid);

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
  // A play, pick or vote the host turned down (a stale hand, say): back to choosing.
  $effect(() => {
    if (refusals.count) untrack(() => { sent = null; });
  });
  $effect(() => {
    keepAwake(!fixed && ['live', 'joining', 'lost'].includes(phone.link));
    return () => keepAwake(false);
  });

  function send(m: ToHost, texts?: string[]) {
    if (!v || v.paused) return;
    if (m.t === 'play' || m.t === 'pick' || m.t === 'vote') {
      if (done) return;
      sent = { at: m.at, texts };
    }
    if (!fixed) phone.send(m);
  }
  const trade = (cards: number[]) => send({ t: 'trade', n: v?.traded ?? 0, cards });
</script>

{#if !fixed}<SeatNumber number={phone.number} />{/if}

{#snippet hand(withPrompt: boolean)}
  {#if v?.hand?.length}
    {@const at = v.at}
    {#key `${at}:${v.traded}:${refusals.count}`}
      <PhoneHand hand={v.hand} prompt={withPrompt ? v.prompt : undefined} picks={v.picks} canTrade={!!v.trade} disabled={v.paused}
        start={start.cards} startTyped={start.typed} startTrading={start.trading}
        onplay={(cards, texts) => send({ t: 'play', at, cards, texts }, cards.map((c, i) => texts[i] || v.hand?.find((x) => x.id === c)?.text || ''))}
        ontrade={trade} />
    {/key}
  {/if}
{/snippet}

{#if !v || (!fixed && phone.stopped)}
  {#key code}<Join code={code || phone.me?.code || ''} fixed={!!fixed} />{/key}
{:else}
  <Screen title={gameName('hand')} onback={() => fixed ? back('/hand') : (leaving = true)}>
    {#snippet trailing()}<HowTo><Rules /></HowTo>{/snippet}
    <div class="play" inert={v.paused}>
      {#if !fixed && phone.link !== 'live'}<p class="lost" role="status">{phone.trouble || 'Reconnecting…'}</p>{/if}
      <div class="me">
        <p>{#if me}<b>{me.name}</b> · {me.score} {me.score === 1 ? 'point' : 'points'}{' · '}{/if}{v.round ? `Round ${v.round} · first to ${v.target}` : `Room ${fixed ? 'HNDZ' : phone.me?.code ?? ''}`}</p>
        <Timer left={remaining} total={v.total} paused={v.paused} size={46} />
      </div>
      {#if v.phase === 'lobby'}
        <h2>You’re in!</h2>
        <p class="muted">The game starts from the host screen. Keep this screen open.</p>
        <Seats {v} />
      {:else if v.phase === 'answer' && v.prompt}
        {#if judging}
          <h2>You’re the judge</h2>
          <p class="muted">Everyone else is playing a card. You’ll pick the funniest.</p>
          <PromptCard prompt={v.prompt} />
          <Seats {v} />
          {@render hand(false)}
        {:else if played}
          <h2>Played</h2>
          <PromptCard prompt={v.prompt} answers={played} label="Your answer" />
          <Seats {v} />
          {#if v.trade}{@render hand(false)}{/if}
        {:else if !v.answering?.includes(pid)}
          <h2>You’re in from the next prompt</h2>
          <p class="muted">You joined after this prompt was dealt.</p>
          <PromptCard prompt={v.prompt} />
          <Seats {v} />
          {@render hand(false)}
        {:else}
          {@render hand(true)}
        {/if}
      {:else if (v.phase === 'judge' || v.phase === 'vote') && v.prompt && v.answers}
        {@const at = v.at}
        {#if v.phase === 'judge' && judging && !done}
          <h2>Pick the funniest</h2>
          <p class="muted">Tap one to show it big on the host screen and read it out. Then pick.</p>
          <PhonePick prompt={v.prompt} answers={v.answers} selected={v.spotlight} confirm="Pick" disabled={v.paused}
            onselect={(i) => send({ t: 'spot', at, i })} onconfirm={(i) => send({ t: 'pick', at, i })} />
        {:else if v.phase === 'vote' && v.canVote && !v.hasVoted && !done}
          <h2>Vote for the funniest</h2>
          <p class="muted">The judge isn’t here, so everyone who played votes. Not for your own.</p>
          <PhonePick prompt={v.prompt} answers={v.answers} mine={v.mine} confirm="Vote" disabled={v.paused}
            onconfirm={(i) => send({ t: 'vote', at, i })} />
        {:else}
          <h2>{v.phase === 'vote' ? `Voting · ${v.progress?.length ?? 0} voted` : done ? 'Picked' : `${name(v.judge ?? '')} is judging`}</h2>
          <Answers prompt={v.prompt} answers={v.answers} spotlight={v.spotlight} mine={v.mine} {name} />
        {/if}
      {:else if v.phase === 'reveal' && v.prompt && v.answers && v.winner !== null && v.winner !== undefined}
        {@const won = v.answers[v.winner]}
        <h2 class="win">{won.by === pid ? 'You win the point!' : `${name(won.by ?? '')} ${won.by === 'house' ? 'wins' : 'wins the point'}`}</h2>
        <PromptCard prompt={v.prompt} answers={won.texts} />
        {#if v.answers.length > 1}<Answers prompt={v.prompt} answers={v.answers} winner={v.winner} votes={v.votes} {name} />{/if}
        {#if v.trade}{@render hand(false)}{/if}
      {:else if v.phase === 'over'}
        <Standings {v} {name} you={pid} />
      {/if}
      <Button variant="ghost" onclick={() => (leaving = true)} tip="Leaves after asking; the same code lets you back in">Leave room</Button>
    </div>
    {#if v.paused}<div class="paused" role="status"><div><h2>Paused</h2><p>Waiting for the host to resume.</p></div></div>{/if}
  </Screen>
{/if}
{#if leaving}
  <Popup title="Leave the room?" onclose={() => (leaving = false)}>
    <p>{v && v.phase !== 'lobby' && v.phase !== 'over' ? 'Your cards go back in the deck. You can rejoin with the same code and keep your points.' : 'You can rejoin with the same code.'}</p>
    <Button variant="danger" onclick={() => { if (!fixed) phone.leave(); back('/hand'); }}>Leave</Button>
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
  .lost { padding: var(--s-2) var(--s-3); text-align: center; border-radius: var(--r-md); background: var(--surface); }
  .paused { position: fixed; inset: 0; z-index: var(--z-overlay); display: grid; place-items: center; background: color-mix(in srgb, var(--bg) 85%, transparent); }
  .paused > div { display: grid; gap: var(--s-2); text-align: center; padding: var(--s-5); background: var(--surface); border-radius: var(--r-lg); }
</style>
