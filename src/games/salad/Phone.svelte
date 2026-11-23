<script lang="ts">
  import { onMount } from 'svelte';
  import Avatar from '../../components/room/Avatar.svelte';
  import Button from '../../components/Button.svelte';
  import ConnectionLink from '../../components/room/ConnectionLink.svelte';
  import HowTo from '../../components/HowTo.svelte';
  import Popup from '../../components/Popup.svelte';
  import Screen from '../../components/Screen.svelte';
  import Timer from '../../components/room/Timer.svelte';
  import { route, back } from '../../lib/router.svelte';
  import { cleanCode, newPid } from '../../lib/room/code';
  import { keepAwake } from '../../lib/wakelock';
  import { phone } from './player.svelte';
  import { demoPhone } from './demo';
  import { awayWords } from './view';
  import type { ToHost } from './protocol';
  import Rules from './Rules.svelte';
  import Join from './Join.svelte';
  import PhoneGuess from './PhoneGuess.svelte';
  import PhoneCompose from './PhoneCompose.svelte';
  import PhonePick from './PhonePick.svelte';
  import Guesses from './Guesses.svelte';
  import Clues from './Clues.svelte';
  import Reveal from './Reveal.svelte';
  import Standings from './Standings.svelte';

  const demo = route.params.get('demo');
  const fixed = demo !== null ? demoPhone(demo) : null;
  const routeCode = $derived(cleanCode(route.params.get('code') ?? ''));
  const view = $derived(fixed ? fixed.view : phone.view);
  // The room this phone is in or was just turned away from (a refusal forgets the code but keeps its reason).
  const differentRoom = $derived(!fixed && !!routeCode && routeCode !== (phone.me?.code || phone.room));
  const link = $derived(fixed ? fixed.link : differentRoom ? 'idle' : phone.link);
  const player = $derived(view?.players.find((p) => p.pid === view?.you));
  const presenter = $derived(view?.players.find((p) => p.pid === view?.presenter));
  let now = $state(Date.now());
  const left = $derived(fixed ? view?.left ?? null : phone.left(now));
  const turn = $derived(view ? `${view.code}/${view.you}/${view.serial}` : '');
  let leaving = $state(false);

  onMount(() => {
    if (fixed) return;
    if (phone.link === 'idle' && phone.me?.joined && !differentRoom) phone.rejoin();
    const clock = setInterval(() => (now = Date.now()), 250);
    return () => { clearInterval(clock); keepAwake(false); };
  });

  $effect(() => { if (!fixed) keepAwake(link === 'live' || link === 'lost' || link === 'joining'); });
  const send = (m: ToHost) => { if (!fixed) phone.send(m); };
  const join = (code: string, name: string) => { if (!fixed) phone.join(code, name); };
  const leave = () => { if (!fixed) phone.leave(); };

  function reconnect() {
    if (!fixed && phone.me?.code) phone.join(phone.me.code, phone.me.name);
  }
</script>

{#if link === 'idle' || link === 'stopped'}
  {#key routeCode}
    <Join initialCode={routeCode || (fixed ? 'BCDF' : phone.me?.code ?? '')}
      initialName={fixed ? '' : phone.me?.name ?? ''} stopped={fixed || differentRoom ? '' : phone.stopped}
      onjoin={join} onleave={leave} />
  {/key}
{:else if !view}
  <Screen title="Joining {phone.me?.code ?? ''}" onback={() => { leave(); back('/salad'); }} backLabel="Cancel">
    <p role="status">Finding the host screen…</p>
    {#if phone.trouble}<p role="alert">{phone.trouble}</p>{/if}
    <Button variant="secondary" onclick={leave}>Cancel</Button>
    <ConnectionLink onchange={reconnect} />
  </Screen>
{:else}
  <div class="phone">
    <header class="bar">
      {#if player}
        <Avatar name={player.name} color={player.seat} />
        <div class="who"><b>{player.name}</b><small>{player.score.toLocaleString()} pts · {view.round ? `Round ${view.round} of 2` : `Room ${view.code}`}</small></div>
      {/if}
      <Timer {left} total={view.span} paused={view.paused} size={52} />
      <HowTo><Rules /></HowTo>
    </header>
    {#if link === 'lost'}<p class="lost" role="status">{phone.trouble || 'Reconnecting…'}</p>{/if}

    <main inert={view.paused}>
      {#if view.phase === 'lobby'}
        <h2>Room {view.code}</h2>
        <p class="muted">The host will start the game.</p>
        <ul class="players" aria-label="Players in the room">
          {#each view.players.filter((p) => !p.kicked) as p (p.pid)}
            <li><Avatar name={p.name} color={p.seat} /><b>{p.name}</b></li>
          {/each}
        </ul>
      {:else if view.phase === 'pick' && !view.ready && view.offers.length}
        <h2>Pick a secret</h2>
        {#key `${turn}:${view.reshuffled}`}
          <PhonePick offers={view.offers} selected={view.selected} reshuffled={view.reshuffled} serial={view.serial} {send} />
        {/key}
        <Button variant="secondary" disabled={view.reshuffled} onclick={() => send({ serial: view.serial, t: 'reshuffle' })} tip={view.reshuffled ? 'You already got new secrets this round' : 'Swaps these secrets for new ones, once per round'}>
          {view.reshuffled ? 'Reshuffle used' : 'Reshuffle'}
        </Button>
      {:else if view.phase === 'prepare' && !view.ready && view.draft}
        <p class="secret">Your secret <strong>{view.secret?.answer}</strong></p>
        <h2>Build your opening clue</h2>
        {#key `${turn}:${view.draft.index}`}
          <PhoneCompose draft={view.draft} guesses={view.guesses} players={view.players} prepare {send} serial={view.serial} />
        {/key}
      {:else if view.phase === 'pick' || view.phase === 'prepare'}
        <h2>{view.ready ? 'You’re ready' : 'You’ll present next round'}</h2>
        {#if view.secret}<p class="secret">Your secret <strong>{view.secret.answer}</strong></p>{/if}
        <p class="muted">
          {view.ready ? (view.phase === 'pick' ? 'Waiting for the other picks.' : 'Waiting for the other opening clues.')
            : 'You can guess as soon as the first turn starts.'}
        </p>
      {:else if view.phase === 'present'}
        {#if view.draft}
          <p class="secret">Your secret <strong>{view.secret?.answer}</strong></p>
          <h2>Give another clue</h2>
          {#key `${turn}:${view.draft.index}`}
            <PhoneCompose draft={view.draft} guesses={view.guesses} players={view.players} prepare={false} {send} serial={view.serial} />
          {/key}
          <!-- The presenter reads the guesses to steer the next clue, so they come first. -->
          <Guesses guesses={view.guesses} players={view.players} />
          <Clues sentences={view.sentences} />
        {:else}
          <h2>{presenter?.name ?? 'Player'} is presenting</h2>
          {#key turn}
            <PhoneGuess draftKey={turn} persist={!fixed}
              onsend={(text) => send({ serial: view.serial, t: 'guess', text, id: newPid() })} />
          {/key}
          <Clues sentences={view.sentences} />
          <Guesses guesses={view.guesses} players={view.players} />
        {/if}
      {:else if view.phase === 'reveal' && view.result}
        <Reveal result={view.result} players={view.players} presenter={view.presenter} />
      {:else if view.phase === 'scores' || view.phase === 'over'}
        <h2>{view.phase === 'over' ? 'Final standings' : `Round ${view.round} scores`}</h2>
        {#if view.phase === 'over'}<p class="muted">The room solved {view.solved} of {view.total} secrets</p>{/if}
        <Standings players={view.players} final={view.phase === 'over'} you={view.you} />
      {/if}
    </main>
    <Button variant="ghost" onclick={() => (leaving = true)} tip="Leaves after asking; the same code lets you back in">Leave room</Button>
    {#if view.held}
      <div class="paused" role="status"><div><h2>Waiting for {presenter?.name ?? 'the presenter'}</h2><p>Their phone dropped. The clock is stopped until they’re back (up to {awayWords(view.awayMs)}).</p></div></div>
    {:else if view.paused}<div class="paused" role="status"><div><h2>Paused</h2><p>Waiting for the host to resume.</p></div></div>{/if}
  </div>
{/if}

{#if leaving}
  <Popup title="Leave room?" onclose={() => (leaving = false)}>
    <p>{view && view.phase !== 'lobby' && view.phase !== 'over' ? 'You won’t get any more turns. You can rejoin with the same code.' : 'You can rejoin with the same code.'}</p>
    <Button variant="danger" onclick={() => { leave(); back('/salad'); }}>Leave room</Button>
    <Button variant="secondary" onclick={() => (leaving = false)}>Stay</Button>
  </Popup>
{/if}

<style>
  .phone {
    min-height: 100dvh; display: flex; flex-direction: column; max-width: 640px; margin: 0 auto;
    padding: calc(var(--safe-top) + var(--s-2)) calc(var(--safe-right) + var(--s-4))
      calc(var(--safe-bottom) + var(--s-4)) calc(var(--safe-left) + var(--s-4));
  }
  .bar { display: flex; align-items: center; gap: var(--s-2); min-height: 56px; }
  .who { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.2; }
  .who b { font-family: var(--font-display); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .who small { color: var(--text-dim); }
  main { flex: 1; display: flex; flex-direction: column; gap: var(--s-3); padding: var(--s-3) 0 var(--s-4); }
  h2, .secret { overflow-wrap: anywhere; }
  .secret { line-height: 1.25; color: var(--text-dim); padding: var(--s-2) var(--s-3); border-radius: var(--r-md); background: var(--bg-sunk); }
  .secret strong { display: block; color: var(--accent); font: 800 1.35rem / 1.15 var(--font-display); }
  .players { display: grid; gap: var(--s-2); padding: 0; margin: 0; list-style: none; }
  .players li { display: flex; align-items: center; gap: var(--s-3); padding: var(--s-2) var(--s-3); background: var(--surface); border-radius: var(--r-lg); }
  .lost { padding: var(--s-2) var(--s-3); text-align: center; border-radius: var(--r-md); background: var(--surface); }
  .paused { position: fixed; inset: 0; z-index: var(--z-overlay); display: grid; place-items: center; background: color-mix(in srgb, var(--bg) 85%, transparent); }
  .paused > div { display: grid; gap: var(--s-2); text-align: center; padding: var(--s-5); background: var(--surface); border-radius: var(--r-lg); }
</style>
