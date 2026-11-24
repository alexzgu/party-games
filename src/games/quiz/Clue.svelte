<script lang="ts">
  import FitText from '../../components/FitText.svelte';
  import Button from '../../components/Button.svelte';
  import TopBar from './TopBar.svelte';
  import { tileInfo, type Game } from './logic';
  import { teamColor } from './look';

  // One tile, full screen: the clue for the host to read, then the answer and who got it.
  // With the penalty rule on, teams can be marked wrong on either step. Up to four teams get big
  // buttons and their own row of ✗ marks; five or more get a compact grid where each team's ✗
  // sits beside its name. A solo player just gets "Got it" or "Missed".
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
  const n = $derived(game.teams.length);
  const alone = $derived(n === 1);
  const compact = $derived(n > 4);

  // Taps this soon after the clue or the answer appears are the tail of a double tap on the
  // previous screen, so they must not score a team or mark one wrong.
  // Only a new step restarts the wait: a ✗ mark changes the game but not the screen.
  let shownAt = performance.now();
  const step = $derived(`${game.phase}:${game.open?.tile}`);
  $effect.pre(() => { void step; shownAt = performance.now(); });
  const settled = () => performance.now() - shownAt >= 400;

  // Keys for a laptop host: Space/Enter show the answer, 1–9 award teams 1–9 (solo: 1 got it),
  // 0 nobody (solo: missed), Esc puts the tile back. Teams past nine use the buttons.
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

<div class="clue" class:many={n > 8}>
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

  <div class="controls">
    <div class="picks">
      {#if answering && alone}
        <p class="ask">Did {game.teams[0]} get it?</p>
        <div class="solo">
          <button class="team" style:--team={teamColor(0)} onclick={() => settled() && onaward(0)} aria-label="Got it, plus {info.value}">
            <span class="tname">✓ Got it</span><span class="pts">+{info.value}</span>
          </button>
          <button class="team missed" onclick={() => settled() && onaward(-1)} aria-label={game.penalty ? `Missed, minus ${info.value}` : 'Missed'}>
            <span class="tname">✗ Missed</span><span class="pts">{game.penalty ? `−${info.value}` : 'no points'}</span>
          </button>
        </div>
      {:else if answering && compact}
        <p class="ask">Who got it? <span class="faint">+{info.value}</span></p>
        <ul class="cells" class:pen={game.penalty} style:--n={n}>
          {#each game.teams as name, i (i)}
            {@const wrong = open.wrong.includes(i)}
            <li class="cell" class:wrong style:--team={teamColor(i)}>
              <button class="got" disabled={wrong} onclick={() => settled() && onaward(i)} aria-label={wrong ? `${name}, marked wrong` : `${name} got it, plus ${info.value}`}>
                {#if i < 9}<span class="num" aria-hidden="true">{i + 1}</span>{/if}<span class="cname">{name}</span>
              </button>
              {#if game.penalty}
                <button class="x" class:on={wrong} aria-pressed={wrong} onclick={() => settled() && onwrong(i)} aria-label="{name} answered wrong" data-tip={wrong ? 'Takes the wrong mark off this team' : "Marks this team wrong; they lose the tile's points"}>✗</button>
              {/if}
            </li>
          {/each}
        </ul>
      {:else if answering}
        <p class="ask">Who got it?</p>
        <div class="teams" class:four={n === 4} style:--n={n}>
          {#each game.teams as name, i (i)}
            {@const wrong = open.wrong.includes(i)}
            <button class="team" class:wrong style:--team={teamColor(i)} disabled={wrong} onclick={() => settled() && onaward(i)} aria-label={wrong ? `${name}, marked wrong` : `${name} got it, plus ${info.value}`}>
              <span class="tname">{name}</span>
              <span class="pts">{wrong ? `✗ −${info.value}` : `✓ +${info.value}`}</span>
            </button>
          {/each}
        </div>
      {/if}

      {#if game.penalty && !alone && !(answering && compact)}
        <div class="wrongs" role="group" aria-label="Wrong answers lose {info.value}">
          <span class="wlabel">Wrong answer? <span class="faint">−{info.value}</span></span>
          <div class="wbtns" class:compact style:--n={n}>
            {#each game.teams as name, i (i)}
              {@const on = open.wrong.includes(i)}
              <button class="wbtn" class:on style:--team={teamColor(i)} aria-pressed={on} onclick={() => settled() && onwrong(i)} aria-label="{name} answered wrong" data-tip={on ? 'Takes the wrong mark off this team' : "Marks this team wrong; they lose the tile's points"}>
                <span aria-hidden="true">✗</span> <span class="wname">{name}</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}
    </div>
    {#if !answering}
      <div class="actions"><Button size="lg" onclick={onanswer}>Show answer</Button></div>
    {:else if !alone}
      <div class="actions"><Button variant="secondary" onclick={() => settled() && onaward(-1)}>Nobody</Button></div>
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
  .tname { font-family: var(--font-display); font-weight: 800; font-size: clamp(0.92rem, 2.8vmin, 2.2rem); line-height: 1.1; overflow-wrap: break-word; hyphens: auto; text-align: center; min-width: 0; max-width: 100%; }
  .pts { font-weight: 700; color: var(--c-good); font-size: clamp(0.85rem, 2vmin, 1.4rem); }
  /* Four teams across a narrow phone: tighter boxes and type, so a name breaks between words. */
  @media (max-width: 420px) {
    .four .team { padding: var(--s-2) 4px; }
    .four .tname { font-size: 0.84rem; letter-spacing: -0.02em; }
  }
  .team.wrong { opacity: 0.45; border-style: dashed; background: var(--surface); }
  .team.wrong .pts { color: var(--c-bad); }

  .wrongs { display: flex; flex-direction: column; gap: 6px; }
  .wlabel { font-size: 0.85rem; font-weight: 700; color: var(--text-dim); text-align: center; }
  .wbtns { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 6px; }
  .wbtns.compact { grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); }
  .wbtn {
    min-height: 44px; padding: 4px 6px; border-radius: var(--r-pill); display: flex; align-items: center; justify-content: center; gap: 4px;
    background: var(--surface); border: 1.5px solid color-mix(in srgb, var(--team) 50%, transparent); color: var(--text-dim); font-weight: 700; font-size: 0.9rem;
  }
  .wname { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .wbtn.on { background: color-mix(in srgb, var(--c-bad) 22%, var(--surface)); border-color: var(--c-bad); color: var(--text); }
  .wbtn.on > span:first-child { color: var(--c-bad); }

  .actions { display: flex; flex-direction: column; }

  .solo { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-2); }
  .team.missed { --team: var(--c-bad); background: var(--surface); border-color: var(--line-strong); }
  .team.missed .pts { color: var(--c-bad); }

  /* Five teams or more: a compact grid, each team's ✗ beside its name. */
  .cells { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); }
  .cells.pen { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
  @media (min-width: 700px) {
    .cells { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
    .cells.pen { grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); }
  }
  .cell { display: flex; min-width: 0; border-radius: var(--r-sm); border: 2px solid var(--team); background: color-mix(in srgb, var(--team) 14%, var(--surface)); overflow: hidden; }
  .got {
    flex: 1; min-width: 0; min-height: 48px; padding: 4px 8px; border: 0; background: none; color: var(--text);
    display: flex; align-items: center; gap: 6px; text-align: left;
  }
  .got:active:not(:disabled) { background: color-mix(in srgb, var(--team) 30%, transparent); }
  .num {
    flex: none; width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center;
    font-size: 0.7rem; font-weight: 800; background: var(--team); color: var(--bg);
  }
  .cname { min-width: 0; font-weight: 800; font-size: clamp(0.85rem, 1.9vmin, 1.25rem); line-height: 1.1; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .x {
    flex: none; width: 44px; border: 0; border-left: 1.5px solid color-mix(in srgb, var(--team) 50%, transparent);
    background: var(--surface); color: var(--text-faint); font-weight: 800; font-size: 1.05rem;
  }
  .x.on { background: color-mix(in srgb, var(--c-bad) 26%, var(--surface)); color: var(--c-bad); }
  .cell.wrong { border-style: dashed; border-color: var(--c-bad); background: var(--surface); }
  .cell.wrong .got { opacity: 0.45; }
  @media (max-height: 560px) { .panel { flex: none; height: 240px; min-height: 0; } }
  /* A phone page that scrolls (nine teams or more) gives the clue a fixed share of the screen. */
  @media (max-width: 699px) { .clue.many .panel { flex: none; height: max(220px, 32vh); min-height: 0; } }
  @media (min-width: 900px) and (orientation: landscape) {
    .actions { align-self: center; width: min(560px, 100%); }
  }
  .controls, .picks { display: contents; }
  /* A phone on its side: the clue or the answer on the left under the header; who got it, the ✗
     marks and the main button on the right at full height (the teams scroll inside if they
     cannot all fit, the button never does). */
  @media (orientation: landscape) and (max-height: 500px) {
    .clue { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr); grid-template-rows: auto minmax(0, 1fr); column-gap: var(--s-3); }
    .clue > :global(.bar) { grid-column: 1; grid-row: 1; }
    .panel { grid-column: 1; grid-row: 2; }
    .controls { grid-column: 2; grid-row: 1 / -1; }
    .panel, .clue.many .panel { height: auto; min-height: 0; flex: none; padding: var(--s-3); gap: var(--s-2); }
    .small-clue { font-size: 0.95rem; }
    .controls { display: flex; flex-direction: column; gap: var(--s-2); min-height: 0; min-width: 0; }
    .picks { display: flex; flex-direction: column; gap: 6px; min-height: 0; overflow-y: auto; margin-top: auto; }
    .actions { margin-bottom: auto; width: auto; }
    .teams { grid-template-columns: repeat(auto-fit, minmax(96px, 1fr)); }
    .team { min-height: 56px; padding: 4px; }
    .cells { grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); }
    .cells.pen { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
    .got { min-height: 44px; }
    .wbtns.compact { grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); }
  }
</style>
