<script lang="ts">
  import SeatWait from '../../components/room/SeatWait.svelte';
  import { gameName } from '../../app.config';
  import { untrack } from 'svelte';
  import Screen from '../../components/Screen.svelte';
  import HowTo from '../../components/HowTo.svelte';
  import Popup from '../../components/Popup.svelte';
  import Button from '../../components/Button.svelte';
  import Timer from '../../components/room/Timer.svelte';
  import { back, route } from '../../lib/router.svelte';
  import { keepAwake } from '../../lib/wakelock';
  import { demo, demoArt, demoGuesses } from './demo';
  import { phone, gallery } from './player.svelte';
  import { artIds } from './view';
  import { phaseLabel, progress } from './labels';
  import type { Action } from './protocol';
  import PhoneStep from './PhoneStep.svelte';
  import PhoneDrawer from './PhoneDrawer.svelte';
  import PhoneGuess from './PhoneGuess.svelte';
  import Album from './Album.svelte';
  import Reveal from './Reveal.svelte';
  import Standings from './Standings.svelte';
  import Join from './Join.svelte';
  import Rules from './Rules.svelte';

  const fixed = $derived(route.params.get('demo'));
  const code = $derived(route.params.get('code') ?? '');
  const v = $derived(fixed ? fixed === 'join' ? null : demo(fixed, true, demoGuesses(route.params.get('feed'))) : phone.view);
  const art = $derived(fixed ? demoArt : gallery.art);
  let now = $state(Date.now());
  const remaining = $derived(fixed ? v?.left ?? null : phone.left(now));
  let leaving = $state(false);
  let sent = $state<number | null>(null);
  const me = $derived(fixed ? v?.players[0] : v?.players.find((p) => p.pid === phone.me?.pid));
  const roomCode = $derived(fixed ? 'SKCH' : phone.me?.code ?? '');
  const drawing = $derived(!!v && !!me && v.drawer === me.pid);
  const steps = $derived(v?.phase === 'write' || v?.phase === 'draw' || v?.phase === 'describe');
  /** Telephone: joined after the chains were dealt. */
  const watching = $derived(!!v && steps && !!me && !v.order?.includes(me.pid));
  /** The Telephone draw step, or a drawing being drawn or guessed: the screen is meant to fit the
   *  phone, the pad and its buttons on screen and the guesses taking the room left under them. */
  const fit = $derived(!!v && !watching && ((steps && v.task?.kind === 'draw' && !v.sent && sent !== v.at) || (v.phase === 'guess' && !!v.ink)));
  /** Even with the pad at its smallest and the guesses at their shortest it does not fit (a short
   *  phone, a phone on its side): the page scrolls as one piece, laid out as it always was. */
  let cramped = $state(false);
  const fits = $derived(fit && !cramped);
  let play = $state<HTMLElement>();
  // Tried again for each turn and whenever the window changes size; checked whenever what is on
  // screen changes, once the app's fonts are in (text in a stand-in font can be taller).
  const turn = $derived(v?.phase === 'guess' ? v.ink : v?.task?.id);
  $effect(() => {
    void turn;
    cramped = false;
  });
  function check() {
    if (document.fonts && document.fonts.status !== 'loaded') return void document.fonts.ready.then(check);
    const screen = play?.closest<HTMLElement>('.screen');
    if (fits && screen && screen.scrollHeight > screen.clientHeight + 1) cramped = true;
  }
  $effect(() => {
    void v;
    void phone.link;
    if (!fits || !play) return;
    check();
    const seen = new ResizeObserver(check);
    for (const part of play.children) seen.observe(part);
    return () => seen.disconnect();
  });
  const name = (pid?: string) => v?.players.find((p) => p.pid === pid)?.name ?? 'The drawer';

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

  // Drawings this screen shows (or shows next) and lacks: asked for until they come.
  $effect(() => {
    if (fixed || !v || phone.link !== 'live') return;
    const ids = [...new Set(artIds(v))].filter((id) => !art[id]);
    if (!ids.length) return;
    const request = () => ids.forEach((id) => phone.ask({ t: 'art?', id }));
    request();
    const interval = setInterval(request, 1500);
    return () => clearInterval(interval);
  });

  // Sent just as the host paused (it ignores lines, drawings and picks while paused): once play
  // resumes and the host still lacks it, show the job again; a saved Done sends itself again.
  let wasPaused = false;
  $effect(() => {
    if (!v) return;
    if (wasPaused && !v.paused && sent === v.at && ((v.task && !v.sent) || v.offer)) sent = null;
    wasPaused = v.paused;
  });

  function send(m: Action) {
    if (sent === m.at || v?.paused) return;
    sent = m.at;
    if (!fixed) phone.send(m);
  }
  function guess(text: string) {
    if (!fixed && v) phone.ask({ t: 'guess', at: v.at, text });
  }
</script>

<svelte:window onresize={() => (cramped = false)} />
{#if !fixed}<SeatWait link={phone} />{/if}

{#if !v || (!fixed && phone.stopped)}
  {#key code}<Join code={code || phone.me?.code || ''} fixed={!!fixed} />{/key}
{:else}
  <Screen title={gameName('sketch')} fill={fits} onback={() => fixed ? back('/sketch') : (leaving = true)}>
    {#snippet trailing()}<HowTo><Rules /></HowTo>{/snippet}
    <div class="play" class:fit={fits} bind:this={play}>
      {#if !fixed && phone.link !== 'live'}<p role="status">{phone.trouble || 'Reconnecting…'}</p>{/if}
      {#if me && v.phase !== 'guess' && !(steps && v.task && !v.sent)}<p class="me"><b>{me.name}</b>{v.mode === 'guess' ? ` · ${me.score.toLocaleString()} pts` : ''} · Room {roomCode}</p>{/if}
      {#if v.phase !== 'lobby'}
        <div class="heading">
          <div>
            {#if progress(v)}<p>{progress(v)}</p>{/if}
            <h3>{phaseLabel(v, me?.pid)}</h3>
          </div>
          <Timer left={remaining} total={v.total} paused={v.paused} size={46} />
        </div>
      {/if}
      {#if v.paused}<p class="note" role="status">Paused by the host.</p>{/if}
      {#if v.phase === 'lobby' && !me}
        <p class="muted" role="status">Joining the room…</p>
      {:else if v.phase === 'lobby'}
        <p class="big">You’re in!</p>
        <p class="muted">{v.mode === 'telephone' ? 'Telephone' : 'Draw & guess'}. The game starts from the host screen. Keep this screen open.</p>
      {:else if watching}
        <p class="muted">You joined after the game started. Watch the album at the end; you’ll play the next game.</p>
      {:else if steps && v.task && !v.sent && sent !== v.at}
        {@const at = v.at}
        {#key v.task.id}
          <PhoneStep {v} {art} expired={remaining === 0} demo={!!fixed}
            ontext={(text) => send({ t: 'line', at, text })} ondraw={(d) => send({ t: 'draw', at, d })} />
        {/key}
      {:else if steps}
        <p class="big">Done!</p>
        <p class="muted">{v.waiting ? `Waiting for ${v.waiting} more.` : 'Waiting for the step to end.'}</p>
      {:else if v.phase === 'album' && v.album}
        <Album album={v.album} {art} />
        <p class="muted">The host turns the pages.</p>
      {:else if v.phase === 'pick'}
        {#if drawing && v.offer && sent !== v.at}
          {@const at = v.at}
          <div class="offer">
            {#each v.offer as word, i (word)}
              <Button size="lg" disabled={v.paused} onclick={() => send({ t: 'pick', at, i })}>{word}</Button>
            {/each}
          </div>
          <p class="muted">Not picked in time? You get the first one.</p>
        {:else if drawing}<p class="muted">Get ready to draw…</p>
        {:else}<p class="big">{name(v.drawer)} is choosing a word…</p>{/if}
      {:else if v.phase === 'guess' && v.ink}
        {#key v.ink}
          {#if drawing}<PhoneDrawer {v} me={me?.pid} expired={remaining === 0} demo={!!fixed} fit={fits} />
          {:else}<PhoneGuess {v} {art} me={me?.pid} demo={!!fixed} fit={fits} onguess={guess} />{/if}
        {/key}
      {:else if v.phase === 'reveal'}
        <Reveal {v} {art} />
      {:else if v.phase === 'scores' || v.phase === 'over'}
        <Standings {v} />
      {/if}
    </div>
  </Screen>
{/if}
{#if leaving}
  <Popup title="Leave the room?" onclose={() => (leaving = false)}>
    <p>{v && v.phase !== 'lobby' && v.phase !== 'over' ? 'You won’t get any more turns. You can rejoin with the same code' + (v.mode === 'guess' ? ' and keep your score.' : '.') : 'You can rejoin with the same code.'}</p>
    <Button variant="danger" onclick={() => { phone.leave(); gallery.clear(); back('/sketch'); }}>Leave</Button>
    <Button variant="secondary" onclick={() => (leaving = false)}>Stay</Button>
  </Popup>
{/if}

<style>
  .play { display: grid; gap: var(--s-2); padding-bottom: var(--s-4); }
  /* Fills the room under the header; the guesses are the part that grows and shrinks. */
  .play.fit { flex: 1 1 0; display: flex; flex-direction: column; }
  .heading { display: flex; align-items: center; justify-content: space-between; gap: var(--s-2); }
  .heading h3 { font-size: clamp(1.15rem, calc(5vw * var(--text-scale)), 1.8rem); }
  .heading p { color: var(--text-dim); }
  .me { color: var(--text-dim); overflow-wrap: anywhere; }
  .me b { color: var(--accent); font-family: var(--font-display); }
  .big { font: 800 1.8rem / 1.15 var(--font-display); overflow-wrap: anywhere; }
  .note { color: var(--c-pass); font-weight: 700; }
  .offer { display: grid; gap: var(--s-3); }
</style>
