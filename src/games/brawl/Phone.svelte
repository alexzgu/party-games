<script lang="ts">
  import { gameName } from '../../app.config';
  import { untrack } from "svelte";
  import Screen from '../../components/Screen.svelte';
  import HowTo from '../../components/HowTo.svelte';
  import Popup from '../../components/Popup.svelte';
  import Button from '../../components/Button.svelte';
  import Timer from '../../components/room/Timer.svelte';
  import { back, route } from '../../lib/router.svelte';
  import { keepAwake } from '../../lib/wakelock';
  import { demo, demoArt } from './demo';
  import { phone, gallery } from './player.svelte';
  import { artIds } from './view';
  import { phaseLabel } from './labels';
  import type { Action } from './protocol';
  import PhoneDraw from './PhoneDraw.svelte';
  import Stage from './Stage.svelte';
  import Join from './Join.svelte';
  import Rules from './Rules.svelte';

  const fixed = $derived(route.params.get('demo'));
  const code = $derived(route.params.get('code') ?? '');
  const v = $derived(fixed ? fixed === 'join' ? null : demo(fixed, true) : phone.view);
  const art = $derived(fixed ? demoArt : gallery.art);
  let now = $state(Date.now());
  const remaining = $derived(fixed ? v?.left ?? null : phone.left(now));
  let leaving = $state(false);
  let sent = $state<number | null>(null);
  const me = $derived(fixed ? v?.players[0] : v?.players.find((p) => p.pid === phone.me?.pid));
  const roomCode = $derived(fixed ? 'BRWK' : phone.me?.code ?? '');
  /** Joined after this round's drawings were handed out. */
  const lateJoiner = $derived(!!v && !v.draw && !!v.artists && !!me && !v.artists.includes(me.pid));

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

  $effect(() => {
    keepAwake(!fixed && ['live', 'joining', 'lost'].includes(phone.link));
    return () => keepAwake(false);
  });

  $effect(() => {
    if (fixed || !v || phone.link !== 'live') return;
    const ids = [...new Set(artIds(v))].filter((id) => !art[id]);
    if (!ids.length) return;
    const request = () => ids.forEach((id) => phone.ask({ t: 'art?', id }));
    request();
    const interval = setInterval(request, 1500);
    return () => clearInterval(interval);
  });

  function send(m: Action) {
    if (sent === m.at || v?.paused) return;
    sent = m.at;
    if (!fixed) phone.send(m);
  }
</script>

{#if !v || (!fixed && phone.stopped)}
  {#key code}<Join code={code || phone.me?.code || ''} fixed={!!fixed} />{/key}
{:else}
  <Screen title={gameName('brawl')} onback={() => fixed ? back('/brawl') : (leaving = true)}>
    {#snippet trailing()}<HowTo><Rules /></HowTo>{/snippet}
    <div class="play">
      {#if !fixed && phone.link !== 'live'}<p role="status">{phone.trouble || 'Reconnecting…'}</p>{/if}
      {#if me && !v.draw}<p class="me"><b>{me.name}</b> · {me.score.toLocaleString()} pts · Room {roomCode}</p>{/if}
      {#if v.phase === 'lobby'}
        <p class="big">You’re in!</p>
        <p class="muted">The game starts from the host screen. Keep this screen open.</p>
      {:else if lateJoiner}
        <p class="muted">{v.round < 2 ? 'You joined after the drawings were handed out: you’ll vote on these bouts and draw next round.' : 'You joined during the last round: you’ll vote on these bouts.'}</p>
      {/if}
      <div class="heading">
        <div>
          <p>{v.round ? `Round ${v.round} · ` : ''}{phaseLabel(v)}</p>
          {#if v.title}<h3>{v.title}</h3>{/if}
        </div>
        <Timer left={remaining} total={v.total} paused={v.paused} size={46} />
      </div>
      {#if v.draw}
        {@const at = v.at}
        {#key v.draw.id}
          <PhoneDraw {v} {art} expired={remaining === 0} demo={!!fixed} ondraw={(name, d) => send({ t: 'draw', at, name, d })} />
        {/key}
      {:else}
        {@const at = v.at}
        <Stage v={sent === at ? { ...v, vote: false, options: undefined } : v} {art}
          onvote={(side) => send({ t: 'vote', at, side })}
          ontag={(id) => send({ t: 'tag', at, id })} />
      {/if}
    </div>
  </Screen>
{/if}
{#if leaving}
  <Popup title="Leave the room?" onclose={() => (leaving = false)}>
    <p>{v && v.phase !== 'lobby' && v.phase !== 'over' ? 'You won’t get any more turns. You can rejoin with the same code and keep your score.' : 'You can rejoin with the same code.'}</p>
    <Button variant="danger" onclick={() => { phone.leave(); gallery.art = {}; back('/brawl'); }}>Leave</Button>
    <Button variant="secondary" onclick={() => (leaving = false)}>Stay</Button>
  </Popup>
{/if}

<style>
  .play { display: grid; gap: var(--s-2); padding-bottom: var(--s-4); }
  .heading { display: flex; align-items: center; justify-content: space-between; gap: var(--s-2); }
  .heading h3 { font-size: clamp(1.25rem, 5vw, 2rem); }
  .heading p { color: var(--text-dim); }
  .me { color: var(--text-dim); overflow-wrap: anywhere; }
  .me b { color: var(--accent); font-family: var(--font-display); }
  .big { font: 800 1.8rem / 1.15 var(--font-display); }
</style>
