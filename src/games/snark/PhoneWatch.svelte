<script lang="ts">
  import Avatar from '../../components/room/Avatar.svelte';
  import Voters from './Voters.svelte';
  import PhoneReveal from './PhoneReveal.svelte';
  import PhoneStandings from './PhoneStandings.svelte';
  import PhoneShow from './PhoneShow.svelte';
  import { ordinal, roundName, secs } from './look';
  import { pts } from './record';
  import type { PlayerView } from './view';

  // A phone with nothing to do: the lobby, waiting for the next round, the reveal, the scores and
  // the winner, with what the host screen shows when the host sent it (older hosts do not).
  let { view, left }: { view: PlayerView; left: number | null } = $props();

  const s = $derived(view.screen);
  const next = $derived(view.round + 1);
  const nextName = $derived(roundName(next, view.rounds) + (next >= view.rounds ? (view.duels ? ': three-line duels' : ': one prompt for everyone') : next === 2 ? ': double points' : ''));
</script>

{#if s.k === 'show'}
  <PhoneShow prompt={s.prompt} sides={s.sides} {left} span={view.span} />
{:else if s.k === 'reveal' && s.show}
  <PhoneReveal show={s.show} gain={s.gain} />
{:else if s.k === 'scores' && s.rows}
  <div class="watch pop-in">
    <p class="big">You're {ordinal(s.place)}</p>
    <p class="muted">Scores after {roundName(view.round, view.rounds).toLowerCase()}</p>
    <PhoneStandings rows={s.rows} me={view.me.name} gains />
    <p class="muted">Next: {nextName}{left !== null ? ` · in ${secs(left)} s` : ''}</p>
  </div>
{:else}
  <div class="wait pop-in">
    {#if s.k === 'lobby'}
      <p class="emoji" aria-hidden="true">🦈</p>
      <p class="big">You're in!</p>
      <p class="muted">{s.players} {s.players === 1 ? 'player' : 'players'} so far. The game starts from the host screen.</p>
      {#if s.who?.length}
        <ul class="who" aria-label="Players">
          {#each s.who as p (p.name)}<li><Avatar name={p.name} color={p.color} size={28} /><span>{p.name}</span></li>{/each}
        </ul>
      {/if}
    {:else if s.k === 'late'}
      <p class="emoji" aria-hidden="true">🍿</p>
      <p class="big">You're in from the next round</p>
      {#if s.writers?.length}
        <p class="muted">Follow along here until then. {s.writers.filter((w) => w.done).length} of {s.writers.length} done writing:</p>
        <Voters people={s.writers} label="Who is done" size={28} />
      {:else}
        <p class="muted">Follow along here until then.</p>
      {/if}
    {:else if s.k === 'reveal'}
      <p class="emoji" aria-hidden="true">👀</p>
      <p class="big">Eyes on the host screen</p>
      {#if s.gain !== null}<p class="gain" class:zero={s.gain === 0}>{s.gain ? `+${pts(s.gain)} for you` : 'No votes for you this time'}</p>{/if}
    {:else if s.k === 'scores'}
      <p class="emoji" aria-hidden="true">📊</p>
      <p class="big">You're {ordinal(s.place)}</p>
      <p class="muted">with {pts(view.me.score)} points. Next round starts soon.</p>
    {:else if s.k === 'over'}
      <p class="emoji" aria-hidden="true">{s.place === 1 ? '🏆' : '🎉'}</p>
      <p class="big">{s.winners.length === 1 ? `${s.winners[0]} wins!` : s.winners.length ? `Tie: ${s.winners.join(' & ')}` : 'Game over'}</p>
      <p class="muted">You finished {ordinal(s.place)} with {pts(view.me.score)} points.</p>
      {#if s.rows}<PhoneStandings rows={s.rows} me={view.me.name} />{/if}
    {:else if s.k === 'kicked'}
      <p class="big">The host removed you from this game.</p>
    {/if}
  </div>
{/if}

<style>
  .wait { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--s-3); text-align: center; padding: var(--s-5) 0; }
  .watch { display: flex; flex-direction: column; align-items: center; gap: var(--s-3); text-align: center; }
  .emoji { font-size: 4rem; line-height: 1; }
  .big { font-family: var(--font-display); font-weight: 800; font-size: 1.8rem; line-height: 1.15; }
  .gain { font-family: var(--font-display); font-weight: 800; font-size: 1.5rem; color: var(--c-good); }
  .gain.zero { color: var(--text-dim); }
  .who { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--s-2); justify-content: center; }
  .who li { display: flex; align-items: center; gap: 6px; padding: 4px 12px 4px 4px; border-radius: var(--r-pill); background: var(--overlay); font-weight: 700; font-size: 0.95rem; }
</style>
