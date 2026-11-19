<script lang="ts">
  import FitText from '../../components/FitText.svelte';
  import Button from '../../components/Button.svelte';
  import TopBar from './TopBar.svelte';
  import { tileInfo, type Game } from './logic';
  import { teamColor } from './look';

  // One tile, full screen: the clue for the host to read, then the answer and who got it.
  // With the penalty rule on, teams can be marked wrong on either step.
  let { game, onanswer, onaward, onwrong, onback }: {
    game: Game;
    onanswer: () => void;
    onaward: (team: number) => void;
    onwrong: (team: number) => void;
    onback: () => void;
  } = $props();

  const open = $derived(game.open!);
  const info = $derived(tileInfo(game, open.tile));
  const answering = $derived(game.phase === 'answer');

  // Taps this soon after the clue or the answer appears are the tail of a double tap on the
  // previous screen, so they must not score a team or mark one wrong.
  let shownAt = performance.now();
  $effect.pre(() => { void game.phase; shownAt = performance.now(); });
  const settled = () => performance.now() - shownAt >= 400;

  // Keys for a laptop host: Space/Enter show the answer, 1–4 award, 0 nobody, Esc puts the tile back.
  // A button the host just clicked or tapped keeps focus but is not "in use" from the keyboard,
  // so the shortcuts win there; a button reached with Tab keeps its own Space and Enter.
  let tabbing = false;
  function key(e: KeyboardEvent) {
    if (e.key === 'Tab') tabbing = true;
    if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented || e.repeat) return;
    const el = e.target as HTMLElement | null;
    if (el?.closest?.('input, textarea, [role="dialog"]')) return;
    const onButton = tabbing && !!el?.closest?.('button');
    if (e.key === 'Escape') { e.preventDefault(); onback(); return; }
    if (!answering && (e.key === ' ' || e.key === 'Enter') && !onButton) {
      e.preventDefault();
      el?.blur?.(); // so the key coming back up cannot press the button that had focus
      onanswer();
      return;
    }
    if (answering && /^[0-9]$/.test(e.key)) {
      const n = Number(e.key);
      if (n === 0) onaward(-1);
      else if (n <= game.teams.length && !open.wrong.includes(n - 1)) onaward(n - 1);
    }
  }
</script>

<svelte:window onkeydown={key} onpointerdown={() => (tabbing = false)} />

<div class="clue">
  <TopBar backLabel="Put the tile back on the board" onback={onback}>
    {#snippet title()}
      <p class="where"><span class="cat">{info.category}</span><b class="val">{info.value}</b></p>
    {/snippet}
  </TopBar>

  <section class="panel pop-in" class:answering aria-label={answering ? 'Answer' : 'Clue'}>
    {#if answering}
      <p class="small-clue">{info.clue}</p>
      <div class="answer pop-in"><FitText text={info.answer} max={150} min={22} /></div>
    {:else}
      <div class="text"><FitText text={info.clue} max={120} min={18} weight={700} /></div>
    {/if}
  </section>

  {#if answering}
    <p class="ask">Who got it?</p>
    <div class="teams" style:--n={game.teams.length}>
      {#each game.teams as name, i (i)}
        {@const wrong = open.wrong.includes(i)}
        <button class="team" class:wrong style:--team={teamColor(i)} disabled={wrong} onclick={() => settled() && onaward(i)} aria-label={wrong ? `${name}, marked wrong` : `${name} got it, plus ${info.value}`}>
          <span class="tname">{name}</span>
          <span class="pts">{wrong ? `✗ −${info.value}` : `✓ +${info.value}`}</span>
        </button>
      {/each}
    </div>
  {/if}

  {#if game.penalty}
    <div class="wrongs" role="group" aria-label="Wrong answers lose {info.value}">
      <span class="wlabel">Wrong answer? <span class="faint">−{info.value}</span></span>
      <div class="wbtns" style:--n={game.teams.length}>
        {#each game.teams as name, i (i)}
          {@const on = open.wrong.includes(i)}
          <button class="wbtn" class:on style:--team={teamColor(i)} aria-pressed={on} onclick={() => settled() && onwrong(i)} aria-label="{name} answered wrong">
            <span aria-hidden="true">✗</span> <span class="wname">{name}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <div class="actions">
    {#if answering}
      <Button variant="secondary" onclick={() => onaward(-1)}>Nobody got it</Button>
    {:else}
      <Button size="lg" onclick={onanswer}>Show answer</Button>
    {/if}
  </div>
</div>

<style>
  .clue { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: clamp(8px, 1.4vmin, 18px); }
  .where { display: flex; align-items: baseline; justify-content: center; gap: var(--s-3); min-width: 0; padding-right: 48px; }
  .cat {
    min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-dim); font-size: clamp(0.9rem, 2.4vmin, 1.8rem);
  }
  .val { flex: none; font-family: var(--font-display); font-weight: 800; color: var(--accent); font-size: clamp(1.3rem, 3.6vmin, 2.8rem); }

  .panel {
    flex: 1; min-height: 160px; display: flex; flex-direction: column; gap: var(--s-3);
    padding: clamp(16px, 3vmin, 48px); border-radius: var(--r-lg);
    background: radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 70%), var(--bg-raised);
    border: 2px solid color-mix(in srgb, var(--accent) 55%, transparent);
    box-shadow: var(--shadow);
  }
  .text { flex: 1; min-height: 0; }
  .small-clue { color: var(--text-dim); font-weight: 600; text-align: center; font-size: clamp(0.95rem, 2.6vmin, 1.9rem); line-height: 1.3; }
  .answer { flex: 1; min-height: 0; color: var(--accent); }

  .ask { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-dim); font-weight: 700; text-align: center; }
  .teams { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: var(--s-2); }
  .team {
    min-height: clamp(64px, 11vmin, 120px); padding: var(--s-2); border-radius: var(--r-md);
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
    background: color-mix(in srgb, var(--team) 16%, var(--surface)); border: 2px solid var(--team); color: var(--text);
    transition: transform var(--dur-fast) var(--ease-out);
  }
  .team:active:not(:disabled) { transform: scale(0.96); }
  .tname { font-family: var(--font-display); font-weight: 800; font-size: clamp(1rem, 2.8vmin, 2.2rem); line-height: 1.1; overflow-wrap: anywhere; text-align: center; }
  .pts { font-weight: 700; color: var(--c-good); font-size: clamp(0.85rem, 2vmin, 1.4rem); }
  .team.wrong { opacity: 0.45; border-style: dashed; background: var(--surface); }
  .team.wrong .pts { color: var(--c-bad); }

  .wrongs { display: flex; flex-direction: column; gap: 6px; }
  .wlabel { font-size: 0.85rem; font-weight: 700; color: var(--text-dim); text-align: center; }
  .wbtns { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 6px; }
  .wbtn {
    min-height: 44px; padding: 4px 6px; border-radius: var(--r-pill); display: flex; align-items: center; justify-content: center; gap: 4px;
    background: var(--surface); border: 1.5px solid color-mix(in srgb, var(--team) 50%, transparent); color: var(--text-dim); font-weight: 700; font-size: 0.9rem;
  }
  .wname { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .wbtn.on { background: color-mix(in srgb, var(--c-bad) 22%, var(--surface)); border-color: var(--c-bad); color: var(--text); }
  .wbtn.on > span:first-child { color: var(--c-bad); }

  .actions { display: flex; flex-direction: column; }
  @media (max-height: 560px) { .panel { flex: none; height: 240px; min-height: 0; } }
  @media (min-width: 900px) and (orientation: landscape) {
    .actions { align-self: center; width: min(560px, 100%); }
  }
</style>
