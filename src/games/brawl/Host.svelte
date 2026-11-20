<script lang="ts">
  import { untrack } from 'svelte';
  import { gameName } from '../../app.config';
  import Button from '../../components/Button.svelte';
  import HowTo from '../../components/HowTo.svelte';
  import Popup from '../../components/Popup.svelte';
  import Qr from '../../components/room/Qr.svelte';
  import Connection from '../../components/room/Connection.svelte';
  import TapToFinish from '../../components/room/TapToFinish.svelte';
  import Timer from '../../components/room/Timer.svelte';
  import { go, route } from '../../lib/router.svelte';
  import { brokerSetting } from '../../lib/room/broker';
  import { joinLink } from '../../lib/room/look';
  import { keepAwake } from '../../lib/wakelock';
  import { host } from './host.svelte';
  import { demo, demoArt } from './demo';
  import { view } from './view';
  import { active, canStart, type Player } from './logic';
  import Stage from './Stage.svelte';
  import Rules from './Rules.svelte';
  import { phaseLabel } from './labels';

  const fixed = $derived(route.params.get('demo'));
  const game = $derived(host.game);
  const v = $derived(fixed ? demo(fixed, false) : game ? view(game, host.now) : null);
  let confirm = $state(false);
  let connection = $state(false);
  let brokerChanged = $state(0);
  let kicking = $state<Player | null>(null);
  const link = $derived.by(() => {
    void brokerChanged;
    return joinLink('brawl', fixed ? 'BRWK' : game?.code ?? '', brokerSetting());
  });

  $effect(() => {
    if (fixed) return;
    untrack(() => host.open());
    keepAwake(true);
    return () => keepAwake(false);
  });

  function shortcuts(e: KeyboardEvent) {
    if (fixed || e.code !== 'Space' || e.repeat || e.target !== document.body || confirm || connection || kicking) return;
    e.preventDefault();
    host.pause();
  }
</script>

<svelte:window onkeydown={shortcuts} />
<main>
  <header>
    <Button variant="secondary" onclick={() => fixed ? go('/brawl') : (confirm = true)}>Back</Button>
    <h2>{gameName('brawl')}</h2>
    <HowTo><Rules /></HowTo>
  </header>
  {#if v}
    {#if v.phase === 'lobby'}
      <div class="lobby">
        <div class="qr">
          <h3>Join on your phone</h3>
          <Qr text={link} label="Scan to join" size={220} />
          <strong>{fixed ? 'BRWK' : game?.code}</strong>
          <p>Scan the code or choose Join in {gameName('brawl')}.</p>
        </div>
        <section>
          <h3>Players · {v.players.length} / 8</h3>
          <Stage {v} art={{}} online={fixed ? undefined : host.online} />
          {#if game && !fixed}
            {#each active(game) as p (p.pid)}
              <Button size="sm" variant="secondary" onclick={() => (kicking = p)}>Remove {p.name}</Button>
            {/each}
          {/if}
          {#if host.trouble && !fixed}<p role="status">{host.trouble}</p>{/if}
          <div class="controls">
            <Button disabled={fixed ? v.players.length < 3 : !game || !canStart(game)} onclick={() => { if (!fixed) host.start(); }}>Start</Button>
            <Button variant="secondary" onclick={() => go('/brawl/settings')}>Settings</Button>
            <Button variant="secondary" onclick={() => (connection = true)}>Connection</Button>
          </div>
        </section>
      </div>
    {:else}
      <div class="heading">
        <div>
          <p>Round {v.round} · {phaseLabel(v)}</p>
          {#if v.title}<h3 class="title">{v.title}</h3>{/if}
        </div>
        <Timer left={v.left} total={v.total} paused={v.paused} size={52} />
      </div>
      <TapToFinish><Stage {v} art={fixed ? demoArt : host.art} online={fixed ? undefined : host.online} /></TapToFinish>
      <div class="controls">
        {#if v.phase === 'over'}
          <Button onclick={() => { if (!fixed) host.rematch(); }}>Play again</Button>
          <Button variant="secondary" onclick={() => (confirm = true)}>Close room</Button>
        {:else}
          <Button variant="secondary" onclick={() => { if (!fixed) host.pause(); }}>{v.paused ? 'Resume' : 'Pause'}</Button>
          <Button variant="secondary" onclick={() => { if (!fixed) host.skip(); }}>{v.phase === 'draw' || v.phase === 'challenge' ? 'End drawing' : v.phase === 'vote' ? 'End voting' : 'Next'}</Button>
        {/if}
      </div>
    {/if}
  {:else}<p>Opening room…</p>{/if}
</main>

{#if confirm}
  <Popup title="Close the room?" onclose={() => (confirm = false)}>
    <p>Everyone will be disconnected.</p>
    <Button variant="danger" onclick={() => { if (!fixed) host.close(); go('/brawl'); }}>Close room</Button>
    <Button variant="secondary" onclick={() => (confirm = false)}>Keep playing</Button>
  </Popup>
{/if}
{#if connection}
  <Connection onclose={() => (connection = false)} onchange={() => { brokerChanged++; if (!fixed) host.rebroker(); }} />
{/if}
{#if kicking}
  {@const p = kicking}
  <Popup title="Remove {p.name}?" onclose={() => (kicking = null)}>
    <Button variant="danger" onclick={() => { host.kick(p.pid); kicking = null; }}>Remove {p.name}</Button>
    <Button variant="secondary" onclick={() => (kicking = null)}>Cancel</Button>
  </Popup>
{/if}

<style>
  main { width: min(100%, 1140px); margin: auto; display: grid; gap: var(--s-3); padding: calc(var(--safe-top) + var(--s-3)) var(--s-4) calc(var(--safe-bottom) + var(--s-4)); }
  header, .heading, .controls { display: flex; align-items: center; justify-content: space-between; gap: var(--s-2); }
  header h2 { text-align: center; }
  .heading { justify-content: center; text-align: center; }
  .heading p { color: var(--text-dim); }
  .title { font-size: clamp(1.45rem, 5vmin, 3.5rem); overflow-wrap: anywhere; }
  .controls { flex-wrap: wrap; justify-content: center; }
  .lobby { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: center; gap: var(--s-5); }
  section, .qr { display: grid; gap: var(--s-3); }
  .qr { text-align: center; justify-items: center; }
  .qr strong { color: var(--accent); font: 800 clamp(2rem, 6vw, 5rem)/1 var(--font-display); letter-spacing: 0.18em; }
  @media (max-width: 720px) { .lobby { grid-template-columns: 1fr; } }
</style>
