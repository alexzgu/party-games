<script lang="ts">
  import { gameName } from '../../app.config';
  import { untrack } from "svelte";
  import Screen from '../../components/Screen.svelte';
  import HowTo from '../../components/HowTo.svelte';
  import Popup from '../../components/Popup.svelte';
  import Button from '../../components/Button.svelte';
  import Timer from '../../components/room/Timer.svelte';
  import { go, route } from '../../lib/router.svelte';
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
  <Screen title={gameName('brawl')} onback={() => fixed ? go('/brawl') : (leaving = true)}>
    {#snippet trailing()}<HowTo><Rules /></HowTo>{/snippet}
    <div class="play">
      {#if !fixed && phone.link !== 'live'}<p role="status">{phone.trouble || 'Reconnecting…'}</p>{/if}
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
    <Button variant="danger" onclick={() => { phone.leave(); gallery.art = {}; go('/brawl'); }}>Leave</Button>
    <Button variant="secondary" onclick={() => (leaving = false)}>Stay</Button>
  </Popup>
{/if}

<style>
  .play { display: grid; gap: var(--s-2); padding-bottom: var(--s-4); }
  .heading { display: flex; align-items: center; justify-content: space-between; gap: var(--s-2); }
  .heading h3 { font-size: clamp(1.25rem, 5vw, 2rem); }
  .heading p { color: var(--text-dim); }
</style>
