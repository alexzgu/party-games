<script lang="ts">
  import Button from '../../components/Button.svelte';
  import { FINAL_VOTES_EACH } from './scoring';
  import { haptic } from '../../lib/haptics';
  import { sfx } from '../../lib/sound';
  import Voters from './Voters.svelte';
  import type { Tick } from './view';

  type Vote3Screen = { at: number; prompt: string; choices: { id: number; text: string }[]; own: boolean; sent: boolean; answers?: string[]; mine?: number; voters?: Tick[] };
  // The final vote: tap an answer to give it a vote (up to three in all, on one or several),
  // − takes one back, Send locks them in. Then every answer and who has voted, as on the host screen.
  let { screen, onsend }: { screen: Vote3Screen; onsend: (v: Record<string, number>) => void } = $props();

  let given = $state<Record<number, number>>({});
  let sentHere = $state(false);
  const sent = $derived(screen.sent || sentHere);
  const used = $derived(Object.values(given).reduce((a, b) => a + b, 0));
  const leftover = $derived(FINAL_VOTES_EACH - used);
  const shownAt = performance.now();
  const watching = $derived(!!screen.answers && (sent || !screen.choices.length));
  const votesIn = $derived(screen.voters?.filter((v) => v.done).length ?? 0);

  function add(id: number) {
    if (sent || leftover <= 0 || performance.now() - shownAt < 400) return;
    given = { ...given, [id]: (given[id] ?? 0) + 1 };
    sfx.tick();
    haptic.light();
  }
  function takeBack(id: number) {
    if (sent || !given[id]) return;
    given = { ...given, [id]: given[id] - 1 };
  }
  function send() {
    if (sent || used === 0) return;
    sentHere = true;
    haptic.correct();
    onsend(Object.fromEntries(Object.entries(given).filter(([, n]) => n > 0)));
  }
</script>

<div class="vote3">
  <p class="step">Final vote</p>
  <h2 class="prompt">{screen.prompt}</h2>
  {#if watching && screen.answers}
    <p class="sent pop-in">{sent ? '🗳️ Votes sent!' : 'No answers for you to vote on.'}</p>
    <ul class="all" aria-label="Every answer">
      {#each screen.answers as text, k (k)}
        <li class:mine={screen.mine === k}><span class="text">{text}</span>{#if screen.mine === k}<span class="tag">Yours</span>{/if}</li>
      {/each}
    </ul>
    {#if screen.voters?.length}
      <section class="room fade-in" aria-label="Votes so far">
        <p class="count">{votesIn} of {screen.voters.length} in</p>
        <Voters people={screen.voters} size={28} />
      </section>
    {/if}
  {:else if sent}
    <div class="done pop-in"><p class="emoji" aria-hidden="true">🗳️</p><p class="big">Votes sent!</p><p class="muted">Waiting for the others.</p></div>
  {:else}
    <p class="muted left" aria-live="polite">{leftover ? `${leftover} ${leftover === 1 ? 'vote' : 'votes'} left: tap an answer to give it one` : 'All votes placed. Send them!'}</p>
    <ul class="list">
      {#each screen.choices as c (c.id)}
        {@const n = given[c.id] ?? 0}
        <li class:on={n > 0}>
          <button class="pick" onclick={() => add(c.id)} disabled={leftover <= 0 && n === 0} aria-label="Give a vote to: {c.text}{n ? ` (${n} so far)` : ''}">
            <span class="text">{c.text}</span>
            {#if n}<span class="dots" aria-hidden="true">{'●'.repeat(n)}</span>{/if}
          </button>
          {#if n}<button class="minus" aria-label="Take a vote back from: {c.text}" onclick={() => takeBack(c.id)}>−</button>{/if}
        </li>
      {/each}
    </ul>
    {#if !screen.choices.length}<p class="muted">No answers to vote for.</p>{/if}
  {/if}
</div>
{#if !sent && screen.choices.length}
  <div class="send"><Button size="lg" disabled={used === 0} onclick={send} tip={used ? "Sends your votes; they can't be changed after" : undefined}>{used ? `Send ${used} ${used === 1 ? 'vote' : 'votes'}` : 'Tap answers to vote'}</Button></div>
{/if}

<style>
  .vote3 { display: flex; flex-direction: column; gap: var(--s-3); flex: 1; }
  .step { color: var(--c-gold); font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.82rem; }
  .prompt { font-size: clamp(1.25rem, 5.6vw, 1.7rem); line-height: 1.15; }
  .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--s-2); }
  li { display: flex; gap: var(--s-2); }
  .pick {
    flex: 1; min-height: 64px; display: flex; align-items: center; gap: var(--s-3); padding: var(--s-3) var(--s-4); text-align: left;
    border-radius: var(--r-md); background: var(--surface); border: 2px solid var(--line-strong); color: var(--text); font-weight: 700; font-size: 1.1rem; line-height: 1.25;
  }
  .pick:disabled { opacity: 0.5; }
  li.on .pick { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 16%, var(--surface)); }
  .text { flex: 1; overflow-wrap: anywhere; }
  .dots { color: var(--accent); letter-spacing: 2px; font-size: 1.1rem; white-space: nowrap; }
  .minus { flex: none; width: 56px; border-radius: var(--r-md); background: var(--overlay-strong); color: var(--text); font-size: 1.6rem; font-weight: 800; }
  .done { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--s-2); text-align: center; padding: var(--s-5) 0; }
  .emoji { font-size: 3.5rem; line-height: 1; }
  .big { font-family: var(--font-display); font-weight: 800; font-size: 1.7rem; }
  .sent { font-family: var(--font-display); font-weight: 800; font-size: 1.2rem; color: var(--c-good); }
  .all { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .all li { display: flex; align-items: center; gap: var(--s-2); padding: var(--s-2) var(--s-3); border-radius: var(--r-md); background: var(--surface); font-weight: 700; line-height: 1.25; }
  .all li.mine { border: 2px solid var(--me, var(--accent)); }
  .tag { flex: none; padding: 2px 10px; border-radius: var(--r-pill); background: var(--me, var(--accent)); color: var(--on-accent); font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; }
  .room { display: flex; flex-direction: column; align-items: center; gap: var(--s-2); }
  .count { color: var(--text-faint); font-weight: 700; font-size: 0.9rem; }
  .send { position: sticky; bottom: 0; padding: var(--s-3) 0 calc(var(--safe-bottom) + var(--s-2)); background: linear-gradient(to top, var(--bg) 70%, transparent); }
</style>
