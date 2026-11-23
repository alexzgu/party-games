<script lang="ts">
  // A player's phone: the join form, then whatever the host screen says this player needs now
  // (answer, vote), and in between what the host screen shows, so nobody needs to see it.
  // The link reconnects by itself; a banner says when it is doing so.
  import { onMount } from 'svelte';
  import { route, back } from '../../lib/router.svelte';
  import { keepAwake } from '../../lib/wakelock';
  import { haptic } from '../../lib/haptics';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import HowTo from '../../components/HowTo.svelte';
  import Rules from './Rules.svelte';
  import Avatar from '../../components/room/Avatar.svelte';
  import Timer from '../../components/room/Timer.svelte';
  import Join from './Join.svelte';
  import ConnectionLink from '../../components/room/ConnectionLink.svelte';
  import Popup from '../../components/Popup.svelte';
  import PhoneWrite from './PhoneWrite.svelte';
  import PhoneVote from './PhoneVote.svelte';
  import PhoneVote3 from './PhoneVote3.svelte';
  import PhoneWatch from './PhoneWatch.svelte';
  import { phone } from './player.svelte';
  import { cleanCode } from '../../lib/room/code';
  import { playerColor, roundName } from './look';
  import { pts } from './record';
  import { demoPhone } from './demo';
  import type { ToHost } from './protocol';

  const demo = route.params.get('demo') ?? '';
  const fixed = demo ? demoPhone(demo) : null;
  const view = $derived(fixed ? fixed.view : phone.view);
  const link = $derived(fixed ? fixed.link : phone.link);
  const stopped = $derived(fixed ? '' : phone.stopped);
  const trouble = $derived(fixed ? '' : phone.trouble);

  let now = $state(Date.now());
  const left = $derived(fixed ? (fixed.view?.left ?? null) : phone.left(now));
  const routeCode = cleanCode(route.params.get('code') ?? '');
  let leaving = $state(false);
  function rebroker() { const me = phone.me; if (me?.code) phone.join(me.code, me.name); }

  onMount(() => {
    const me = phone.me;
    if (!fixed && phone.link === 'idle' && me?.code && me.joined && (!routeCode || routeCode === me.code)) phone.rejoin();
    const t = setInterval(() => (now = Date.now()), 250);
    return () => { clearInterval(t); keepAwake(false); };
  });

  $effect(() => keepAwake(!fixed && (link === 'live' || link === 'lost' || link === 'joining')));

  // A buzz when the phone needs the player: a prompt to answer or a vote to cast.
  let lastScreen = '';
  $effect(() => {
    const k = view ? `${view.round}:${view.screen.k}:${'at' in view.screen ? view.screen.at : ''}` : '';
    if (k === lastScreen) return;
    lastScreen = k;
    if (!fixed && view && (view.screen.k === 'write' || view.screen.k === 'vote' || view.screen.k === 'vote3')) haptic.light();
  });

  const send = (m: ToHost) => { if (!fixed) phone.send(m); };
</script>

{#if link === 'idle' || link === 'stopped'}
  <Join code={routeCode || (phone.me?.code ?? '')} name={phone.me?.name ?? ''} {stopped} />
{:else if !view}
  <Screen title="Joining {phone.me?.code ?? ''}" onback={() => { phone.leave(); back('/snark'); }} backLabel="Cancel">
    <div class="wait">
      <div class="spinner" aria-hidden="true"></div>
      <p class="big">Finding the host screen…</p>
      {#if trouble}<p class="trouble" role="alert">{trouble}</p>{/if}
      <ConnectionLink onchange={rebroker} />
    </div>
    {#snippet actions()}
      <Button variant="secondary" onclick={() => phone.leave()}>Cancel</Button>
    {/snippet}
  </Screen>
{:else}
  {@const s = view.screen}
  <div class="phone" style:--me={playerColor(view.me.color)}>
    <header class="bar">
      <Avatar name={view.me.name} color={view.me.color} size={40} />
      <span class="who"><b>{view.me.name}</b><small>{pts(view.me.score)} pts · {view.round ? roundName(view.round, view.rounds) : `Room ${view.code}`}</small></span>
      {#if s.k === 'write' || s.k === 'late' || s.k === 'vote' || s.k === 'vote3'}<Timer {left} total={view.span} paused={view.paused} size={52} />{/if}
      <HowTo><Rules /></HowTo>
    </header>
    {#if link === 'lost'}<p class="lost" role="status">Reconnecting… stay on this screen</p>{/if}

    <main class="body">
      {#if s.k === 'write'}
        {#key `${view.code}:${view.round}`}
          <PhoneWrite code={view.code} round={view.round} tasks={s.tasks} total={s.total} final={view.final} lines={s.lines} writers={s.writers}
            onsend={(i, text) => send({ t: 'answer', r: view.round, i, text })} onlines={(i, lines) => send({ t: 'lines', r: view.round, i, lines })} />
        {/key}
      {:else if s.k === 'vote'}
        {#key `${view.round}:${s.at}`}<PhoneVote screen={s} onvote={(c) => send({ t: 'vote', r: view.round, at: s.at, c })} />{/key}
      {:else if s.k === 'vote3'}
        {#key `${view.round}:${s.at}`}<PhoneVote3 screen={s} onsend={(v) => send({ t: 'votes', r: view.round, at: s.at, v })} />{/key}
      {:else}
        <PhoneWatch {view} {left} />
        <button class="leave" onclick={() => (leaving = true)} data-tip="Leaves after asking; the same code lets you back in">Leave room</button>
      {/if}
    </main>

    {#if view.paused}
      <div class="paused fade-in" role="status"><p class="big">Paused</p><p class="muted">The host paused the game.</p></div>
    {/if}
  </div>
{/if}

{#if leaving}
  <Popup title="Leave room?" onclose={() => (leaving = false)}>
    <div class="confirm">
      <p>{view && view.round ? 'You won’t get any more prompts or votes. You can rejoin with the same code and keep your score.' : 'You can rejoin with the same code.'}</p>
      <Button variant="danger" onclick={() => { leaving = false; if (!fixed) phone.leave(); back('/snark'); }}>Leave room</Button>
      <Button variant="secondary" onclick={() => (leaving = false)}>Stay</Button>
    </div>
  </Popup>
{/if}

<style>
  .leave { align-self: center; margin-top: var(--s-4); background: none; color: var(--text-faint); font-size: 0.9rem; min-height: 44px; padding: 0 var(--s-3); }
  .confirm { display: flex; flex-direction: column; gap: var(--s-2); }
  .confirm p { margin-bottom: var(--s-2); }
  .phone { min-height: 100dvh; display: flex; flex-direction: column; max-width: 640px; margin: 0 auto;
    padding: calc(var(--safe-top) + var(--s-2)) calc(var(--safe-right) + var(--s-4)) calc(var(--safe-bottom) + var(--s-3)) calc(var(--safe-left) + var(--s-4)); }
  .bar { display: flex; align-items: center; gap: var(--s-3); min-height: 56px; }
  .who { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.2; }
  .who b { font-family: var(--font-display); font-size: 1.15rem; color: var(--me); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .who small { color: var(--text-faint); font-weight: 600; }
  .lost { margin: var(--s-2) 0 0; padding: var(--s-2) var(--s-3); border-radius: var(--r-md); text-align: center; font-weight: 700;
    background: color-mix(in srgb, var(--c-pass) 16%, var(--surface)); color: var(--text); }
  .body { flex: 1; display: flex; flex-direction: column; padding-top: var(--s-4); }
  .wait { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--s-3); text-align: center; padding: var(--s-5) 0; }
  .big { font-family: var(--font-display); font-weight: 800; font-size: 1.8rem; line-height: 1.15; }
  .trouble { color: var(--bad-ink); font-weight: 600; max-width: 30ch; }
  .spinner { width: 48px; height: 48px; border-radius: 50%; border: 4px solid var(--overlay-strong); border-top-color: var(--accent); animation: spin 0.9s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .paused { position: fixed; inset: 0; z-index: var(--z-overlay); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--s-2); background: var(--scrim); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); text-align: center; }
</style>
