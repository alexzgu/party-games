<script lang="ts">
  // Full-screen, team-coloured pass-the-phone card. The button arms after a short pause so
  // a double tap on the previous screen cannot skip past it.
  import Button from '../../components/Button.svelte';

  let {
    color,
    team,
    title,
    steps,
    button,
    note = '',
    onready,
    onclose,
  }: {
    color: string;
    team: string;
    title: string;
    steps: { icon: 'phone' | 'eye' | 'hide'; text: string }[];
    button: string;
    note?: string;
    onready: () => void;
    onclose?: () => void;
  } = $props();

</script>

<div class="handoff fade-in" style:--team={color}>
  {#if onclose}
    <button class="menu" onclick={onclose} aria-label="Pause and go home (the game is saved)">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>
    </button>
  {/if}
  <div class="content">
  <div class="top">
    <p class="kicker">{team}</p>
    <h1>{title}</h1>
  </div>
  <ol class="steps">
    {#each steps as s, i (i)}
      <li class="pop-in" style:animation-delay="{120 + i * 90}ms">
        <span class="icon" aria-hidden="true">
          {#if s.icon === 'phone'}
            <svg viewBox="0 0 24 24" width="30" height="30"><rect x="6" y="2.5" width="12" height="19" rx="2.6" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M10.5 18.5h3" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
          {:else if s.icon === 'eye'}
            <svg viewBox="0 0 24 24" width="30" height="30"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/></svg>
          {:else}
            <svg viewBox="0 0 24 24" width="30" height="30"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M4 4l16 16" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>
          {/if}
        </span>
        <span>{s.text}</span>
      </li>
    {/each}
  </ol>
  </div>
  {#if note}<p class="note">{note}</p>{/if}
  <div class="go">
    <Button size="lg" onclick={onready}>{button}</Button>
  </div>
</div>

<style>
  .handoff {
    position: relative;
    min-height: 100dvh; display: flex; flex-direction: column; gap: var(--s-5);
    padding: calc(var(--safe-top) + var(--s-6)) calc(var(--safe-right) + var(--s-5)) calc(var(--safe-bottom) + var(--s-5)) calc(var(--safe-left) + var(--s-5));
    background:
      radial-gradient(120% 70% at 50% 0%, color-mix(in srgb, white 18%, var(--team)), var(--team) 70%);
    color: var(--bg);
  }
  .menu {
    position: absolute; top: calc(var(--safe-top) + var(--s-3)); right: calc(var(--safe-right) + var(--s-3));
    width: 48px; height: 48px; border-radius: var(--r-pill); border: 0;
    background: rgb(0 0 0 / 0.14); color: inherit; display: grid; place-items: center;
  }
  .content { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: var(--s-6); }
  .top { display: flex; flex-direction: column; gap: var(--s-3); }
  .kicker {
    align-self: flex-start; padding: var(--s-1) var(--s-3); border-radius: var(--r-pill);
    background: var(--bg); color: var(--team);
    font-family: var(--font-display); font-weight: 800; font-size: 1.25rem;
  }
  h1 { font-size: clamp(3rem, 15vw, 4.6rem); line-height: 0.95; }
  .steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--s-3); }
  .steps li {
    display: flex; align-items: center; gap: var(--s-3);
    padding: var(--s-3) var(--s-4); border-radius: var(--r-md);
    background: rgb(0 0 0 / 0.1);
    font-size: 1.2rem; font-weight: 700; line-height: 1.25;
  }
  .icon { flex: none; width: 44px; height: 44px; display: grid; place-items: center; border-radius: 50%; background: rgb(0 0 0 / 0.14); }
  .note { text-align: center; font-weight: 700; opacity: 0.75; }
  .go :global(.btn) { background: var(--bg); color: var(--team); box-shadow: 0 10px 28px rgb(0 0 0 / 0.35); }
</style>
